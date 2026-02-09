namespace UmbracoMediaSnapshot.Core.Controllers
{
    using Azure;
    using Azure.Storage.Blobs;
    using Azure.Storage.Blobs.Models;
    using Azure.Storage.Sas;
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.Extensions.Configuration;
    using Microsoft.Extensions.Options;
    using SixLabors.ImageSharp;
    using System.Text.Json;
    using Umbraco.Cms.Api.Management.Controllers;
    using Umbraco.Cms.Api.Management.Routing;
    using Umbraco.Cms.Core.Services;
    using UmbracoMediaSnapshot.Core.Configuration;

    /// <summary>
    /// Defines the <see cref="SnapshotApiController" />
    /// </summary>
    [VersionedApiBackOfficeRoute("snapshot")]
    [ApiExplorerSettings(GroupName = "Snapshots")]
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
        /// Initializes a new instance of the <see cref="SnapshotApiController"/> class.
        /// </summary>
        /// <param name="configuration">The configuration<see cref="IConfiguration"/></param>
        /// <param name="mediaService">The mediaService<see cref="IMediaService"/></param>
        /// <param name="settings">The settings<see cref="IOptions{MediaSnapshotSettings}"/></param>
        /// <param name="logger">The logger<see cref="ILogger{SnapshotApiController}"/></param>
        public SnapshotApiController(IConfiguration configuration, IMediaService mediaService, IOptions<MediaSnapshotSettings> settings, ILogger<SnapshotApiController> logger)
        {
            _configuration = configuration;
            _mediaService = mediaService;
            _settings = settings.Value;
            _logger = logger;
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

                var connectionString = _configuration.GetValue<string>("Umbraco:Storage:AzureBlob:Media:ConnectionString");
                var serviceClient = new BlobServiceClient(connectionString);
                var snapshotContainer = serviceClient.GetBlobContainerClient("umbraco-snapshots");

                if (!await snapshotContainer.ExistsAsync()) return Ok(Enumerable.Empty<SnapshotVersionModel>());

                var versions = new List<SnapshotVersionModel>();
                var prefix = folderPath.EndsWith("/") ? folderPath : folderPath + "/";

                await foreach (var blobItem in snapshotContainer.GetBlobsAsync(prefix: prefix, traits: BlobTraits.Metadata))
                {
                    var blobClient = snapshotContainer.GetBlobClient(blobItem.Name);

                    // Generate a temporary SAS link (valid for 1 hour)
                    var sasUrl = blobClient.GenerateSasUri(BlobSasPermissions.Read, DateTimeOffset.UtcNow.AddHours(_settings.SasTokenExpirationHours));

                    versions.Add(new SnapshotVersionModel
                    {
                        Name = Path.GetFileName(blobItem.Name),
                        Date = blobItem.Properties.LastModified?.DateTime ?? DateTime.MinValue,
                        Size = blobItem.Properties.ContentLength ?? 0,
                        Url = sasUrl.ToString(),
                        Uploader = blobItem.Metadata.ContainsKey("UploaderName") ? blobItem.Metadata["UploaderName"] : "Unknown",
                        IsRestored = blobItem.Metadata.ContainsKey("IsRestored") && blobItem.Metadata["IsRestored"] == "true",
                        RestoredDate = blobItem.Metadata.ContainsKey("RestoredDate")
                            ? DateTime.Parse(blobItem.Metadata["RestoredDate"])
                            : null,
                        RestoredFrom = blobItem.Metadata.ContainsKey("RestoredFrom") ? blobItem.Metadata["RestoredFrom"] : null
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
        /// Restores a snapshot version as the current media file
        /// </summary>
        /// <param name="request">The restore request containing mediaKey and snapshotName</param>
        /// <returns>The <see cref="Task{IActionResult}"/></returns>
        [HttpPost("restore")]
        [ProducesResponseType(typeof(RestoreResultModel), 200)]
        [ProducesResponseType(typeof(ProblemDetails), 400)]
        [ProducesResponseType(typeof(ProblemDetails), 500)]
        public async Task<IActionResult> RestoreSnapshot([FromBody] RestoreSnapshotRequest request)
        {
            try
            {
                var media = _mediaService.GetById(request.MediaKey);
                if (media == null) return NotFound("Media item not found");

                var umbracoFileValue = media.GetValue<string>("umbracoFile");
                string? folderPath = ExtractFolderPath(umbracoFileValue);

                if (string.IsNullOrEmpty(folderPath))
                    return BadRequest("Unable to determine media folder path");

                var connectionString = _configuration.GetValue<string>("Umbraco:Storage:AzureBlob:Media:ConnectionString");
                var mediaContainerName = _configuration.GetValue<string>("Umbraco:Storage:AzureBlob:Media:ContainerName") ?? "umbraco";

                var serviceClient = new BlobServiceClient(connectionString);
                var snapshotContainer = serviceClient.GetBlobContainerClient("umbraco-snapshots");
                var mediaContainer = serviceClient.GetBlobContainerClient(mediaContainerName);

                // Get the snapshot blob
                var snapshotBlobPath = $"{folderPath}/{request.SnapshotName}";
                var snapshotBlob = snapshotContainer.GetBlobClient(snapshotBlobPath);

                if (!await snapshotBlob.ExistsAsync())
                    return NotFound("Snapshot file not found");

                // Download the snapshot content
                var downloadResult = await snapshotBlob.DownloadAsync();
                var snapshotProperties = await snapshotBlob.GetPropertiesAsync();

                // Get the current file path for deletion
                var currentFilePath = ExtractFilePath(umbracoFileValue);
                if (string.IsNullOrEmpty(currentFilePath))
                    return BadRequest("Unable to determine current file path");

                var currentMediaBlob = mediaContainer.GetBlobClient(currentFilePath.TrimStart('/'));

                // Determine the new file path (same folder, but with the snapshot's filename)
                var newFilePath = $"media/{folderPath}/{request.SnapshotName}";
                var newMediaBlob = mediaContainer.GetBlobClient(newFilePath);

                // Step 1: Delete the old file if it's different from the restored filename
                if (!currentFilePath.TrimStart('/').Equals(newFilePath, StringComparison.OrdinalIgnoreCase))
                {
                    if (await currentMediaBlob.ExistsAsync())
                    {
                        await currentMediaBlob.DeleteAsync();
                        _logger.LogInformation("Deleted old media file: {OldPath}", currentFilePath);
                    }
                }

                // Step 2: Copy the stream to a MemoryStream so we can read it multiple times
                using var memoryStream = new MemoryStream();
                await downloadResult.Value.Content.CopyToAsync(memoryStream);
                memoryStream.Position = 0;

                // Step 3: Upload the snapshot content to the new location
                await newMediaBlob.UploadAsync(memoryStream, overwrite: true);

                // Step 4: Set the content type
                if (!string.IsNullOrEmpty(snapshotProperties.Value.ContentType))
                {
                    await newMediaBlob.SetHttpHeadersAsync(new BlobHttpHeaders
                    {
                        ContentType = snapshotProperties.Value.ContentType
                    });
                }

                // Step 5: Set metadata on the restored file
                var metadata = new Dictionary<string, string>
                {
                    { "RestoredFrom", request.SnapshotName },
                    { "RestoredDate", DateTime.UtcNow.ToString("o") },
                    { "IsRestored", "true" }
                };

                if (snapshotProperties.Value.Metadata.ContainsKey("UploaderName"))
                    metadata["OriginalUploader"] = snapshotProperties.Value.Metadata["UploaderName"];

                await newMediaBlob.SetMetadataAsync(metadata);

                // Step 6: Update the umbracoFile value
                var newSrc = $"/media/{folderPath}/{request.SnapshotName}";
                var isImage = IsImageFile(request.SnapshotName, snapshotProperties.Value.ContentType);
                
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

                // Step 7: Update file size
                var fileSize = snapshotProperties.Value.ContentLength;
                media.SetValue("umbracoBytes", fileSize);

                // Step 8: Update image dimensions if this is an image file
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

                // Step 9: Save the media item - this triggers MediaSavedNotification and creates a new snapshot
                _mediaService.Save(media);

                _logger.LogInformation("Successfully restored snapshot {SnapshotName} for media {MediaKey}. New path: {NewPath}",
                    request.SnapshotName, request.MediaKey, newSrc);

                return Ok(new RestoreResultModel
                {
                    Success = true,
                    Message = $"Successfully restored version: {request.SnapshotName}",
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
        /// Extracts the full file path from umbracoFile value
        /// </summary>
        /// <param name="value">The umbracoFile JSON or path</param>
        /// <returns>The full file path</returns>
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
        /// Determines if the file is an image based on extension and content type
        /// </summary>
        /// <param name="filename">The filename</param>
        /// <param name="contentType">The content type</param>
        /// <returns>True if the file is an image</returns>
        private bool IsImageFile(string filename, string? contentType)
        {
            var imageExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg" };
            var extension = Path.GetExtension(filename).ToLowerInvariant();

            var isImageExtension = imageExtensions.Contains(extension);
            var isImageContentType = contentType?.StartsWith("image/", StringComparison.OrdinalIgnoreCase) ?? false;

            return isImageExtension || isImageContentType;
        }

        /// <summary>
        /// Gets image dimensions from a stream
        /// </summary>
        /// <param name="stream">The image stream</param>
        /// <returns>Image dimensions or null if unable to read</returns>
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

    /// <summary>
    /// Defines the <see cref="SnapshotVersionModel" />
    /// </summary>
    public class SnapshotVersionModel
    {
        /// <summary>
        /// Gets or sets the Name
        /// </summary>
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Gets or sets the Date
        /// </summary>
        public DateTime Date { get; set; }

        /// <summary>
        /// Gets or sets the Size
        /// </summary>
        public long Size { get; set; }

        /// <summary>
        /// Gets or sets the Url
        /// </summary>
        public string Url { get; set; } = string.Empty;

        /// <summary>
        /// Gets or sets the Uploader
        /// </summary>
        public string Uploader { get; set; } = string.Empty;

        /// <summary>
        /// Gets or sets a value indicating whether IsRestored
        /// Gets or sets whether this is a restored version
        /// </summary>
        public bool IsRestored { get; set; }

        /// <summary>
        /// Gets or sets the date when this was restored (if applicable)
        /// </summary>
        public DateTime? RestoredDate { get; set; }

        /// <summary>
        /// Gets or sets the original snapshot this was restored from
        /// </summary>
        public string? RestoredFrom { get; set; }
    }

    /// <summary>
    /// Request model for restoring a snapshot
    /// </summary>
    public class RestoreSnapshotRequest
    {
        /// <summary>
        /// Gets or sets the MediaKey
        /// </summary>
        public Guid MediaKey { get; set; }

        /// <summary>
        /// Gets or sets the SnapshotName (filename in the snapshots container)
        /// </summary>
        public string SnapshotName { get; set; } = string.Empty;
    }

    /// <summary>
    /// Result model for restore operation
    /// </summary>
    public class RestoreResultModel
    {
        /// <summary>
        /// Gets or sets a value indicating whether Success
        /// Gets or sets whether the restore was successful
        /// </summary>
        public bool Success { get; set; }

        /// <summary>
        /// Gets or sets the result message
        /// </summary>
        public string Message { get; set; } = string.Empty;

        /// <summary>
        /// Gets or sets the RestoredDate
        /// Gets or sets when the restore occurred
        /// </summary>
        public DateTime RestoredDate { get; set; }
    }
}
