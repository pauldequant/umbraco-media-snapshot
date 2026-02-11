namespace UmbracoMediaSnapshot.Core.Controllers
{
    using Azure;
    using Azure.Storage.Blobs;
    using Azure.Storage.Blobs.Models;
    using Azure.Storage.Sas;
    using Configuration;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.Extensions.Configuration;
    using Microsoft.Extensions.Options;
    using Models;
    using NotificationHandlers;
    using SixLabors.ImageSharp;
    using System.Text.Json;
    using Umbraco.Cms.Api.Management.Controllers;
    using Umbraco.Cms.Api.Management.Routing;
    using Umbraco.Cms.Core.Services;

    /// <summary>
    /// Defines the <see cref="SnapshotApiController" />
    /// </summary>
    [VersionedApiBackOfficeRoute("snapshot")]
    [ApiExplorerSettings(GroupName = "Snapshots")]
    [Authorize(Policy = Umbraco.Cms.Web.Common.Authorization.AuthorizationPolicies.SectionAccessMedia)]
    public class SnapshotApiController : ManagementApiControllerBase
    {
        /// <summary>
        /// Defines the _configuration
        /// </summary>
        private readonly IConfiguration _configuration;

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
        /// Defines the _blobServiceClient
        /// </summary>
        private readonly BlobServiceClient _blobServiceClient;

        /// <summary>
        /// Initializes a new instance of the <see cref="SnapshotApiController"/> class.
        /// </summary>
        /// <param name="configuration">The configuration<see cref="IConfiguration"/></param>
        /// <param name="mediaService">The mediaService<see cref="IMediaService"/></param>
        /// <param name="settings">The settings<see cref="IOptions{MediaSnapshotSettings}"/></param>
        /// <param name="logger">The logger<see cref="ILogger{SnapshotApiController}"/></param>
        /// <param name="blobServiceClient">The blobServiceClient<see cref="BlobServiceClient"/></param>
        public SnapshotApiController(IConfiguration configuration, IMediaService mediaService, IOptions<MediaSnapshotSettings> settings, ILogger<SnapshotApiController> logger, BlobServiceClient blobServiceClient)
        {
            _configuration = configuration;
            _mediaService = mediaService;
            _settings = settings.Value;
            _logger = logger;
            _blobServiceClient = blobServiceClient;
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
                string? folderPath = ExtractFolderPath(umbracoFileValue);

                if (string.IsNullOrEmpty(folderPath)) return Ok(Enumerable.Empty<SnapshotVersionModel>());

                var snapshotContainer = _blobServiceClient.GetBlobContainerClient("umbraco-snapshots");

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
                string? folderPath = ExtractFolderPath(umbracoFileValue);

                if (string.IsNullOrEmpty(folderPath))
                    return BadRequest("Unable to determine media folder path");

                var mediaContainerName = _configuration.GetValue<string>("Umbraco:Storage:AzureBlob:Media:ContainerName") ?? "umbraco";

                var snapshotContainer = _blobServiceClient.GetBlobContainerClient("umbraco-snapshots");
                var mediaContainer = _blobServiceClient.GetBlobContainerClient(mediaContainerName);

                // Get the snapshot blob to restore from
                var snapshotBlobPath = $"{folderPath}/{request.SnapshotName}";
                var snapshotBlob = snapshotContainer.GetBlobClient(snapshotBlobPath);

                if (!await snapshotBlob.ExistsAsync())
                    return NotFound("Snapshot file not found");

                // Download the snapshot content
                var downloadResult = await snapshotBlob.DownloadAsync();
                var snapshotProperties = await snapshotBlob.GetPropertiesAsync();

                // Get the current file path
                var currentFilePath = ExtractFilePath(umbracoFileValue);
                if (string.IsNullOrEmpty(currentFilePath))
                    return BadRequest("Unable to determine current file path");

                var currentMediaBlobPath = currentFilePath.TrimStart('/');
                var currentMediaBlob = mediaContainer.GetBlobClient(currentMediaBlobPath);

                // ── Restore the selected snapshot into the media container ──
                // Strip the timestamp from the snapshot filename to get the original filename
                // Format: 20260209_155612_sample-document.pdf -> sample-document.pdf
                var originalFileName = StripTimestampFromFilename(request.SnapshotName);

                // Determine the new file path (same folder, but with the original filename without timestamp)
                var newFilePath = $"media/{folderPath}/{originalFileName}";
                var newMediaBlob = mediaContainer.GetBlobClient(newFilePath);

                // Delete the old file if it's at a different path than the restored one
                if (!currentMediaBlobPath.Equals(newFilePath, StringComparison.OrdinalIgnoreCase))
                {
                    if (await currentMediaBlob.ExistsAsync())
                    {
                        await currentMediaBlob.DeleteAsync();
                        _logger.LogInformation("Deleted old media file: {OldPath}", currentFilePath);
                    }
                }

                // Copy the stream to a MemoryStream so we can read it multiple times
                using var memoryStream = new MemoryStream();
                await downloadResult.Value.Content.CopyToAsync(memoryStream);
                memoryStream.Position = 0;

                // Upload the snapshot content to the media location
                await newMediaBlob.UploadAsync(memoryStream, overwrite: true);

                // Set the content type
                if (!string.IsNullOrEmpty(snapshotProperties.Value.ContentType))
                {
                    await newMediaBlob.SetHttpHeadersAsync(new BlobHttpHeaders
                    {
                        ContentType = snapshotProperties.Value.ContentType
                    });
                }

                // Mark the restored snapshot blob with restore metadata
                var restoredSnapshotMeta = new Dictionary<string, string>(snapshotProperties.Value.Metadata)
                {
                    ["RestoredFrom"] = request.SnapshotName,
                    ["RestoredDate"] = DateTime.UtcNow.ToString("O")
                };
                await snapshotBlob.SetMetadataAsync(restoredSnapshotMeta);

                // Update the umbracoFile value on the media item
                var newSrc = $"/media/{folderPath}/{originalFileName}";
                var isImage = IsImageFile(originalFileName, snapshotProperties.Value.ContentType);

                if (umbracoFileValue?.Trim().StartsWith("{") == true)
                {
                    // This is JSON (image file) - preserve all properties, only change src
                    using var jsonDoc = JsonDocument.Parse(umbracoFileValue);
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
                            // Preserve all other properties (crops, focalPoint, etc.)
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
                    // This is a plain string path (non-image file) - replace the entire value
                    media.SetValue("umbracoFile", newSrc);
                }

                // Update file size
                var fileSize = snapshotProperties.Value.ContentLength;
                media.SetValue("umbracoBytes", fileSize);

                // Update image dimensions if this is an image file
                if (isImage)
                {
                    memoryStream.Position = 0;
                    var dimensions = GetImageDimensions(memoryStream);

                    if (dimensions.HasValue)
                    {
                        media.SetValue("umbracoWidth", dimensions.Value.Width);
                        media.SetValue("umbracoHeight", dimensions.Value.Height);

                        _logger.LogInformation("Updated image dimensions for media {MediaKey}: {Width}x{Height}",
                            request.MediaKey, dimensions.Value.Width, dimensions.Value.Height);
                    }
                }

                // Suppress the saving handler so it does not create a duplicate snapshot
                SnapshotMediaSavingHandler.SuppressedMediaIds.TryAdd(media.Id, 0);

                // Force the saved handler to create a snapshot even if the file
                // matches an existing one (the restored file IS a previous snapshot)
                SnapshotMediaSavingHandler.ForceSnapshotMediaIds.TryAdd(media.Id, 0);

                // Save the media item
                _mediaService.Save(media);

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
        /// The StripTimestampFromFilename
        /// </summary>
        /// <param name="filename">The filename<see cref="string"/></param>
        /// <returns>The <see cref="string"/></returns>
        private string StripTimestampFromFilename(string filename)
        {
            // Pattern: YYYYMMDD_HHMMSS_originalfilename.ext
            // We need to remove the first 16 characters (8 for date + 1 underscore + 6 for time + 1 underscore)

            // Use regex to match the timestamp pattern at the start
            var timestampPattern = @"^\d{8}_\d{6}_";
            var match = System.Text.RegularExpressions.Regex.Match(filename, timestampPattern);

            if (match.Success)
            {
                return filename.Substring(match.Length);
            }

            // If no timestamp found, return the original filename
            return filename;
        }

        /// <summary>
        /// The ExtractFolderPath
        /// </summary>
        /// <param name="value">The value<see cref="string?"/></param>
        /// <returns>The <see cref="string?"/></returns>
        private string? ExtractFolderPath(string? value)
        {
            if (string.IsNullOrEmpty(value)) return null;
            if (value.Trim().StartsWith("{"))
            {
                var json = JsonSerializer.Deserialize<JsonElement>(value);
                value = json.TryGetProperty("src", out var src) ? src.GetString() ?? "" : "";
            }
            var parts = value.TrimStart('/').Split('/').ToList();
            if (parts.Count > 1 && parts[0].Equals("media", StringComparison.OrdinalIgnoreCase)) return parts[1];
            return parts.FirstOrDefault();
        }

        /// <summary>
        /// The ExtractFilePath
        /// </summary>
        /// <param name="value">The value<see cref="string?"/></param>
        /// <returns>The <see cref="string?"/></returns>
        private string? ExtractFilePath(string? value)
        {
            if (string.IsNullOrEmpty(value)) return null;

            if (value.Trim().StartsWith("{"))
            {
                var json = JsonSerializer.Deserialize<JsonElement>(value);
                return json.TryGetProperty("src", out var src) ? src.GetString() : null;
            }

            return value;
        }

        /// <summary>
        /// The IsImageFile
        /// </summary>
        /// <param name="filename">The filename<see cref="string"/></param>
        /// <param name="contentType">The contentType<see cref="string?"/></param>
        /// <returns>The <see cref="bool"/></returns>
        private bool IsImageFile(string filename, string? contentType)
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
