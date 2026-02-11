namespace UmbracoMediaSnapshot.Core.Controllers
{
    using Azure;
    using Azure.Storage.Blobs;
    using Azure.Storage.Blobs.Models;
    using Azure.Storage.Sas;
    using Configuration;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.Extensions.Options;
    using Models;
    using NotificationHandlers;
    using Services;
    using SixLabors.ImageSharp;
    using System.Text.Json;
    using System.Text.RegularExpressions;
    using Umbraco.Cms.Api.Management.Controllers;
    using Umbraco.Cms.Api.Management.Routing;
    using Umbraco.Cms.Core.Models;
    using Umbraco.Cms.Core.Services;

    /// <summary>
    /// Defines the <see cref="SnapshotApiController" />
    /// </summary>
    [VersionedApiBackOfficeRoute("snapshot")]
    [ApiExplorerSettings(GroupName = "Snapshots")]
    [Authorize(Policy = Umbraco.Cms.Web.Common.Authorization.AuthorizationPolicies.SectionAccessMedia)]
    public partial class SnapshotApiController : ManagementApiControllerBase
    {
        /// <summary>
        /// Defines the _mediaService
        /// </summary>
        private readonly IMediaService _mediaService;

        /// <summary>
        /// Defines the _settings
        /// </summary>
        private readonly MediaSnapshotSettings _settings;

        /// <summary>
        /// Defines the _logger
        /// </summary>
        private readonly ILogger<SnapshotApiController> _logger;

        /// <summary>
        /// Defines the _blobService
        /// </summary>
        private readonly ISnapshotBlobService _blobService;

        /// <summary>
        /// Initializes a new instance of the <see cref="SnapshotApiController"/> class.
        /// </summary>
        /// <param name="mediaService">The mediaService<see cref="IMediaService"/></param>
        /// <param name="settings">The settings<see cref="IOptions{MediaSnapshotSettings}"/></param>
        /// <param name="logger">The logger<see cref="ILogger{SnapshotApiController}"/></param>
        /// <param name="blobService">The blobService<see cref="ISnapshotBlobService"/></param>
        public SnapshotApiController(IMediaService mediaService, IOptions<MediaSnapshotSettings> settings, ILogger<SnapshotApiController> logger, ISnapshotBlobService blobService)
        {
            _mediaService = mediaService;
            _settings = settings.Value;
            _logger = logger;
            _blobService = blobService;
        }

        /// <summary>
        /// The GetVersions
        /// </summary>
        /// <param name="mediaKey">The mediaKey<see cref="Guid"/></param>
        /// <returns>The <see cref="Task{IActionResult}"/></returns>
        [HttpGet("versions/{mediaKey:guid}")]
        [ProducesResponseType(typeof(IEnumerable<SnapshotVersionModel>), 200)]
        [ProducesResponseType(typeof(ProblemDetails), 500)]
        public async Task<IActionResult> GetVersions(Guid mediaKey)
        {
            try
            {
                var media = _mediaService.GetById(mediaKey);
                if (media == null) return NotFound();

                var umbracoFileValue = media.GetValue<string>("umbracoFile");
                string? folderPath = _blobService.ExtractFolderPath(umbracoFileValue);

                if (string.IsNullOrEmpty(folderPath)) return Ok(Enumerable.Empty<SnapshotVersionModel>());

                var snapshotContainer = _blobService.GetSnapshotContainer();

                if (!await snapshotContainer.ExistsAsync()) return Ok(Enumerable.Empty<SnapshotVersionModel>());

                var versions = new List<SnapshotVersionModel>();
                var prefix = folderPath.EndsWith("/") ? folderPath : folderPath + "/";

                await foreach (var blobItem in snapshotContainer.GetBlobsAsync(prefix: prefix, traits: BlobTraits.Metadata))
                {
                    var blobClient = snapshotContainer.GetBlobClient(blobItem.Name);

                    // Generate a temporary SAS link (valid for configured hours)
                    var sasUrl = blobClient.GenerateSasUri(BlobSasPermissions.Read, DateTimeOffset.UtcNow.AddHours(_settings.SasTokenExpirationHours));

                    // Use the preserved UploadDate metadata for display, fall back to blob LastModified
                    DateTime uploadDate = blobItem.Properties.LastModified?.DateTime ?? DateTime.MinValue;
                    if (blobItem.Metadata.TryGetValue("UploadDate", out var uploadDateStr)
                        && DateTime.TryParse(uploadDateStr, null, System.Globalization.DateTimeStyles.RoundtripKind, out var parsedDate))
                    {
                        uploadDate = parsedDate;
                    }

                    versions.Add(new SnapshotVersionModel
                    {
                        Name = Path.GetFileName(blobItem.Name),
                        Date = uploadDate,
                        Size = blobItem.Properties.ContentLength ?? 0,
                        Url = sasUrl.ToString(),
                        Uploader = blobItem.Metadata.TryGetValue("UploaderName", out var uploader) ? uploader : "Unknown",
                        IsRestored = blobItem.Metadata.TryGetValue("RestoredFrom", out _),
                        RestoredDate = blobItem.Metadata.TryGetValue("RestoredDate", out var restoredDateStr)
                            && DateTime.TryParse(restoredDateStr, null, System.Globalization.DateTimeStyles.RoundtripKind, out var parsedRestoredDate)
                            ? parsedRestoredDate
                            : null,
                        RestoredFrom = blobItem.Metadata.TryGetValue("RestoredFrom", out var restoredFrom) ? restoredFrom : null
                    });
                }

                return Ok(versions.OrderByDescending(v => v.Date));
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                _logger.LogWarning("Container or blob not found for media {MediaKey}", mediaKey);
                return Ok(Enumerable.Empty<SnapshotVersionModel>());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving snapshots for media {MediaKey}", mediaKey);
                return Problem("Failed to retrieve media snapshots. Please check your Azure Blob Storage configuration.");
            }
        }

        /// <summary>
        /// The RestoreSnapshot
        /// </summary>
        /// <param name="request">The request<see cref="RestoreSnapshotRequest"/></param>
        /// <returns>The <see cref="Task{IActionResult}"/></returns>
        [HttpPost("restore")]
        [ProducesResponseType(typeof(RestoreResultModel), 200)]
        [ProducesResponseType(typeof(ProblemDetails), 400)]
        [ProducesResponseType(typeof(ProblemDetails), 500)]
        public async Task<IActionResult> RestoreSnapshot([FromBody] RestoreSnapshotRequest request)
        {
            try
            {
                if (request.SnapshotName.Contains("..") || request.SnapshotName.Contains('/') || request.SnapshotName.Contains('\\'))
                    return BadRequest("Invalid snapshot name");

                var media = _mediaService.GetById(request.MediaKey);
                if (media == null) return NotFound("Media item not found");

                var umbracoFileValue = media.GetValue<string>("umbracoFile");
                string? folderPath = _blobService.ExtractFolderPath(umbracoFileValue);

                if (string.IsNullOrEmpty(folderPath))
                    return BadRequest("Unable to determine media folder path");

                var currentFilePath = _blobService.ExtractFilePath(umbracoFileValue);
                if (string.IsNullOrEmpty(currentFilePath))
                    return BadRequest("Unable to determine current file path");

                var snapshotContainer = _blobService.GetSnapshotContainer();
                var mediaContainer = _blobService.GetMediaContainer();

                // Locate and download the snapshot blob
                var snapshotBlobPath = $"{folderPath}/{request.SnapshotName}";
                var snapshotBlob = snapshotContainer.GetBlobClient(snapshotBlobPath);

                if (!await snapshotBlob.ExistsAsync())
                    return NotFound("Snapshot file not found");

                var downloadResult = await snapshotBlob.DownloadAsync();
                var snapshotProperties = await snapshotBlob.GetPropertiesAsync();

                // Buffer the content so it can be read multiple times (upload + image dimensions)
                using var memoryStream = new MemoryStream();
                await downloadResult.Value.Content.CopyToAsync(memoryStream);
                memoryStream.Position = 0;

                // Replace the media blob in Azure storage
                var originalFileName = StripTimestampFromFilename(request.SnapshotName);
                var newFilePath = $"media/{folderPath}/{originalFileName}";

                await ReplaceMediaBlobAsync(mediaContainer, currentFilePath.TrimStart('/'), newFilePath, memoryStream, snapshotProperties.Value);

                // Tag the snapshot blob with restore metadata
                await MarkSnapshotAsRestoredAsync(snapshotBlob, snapshotProperties.Value, request.SnapshotName);

                // Update all Umbraco media properties (umbracoFile, umbracoBytes, dimensions)
                var newSrc = $"/media/{folderPath}/{originalFileName}";
                UpdateMediaProperties(media, umbracoFileValue, newSrc, originalFileName, snapshotProperties.Value, memoryStream, request.MediaKey);

                // Save via Umbraco, suppressing the saving handler to avoid a duplicate snapshot
                SaveMediaWithSnapshotBypass(media);

                _logger.LogInformation("Successfully restored snapshot {SnapshotName} for media {MediaKey}. New path: {NewPath}",
                    request.SnapshotName, request.MediaKey, newSrc);

                return Ok(new RestoreResultModel
                {
                    Success = true,
                    Message = $"Successfully restored version: {originalFileName}",
                    RestoredDate = DateTime.UtcNow
                });
            }
            catch (RequestFailedException ex)
            {
                _logger.LogError(ex, "Azure storage error while restoring snapshot {SnapshotName} for media {MediaKey}",
                    request.SnapshotName, request.MediaKey);
                return Problem("Failed to restore snapshot due to storage error");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error restoring snapshot {SnapshotName} for media {MediaKey}",
                    request.SnapshotName, request.MediaKey);
                return Problem("An unexpected error occurred while restoring the snapshot");
            }
        }

        /// <summary>
        /// Replaces the current media blob with the snapshot content,
        /// deleting the old blob if it lives at a different path
        /// </summary>
        /// <param name="mediaContainer">The mediaContainer<see cref="BlobContainerClient"/></param>
        /// <param name="currentBlobPath">The currentBlobPath<see cref="string"/></param>
        /// <param name="newBlobPath">The newBlobPath<see cref="string"/></param>
        /// <param name="content">The content<see cref="MemoryStream"/></param>
        /// <param name="snapshotProperties">The snapshotProperties<see cref="BlobProperties"/></param>
        /// <returns>The <see cref="Task"/></returns>
        private async Task ReplaceMediaBlobAsync(
            BlobContainerClient mediaContainer,
            string currentBlobPath,
            string newBlobPath,
            MemoryStream content,
            BlobProperties snapshotProperties)
        {
            // Delete the old file if it's at a different path than the restored one
            if (!currentBlobPath.Equals(newBlobPath, StringComparison.OrdinalIgnoreCase))
            {
                var currentBlob = mediaContainer.GetBlobClient(currentBlobPath);
                if (await currentBlob.ExistsAsync())
                {
                    await currentBlob.DeleteAsync();
                    _logger.LogInformation("Deleted old media file: {OldPath}", currentBlobPath);
                }
            }

            // Upload the snapshot content to the new media location
            var newBlob = mediaContainer.GetBlobClient(newBlobPath);
            content.Position = 0;
            await newBlob.UploadAsync(content, overwrite: true);

            // Preserve the original content type
            if (!string.IsNullOrEmpty(snapshotProperties.ContentType))
            {
                await newBlob.SetHttpHeadersAsync(new BlobHttpHeaders
                {
                    ContentType = snapshotProperties.ContentType
                });
            }
        }

        /// <summary>
        /// Tags the snapshot blob with restore metadata so the UI can display restore history
        /// </summary>
        /// <param name="snapshotBlob">The snapshotBlob<see cref="BlobClient"/></param>
        /// <param name="snapshotProperties">The snapshotProperties<see cref="BlobProperties"/></param>
        /// <param name="snapshotName">The snapshotName<see cref="string"/></param>
        /// <returns>The <see cref="Task"/></returns>
        private static async Task MarkSnapshotAsRestoredAsync(
            BlobClient snapshotBlob,
            BlobProperties snapshotProperties,
            string snapshotName)
        {
            var restoredMeta = new Dictionary<string, string>(snapshotProperties.Metadata)
            {
                ["RestoredFrom"] = snapshotName,
                ["RestoredDate"] = DateTime.UtcNow.ToString("O")
            };
            await snapshotBlob.SetMetadataAsync(restoredMeta);
        }

        /// <summary>
        /// Updates the Umbraco media item properties: umbracoFile, umbracoBytes,
        /// and optionally umbracoWidth/umbracoHeight for image files
        /// </summary>
        /// <param name="media">The media<see cref="IMedia"/></param>
        /// <param name="umbracoFileValue">The umbracoFileValue<see cref="string?"/></param>
        /// <param name="newSrc">The newSrc<see cref="string"/></param>
        /// <param name="originalFileName">The originalFileName<see cref="string"/></param>
        /// <param name="snapshotProperties">The snapshotProperties<see cref="BlobProperties"/></param>
        /// <param name="content">The content<see cref="MemoryStream"/></param>
        /// <param name="mediaKey">The mediaKey<see cref="Guid"/></param>
        private void UpdateMediaProperties(
            IMedia media,
            string? umbracoFileValue,
            string newSrc,
            string originalFileName,
            BlobProperties snapshotProperties,
            MemoryStream content,
            Guid mediaKey)
        {
            // Update umbracoFile — handle both JSON (image cropper) and plain string formats
            UpdateUmbracoFileValue(media, umbracoFileValue, newSrc);

            // Update file size
            media.SetValue("umbracoBytes", snapshotProperties.ContentLength);

            // Update image dimensions if applicable
            var isImage = IsImageFile(originalFileName, snapshotProperties.ContentType);
            if (isImage)
            {
                content.Position = 0;
                var dimensions = GetImageDimensions(content);

                if (dimensions.HasValue)
                {
                    media.SetValue("umbracoWidth", dimensions.Value.Width);
                    media.SetValue("umbracoHeight", dimensions.Value.Height);

                    _logger.LogInformation("Updated image dimensions for media {MediaKey}: {Width}x{Height}",
                        mediaKey, dimensions.Value.Width, dimensions.Value.Height);
                }
            }
        }

        /// <summary>
        /// Sets the umbracoFile property value, preserving crops/focalPoint for JSON values
        /// or replacing the plain string path for non-image files
        /// </summary>
        /// <param name="media">The media<see cref="IMedia"/></param>
        /// <param name="currentValue">The currentValue<see cref="string?"/></param>
        /// <param name="newSrc">The newSrc<see cref="string"/></param>
        private static void UpdateUmbracoFileValue(IMedia media, string? currentValue, string newSrc)
        {
            if (currentValue?.Trim().StartsWith("{") == true)
            {
                using var jsonDoc = JsonDocument.Parse(currentValue);
                var root = jsonDoc.RootElement;

                var updatedJson = new Dictionary<string, object?>();

                foreach (var property in root.EnumerateObject())
                {
                    if (property.Name == "src")
                    {
                        updatedJson["src"] = newSrc;
                    }
                    else
                    {
                        updatedJson[property.Name] = JsonSerializer.Deserialize<object>(property.Value.GetRawText());
                    }
                }

                if (!updatedJson.ContainsKey("src"))
                {
                    updatedJson["src"] = newSrc;
                }

                media.SetValue("umbracoFile", JsonSerializer.Serialize(updatedJson));
            }
            else
            {
                media.SetValue("umbracoFile", newSrc);
            }
        }

        /// <summary>
        /// Saves the media item while suppressing the saving handler and forcing
        /// the saved handler to create a snapshot for the restored file
        /// </summary>
        /// <param name="media">The media<see cref="IMedia"/></param>
        private void SaveMediaWithSnapshotBypass(IMedia media)
        {
            SnapshotMediaSavingHandler.SuppressedMediaIds.TryAdd(media.Id, 0);
            SnapshotMediaSavingHandler.ForceSnapshotMediaIds.TryAdd(media.Id, 0);
            _mediaService.Save(media);
        }

        /// <summary>
        /// The TimestampPattern
        /// </summary>
        /// <returns>The <see cref="Regex"/></returns>
        [GeneratedRegex(@"^\d{8}_\d{6}_")]
        private static partial Regex TimestampPattern();

        /// <summary>
        /// The StripTimestampFromFilename
        /// </summary>
        /// <param name="filename">The filename<see cref="string"/></param>
        /// <returns>The <see cref="string"/></returns>
        private static string StripTimestampFromFilename(string filename)
        {
            var match = TimestampPattern().Match(filename);
            return match.Success ? filename[match.Length..] : filename;
        }

        /// <summary>
        /// The IsImageFile
        /// </summary>
        /// <param name="filename">The filename<see cref="string"/></param>
        /// <param name="contentType">The contentType<see cref="string?"/></param>
        /// <returns>The <see cref="bool"/></returns>
        private static bool IsImageFile(string filename, string? contentType)
        {
            var imageExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg" };
            var extension = Path.GetExtension(filename).ToLowerInvariant();

            var isImageExtension = imageExtensions.Contains(extension);
            var isImageContentType = contentType?.StartsWith("image/", StringComparison.OrdinalIgnoreCase) ?? false;

            return isImageExtension || isImageContentType;
        }

        /// <summary>
        /// The GetImageDimensions
        /// </summary>
        /// <param name="stream">The stream<see cref="Stream"/></param>
        /// <returns>The <see cref="(int Width, int Height)?"/></returns>
        private (int Width, int Height)? GetImageDimensions(Stream stream)
        {
            try
            {
                using var image = Image.Load(stream);
                return (image.Width, image.Height);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Unable to read image dimensions");
                return null;
            }
        }
    }

}
