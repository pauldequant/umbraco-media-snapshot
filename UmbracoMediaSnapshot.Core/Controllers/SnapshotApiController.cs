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
    using System.Collections.Concurrent;
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
        /// Tracks media items currently being restored. Prevents concurrent restore
        /// operations on the same media item from different editors or browser tabs.
        /// </summary>
        private static readonly ConcurrentDictionary<Guid, byte> _activeRestores = new();

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
        /// Defines the _statsCache
        /// </summary>
        private readonly ISnapshotStatsCache _statsCache;

        /// <summary>
        /// Initializes a new instance of the <see cref="SnapshotApiController"/> class.
        /// </summary>
        /// <param name="mediaService">The mediaService<see cref="IMediaService"/></param>
        /// <param name="settings">The settings<see cref="IOptions{MediaSnapshotSettings}"/></param>
        /// <param name="logger">The logger<see cref="ILogger{SnapshotApiController}"/></param>
        /// <param name="blobService">The blobService<see cref="ISnapshotBlobService"/></param>
        /// <param name="statsCache">The statsCache<see cref="ISnapshotStatsCache"/></param>
        public SnapshotApiController(IMediaService mediaService, IOptions<MediaSnapshotSettings> settings, ILogger<SnapshotApiController> logger, ISnapshotBlobService blobService, ISnapshotStatsCache statsCache)
        {
            _mediaService = mediaService;
            _settings = settings.Value;
            _logger = logger;
            _blobService = blobService;
            _statsCache = statsCache;
        }

        /// <summary>
        /// The GetVersions
        /// </summary>
        /// <param name="mediaKey">The mediaKey<see cref="Guid"/></param>
        /// <param name="page">The 1-based page number (default: 1)</param>
        /// <param name="pageSize">The number of items per page (default: 10, max: 50)</param>
        /// <param name="cancellationToken">The cancellationToken<see cref="CancellationToken"/></param>
        /// <returns>The <see cref="Task{IActionResult}"/></returns>
        [HttpGet("versions/{mediaKey:guid}")]
        [ProducesResponseType(typeof(PagedSnapshotResponse), 200)]
        [ProducesResponseType(typeof(ProblemDetails), 500)]
        public async Task<IActionResult> GetVersions(Guid mediaKey, [FromQuery] int page = 1, [FromQuery] int pageSize = 10, CancellationToken cancellationToken = default)
        {
            try
            {
                // Clamp inputs
                page = Math.Max(1, page);
                pageSize = Math.Clamp(pageSize, 1, 50);

                var media = _mediaService.GetById(mediaKey);
                if (media == null) return NotFound();

                var umbracoFileValue = media.GetValue<string>("umbracoFile");
                string? folderPath = _blobService.ExtractFolderPath(umbracoFileValue);

                if (string.IsNullOrEmpty(folderPath)) return Ok(new PagedSnapshotResponse { Page = page, PageSize = pageSize });

                var snapshotContainer = _blobService.GetSnapshotContainer();

                if (!await snapshotContainer.ExistsAsync(cancellationToken)) return Ok(new PagedSnapshotResponse { Page = page, PageSize = pageSize });

                // Collect lightweight blob info first (no SAS generation)
                var allBlobs = new List<(Azure.Storage.Blobs.Models.BlobItem Blob, DateTime UploadDate)>();
                var prefix = folderPath.EndsWith("/") ? folderPath : folderPath + "/";

                await foreach (var blobItem in snapshotContainer.GetBlobsAsync(prefix: prefix, traits: BlobTraits.Metadata, cancellationToken: cancellationToken))
                {
                    DateTime uploadDate = blobItem.Properties.LastModified?.DateTime ?? DateTime.MinValue;
                    if (blobItem.Metadata.TryGetValue("UploadDate", out var uploadDateStr)
                        && DateTime.TryParse(uploadDateStr, null, System.Globalization.DateTimeStyles.RoundtripKind, out var parsedDate))
                    {
                        uploadDate = parsedDate;
                    }

                    allBlobs.Add((blobItem, uploadDate));
                }

                // Sort descending by date, then page
                var sorted = allBlobs.OrderByDescending(b => b.UploadDate).ToList();
                var totalCount = sorted.Count;
                var paged = sorted.Skip((page - 1) * pageSize).Take(pageSize);

                // Compute summary stats from ALL blobs (before paging)
                var totalSizeBytes = allBlobs.Sum(b => b.Blob.Properties.ContentLength ?? 0);
                var oldestDate = allBlobs.Count > 0 ? allBlobs.Min(b => b.UploadDate) : (DateTime?)null;
                var newestDate = allBlobs.Count > 0 ? allBlobs.Max(b => b.UploadDate) : (DateTime?)null;
                var uniqueUploaders = allBlobs
                    .Select(b => b.Blob.Metadata.TryGetValue("UploaderName", out var u) ? u : null)
                    .Where(u => u is not null)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .Count();

                // Only generate SAS URLs for the visible page
                var versions = new List<SnapshotVersionModel>();
                foreach (var (blobItem, uploadDate) in paged)
                {
                    var blobClient = snapshotContainer.GetBlobClient(blobItem.Name);
                    var sasUrl = blobClient.GenerateSasUri(BlobSasPermissions.Read, DateTimeOffset.UtcNow.AddHours(_settings.SasTokenExpirationHours));

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
                        RestoredFrom = blobItem.Metadata.TryGetValue("RestoredFrom", out var restoredFrom) ? restoredFrom : null,
                        Note = blobItem.Metadata.TryGetValue("SnapshotNote", out var note) ? note : null
                    });
                }

                return Ok(new PagedSnapshotResponse
                {
                    Items = versions,
                    TotalCount = totalCount,
                    Page = page,
                    PageSize = pageSize,
                    TotalPages = pageSize > 0 ? (int)Math.Ceiling((double)totalCount / pageSize) : 0,
                    TotalSizeBytes = totalSizeBytes,
                    OldestDate = oldestDate,
                    NewestDate = newestDate,
                    UniqueUploaderCount = uniqueUploaders
                });
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                _logger.LogWarning("Container or blob not found for media {MediaKey}", mediaKey);
                return Ok(new PagedSnapshotResponse { Page = page, PageSize = pageSize });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving snapshots for media {MediaKey}", mediaKey);
                return Problem("Failed to retrieve media snapshots. Please check your Azure Blob Storage configuration.");
            }
        }

        /// <summary>
        /// Restores a specific snapshot version as the current media file.
        /// Only one restore per media item is allowed at a time — concurrent
        /// requests for the same MediaKey receive HTTP 409 Conflict.
        /// </summary>
        /// <param name="request">The request<see cref="RestoreSnapshotRequest"/></param>
        /// <param name="cancellationToken">The cancellationToken<see cref="CancellationToken"/></param>
        /// <returns>The <see cref="Task{IActionResult}"/></returns>
        [HttpPost("restore")]
        [ProducesResponseType(typeof(RestoreResultModel), 200)]
        [ProducesResponseType(typeof(ProblemDetails), 400)]
        [ProducesResponseType(typeof(ProblemDetails), 409)]
        [ProducesResponseType(typeof(ProblemDetails), 500)]
        public async Task<IActionResult> RestoreSnapshot([FromBody] RestoreSnapshotRequest request, CancellationToken cancellationToken)
        {
            // Acquire a per-media-item lock — reject if another restore is already in progress
            if (!_activeRestores.TryAdd(request.MediaKey, 0))
            {
                _logger.LogWarning("Restore already in progress for media {MediaKey}, rejecting concurrent request", request.MediaKey);
                return Conflict(new ProblemDetails
                {
                    Title = "Restore in progress",
                    Detail = "Another restore operation is already in progress for this media item. Please wait and try again.",
                    Status = 409
                });
            }

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

                if (!await snapshotBlob.ExistsAsync(cancellationToken))
                    return NotFound("Snapshot file not found");

                var downloadResult = await snapshotBlob.DownloadAsync(cancellationToken);
                var snapshotProperties = await snapshotBlob.GetPropertiesAsync(cancellationToken: cancellationToken);

                // Buffer the content so it can be read multiple times (upload + image dimensions)
                using var memoryStream = new MemoryStream();
                await downloadResult.Value.Content.CopyToAsync(memoryStream, cancellationToken);
                memoryStream.Position = 0;

                // Replace the media blob in Azure storage
                var originalFileName = StripTimestampFromFilename(request.SnapshotName);
                var newFilePath = $"media/{folderPath}/{originalFileName}";

                await ReplaceMediaBlobAsync(mediaContainer, currentFilePath.TrimStart('/'), newFilePath, memoryStream, snapshotProperties.Value, cancellationToken);

                // Tag the snapshot blob with restore metadata
                await MarkSnapshotAsRestoredAsync(snapshotBlob, snapshotProperties.Value, request.SnapshotName, cancellationToken);

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
            finally
            {
                // Always release the lock, even on failure
                _activeRestores.TryRemove(request.MediaKey, out _);
            }
        }

        /// <summary>
        /// Returns aggregated storage statistics for all snapshots
        /// in the umbraco-snapshots container, used by the dashboard
        /// </summary>
        /// <param name="cancellationToken">The cancellationToken<see cref="CancellationToken"/></param>
        /// <returns>The <see cref="Task{IActionResult}"/></returns>
        [HttpGet("storage-stats")]
        [ProducesResponseType(typeof(SnapshotStorageModel), 200)]
        [ProducesResponseType(typeof(ProblemDetails), 500)]
        public async Task<IActionResult> GetStorageStats(CancellationToken cancellationToken)
        {
            try
            {
                var stats = await _statsCache.GetOrComputeAsync(cancellationToken);

                if (stats.TotalSnapshotCount == 0)
                {
                    return Ok(new SnapshotStorageModel
                    {
                        Settings = BuildSettingsSummary()
                    });
                }

                var topConsumers = stats.Folders
                    .OrderByDescending(kvp => kvp.Value.Size)
                    .Take(10)
                    .Select(kvp => new SnapshotFolderSummary
                    {
                        FolderName = kvp.Key,
                        SnapshotCount = kvp.Value.Count,
                        TotalSizeBytes = kvp.Value.Size,
                        TotalSizeFormatted = FormatBytes(kvp.Value.Size),
                        LatestSnapshotDate = kvp.Value.Latest,
                        OldestSnapshotDate = kvp.Value.Oldest
                    })
                    .ToList();

                // Resolve each folder to its owning media item for backoffice linking
                ResolveMediaItems(topConsumers);

                return Ok(new SnapshotStorageModel
                {
                    TotalSnapshotCount = stats.TotalSnapshotCount,
                    TotalSizeBytes = stats.TotalSizeBytes,
                    TotalSizeFormatted = FormatBytes(stats.TotalSizeBytes),
                    MediaItemCount = stats.MediaItemCount,
                    TopConsumers = topConsumers,
                    Settings = BuildSettingsSummary()
                });
            }
            catch (RequestFailedException ex)
            {
                _logger.LogError(ex, "Azure storage error while retrieving snapshot storage stats");
                return Problem("Failed to retrieve storage statistics. Please check your Azure Blob Storage configuration.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving snapshot storage stats");
                return Problem("An unexpected error occurred while retrieving storage statistics.");
            }
        }

        /// <summary>
        /// Resolves snapshot folder names back to Umbraco media items by searching
        /// for media whose umbracoFile path contains the folder name.
        /// Only examines the specific folders needed rather than loading all media.
        /// </summary>
        /// <param name="folders">The folders<see cref="List{SnapshotFolderSummary}"/></param>
        private void ResolveMediaItems(List<SnapshotFolderSummary> folders)
        {
            // Only scan media once, paginated in manageable chunks, and stop early
            // when all folders have been resolved.
            var unresolvedFolders = new HashSet<string>(
                folders.Select(f => f.FolderName),
                StringComparer.OrdinalIgnoreCase);

            var folderToSummary = folders.ToDictionary(f => f.FolderName, StringComparer.OrdinalIgnoreCase);

            const int pageSize = 500;

            foreach (var root in _mediaService.GetRootMedia() ?? [])
            {
                // Check the root itself
                TryResolve(root, unresolvedFolders, folderToSummary);
                if (unresolvedFolders.Count == 0) return;

                // Page through descendants in chunks
                int pageIndex = 0;
                long total;
                do
                {
                    var descendants = _mediaService.GetPagedDescendants(root.Id, pageIndex, pageSize, out total, null);
                    foreach (var media in descendants)
                    {
                        if (!_blobService.IsTargetMediaType(media.ContentType.Alias)) continue;

                        TryResolve(media, unresolvedFolders, folderToSummary);
                        if (unresolvedFolders.Count == 0) return;
                    }

                    pageIndex++;
                } while ((long)pageIndex * pageSize < total);
            }
        }

        /// <summary>
        /// Attempts to match a media item's folder path against the unresolved folder set
        /// </summary>
        /// <param name="media">The media<see cref="IMedia"/></param>
        /// <param name="unresolvedFolders">The unresolvedFolders<see cref="HashSet{string}"/></param>
        /// <param name="folderToSummary">The folderToSummary<see cref="Dictionary{string, SnapshotFolderSummary}"/></param>
        private void TryResolve(IMedia media, HashSet<string> unresolvedFolders, Dictionary<string, SnapshotFolderSummary> folderToSummary)
        {
            var umbracoFileValue = media.GetValue<string>("umbracoFile");
            var folderPath = _blobService.ExtractFolderPath(umbracoFileValue);

            if (!string.IsNullOrEmpty(folderPath)
                && unresolvedFolders.Remove(folderPath)
                && folderToSummary.TryGetValue(folderPath, out var summary))
            {
                summary.MediaKey = media.Key;
                summary.MediaName = media.Name;
            }
        }

        /// <summary>
        /// Builds a settings summary from the current configuration
        /// </summary>
        /// <returns>The <see cref="SnapshotSettingsSummary"/></returns>
        private SnapshotSettingsSummary BuildSettingsSummary() => new()
        {
            MaxSnapshotsPerMedia = _settings.MaxSnapshotsPerMedia,
            MaxSnapshotAgeDays = _settings.MaxSnapshotAgeDays,
            EnableAutomaticCleanup = _settings.EnableAutomaticCleanup,
            CleanupIntervalMinutes = _settings.CleanupIntervalMinutes,
            SasTokenExpirationHours = _settings.SasTokenExpirationHours,
            TrackedMediaTypes = [.. _blobService.TargetMediaTypes.OrderBy(t => t)]
        };

        /// <summary>
        /// Formats a byte count into a human-readable string
        /// </summary>
        /// <param name="bytes">The bytes<see cref="long"/></param>
        /// <returns>The <see cref="string"/></returns>
        private static string FormatBytes(long bytes)
        {
            if (bytes == 0) return "0 B";
            string[] units = ["B", "KB", "MB", "GB", "TB"];
            int i = (int)Math.Floor(Math.Log(bytes, 1024));
            i = Math.Min(i, units.Length - 1);
            return $"{bytes / Math.Pow(1024, i):F1} {units[i]}";
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
        /// <param name="cancellationToken">The cancellationToken<see cref="CancellationToken"/></param>
        /// <returns>The <see cref="Task"/></returns>
        private async Task ReplaceMediaBlobAsync(
            BlobContainerClient mediaContainer,
            string currentBlobPath,
            string newBlobPath,
            MemoryStream content,
            BlobProperties snapshotProperties,
            CancellationToken cancellationToken)
        {
            if (!currentBlobPath.Equals(newBlobPath, StringComparison.OrdinalIgnoreCase))
            {
                var currentBlob = mediaContainer.GetBlobClient(currentBlobPath);
                if (await currentBlob.ExistsAsync(cancellationToken))
                {
                    await currentBlob.DeleteAsync(cancellationToken: cancellationToken);
                    _logger.LogInformation("Deleted old media file: {OldPath}", currentBlobPath);
                }
            }

            var newBlob = mediaContainer.GetBlobClient(newBlobPath);
            content.Position = 0;
            await newBlob.UploadAsync(content, overwrite: true, cancellationToken);

            if (!string.IsNullOrEmpty(snapshotProperties.ContentType))
            {
                await newBlob.SetHttpHeadersAsync(new BlobHttpHeaders
                {
                    ContentType = snapshotProperties.ContentType
                }, cancellationToken: cancellationToken);
            }
        }

        /// <summary>
        /// Tags the snapshot blob with restore metadata so the UI can display restore history
        /// </summary>
        /// <param name="snapshotBlob">The snapshotBlob<see cref="BlobClient"/></param>
        /// <param name="snapshotProperties">The snapshotProperties<see cref="BlobProperties"/></param>
        /// <param name="snapshotName">The snapshotName<see cref="string"/></param>
        /// <param name="cancellationToken">The cancellationToken<see cref="CancellationToken"/></param>
        /// <returns>The <see cref="Task"/></returns>
        private static async Task MarkSnapshotAsRestoredAsync(
            BlobClient snapshotBlob,
            BlobProperties snapshotProperties,
            string snapshotName,
            CancellationToken cancellationToken)
        {
            var restoredMeta = new Dictionary<string, string>(snapshotProperties.Metadata)
            {
                ["RestoredFrom"] = snapshotName,
                ["RestoredDate"] = DateTime.UtcNow.ToString("O")
            };
            await snapshotBlob.SetMetadataAsync(restoredMeta, cancellationToken: cancellationToken);
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

        /// <summary>
        /// Gets a temporary SAS URL for the current (live) media file
        /// so the front-end can display it alongside a snapshot for comparison
        /// </summary>
        /// <param name="mediaKey">The mediaKey<see cref="Guid"/></param>
        /// <param name="cancellationToken">The cancellationToken<see cref="CancellationToken"/></param>
        /// <returns>The <see cref="Task{IActionResult}"/></returns>
        [HttpGet("current/{mediaKey:guid}")]
        [ProducesResponseType(typeof(CurrentMediaModel), 200)]
        [ProducesResponseType(typeof(ProblemDetails), 404)]
        [ProducesResponseType(typeof(ProblemDetails), 500)]
        public async Task<IActionResult> GetCurrentMediaUrl(Guid mediaKey, CancellationToken cancellationToken)
        {
            try
            {
                var media = _mediaService.GetById(mediaKey);
                if (media == null) return NotFound();

                var umbracoFileValue = media.GetValue<string>("umbracoFile");
                string? rawPath = _blobService.GetRawBlobPath(umbracoFileValue);
                if (string.IsNullOrEmpty(rawPath)) return NotFound("No file associated with this media item");

                var mediaContainer = _blobService.GetMediaContainer();
                var blobClient = mediaContainer.GetBlobClient(rawPath);

                if (!await blobClient.ExistsAsync(cancellationToken))
                    return NotFound("Media blob not found in storage");

                var properties = await blobClient.GetPropertiesAsync(cancellationToken: cancellationToken);

                var sasUrl = blobClient.GenerateSasUri(
                    BlobSasPermissions.Read,
                    DateTimeOffset.UtcNow.AddHours(_settings.SasTokenExpirationHours));

                return Ok(new CurrentMediaModel
                {
                    Name = Path.GetFileName(rawPath),
                    Url = sasUrl.ToString(),
                    Size = properties.Value.ContentLength,
                    ContentType = properties.Value.ContentType,
                    LastModified = properties.Value.LastModified.DateTime
                });
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                return NotFound("Media blob not found");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving current media URL for {MediaKey}", mediaKey);
                return Problem("Failed to retrieve current media file");
            }
        }

        /// <summary>
        /// Deletes a single snapshot blob for a media item
        /// </summary>
        /// <param name="request">The request<see cref="DeleteSnapshotRequest"/></param>
        /// <param name="cancellationToken">The cancellationToken<see cref="CancellationToken"/></param>
        /// <returns>The <see cref="Task{IActionResult}"/></returns>
        [HttpPost("delete")]
        [ProducesResponseType(typeof(DeleteResultModel), 200)]
        [ProducesResponseType(typeof(ProblemDetails), 400)]
        [ProducesResponseType(typeof(ProblemDetails), 500)]
        public async Task<IActionResult> DeleteSnapshot([FromBody] DeleteSnapshotRequest request, CancellationToken cancellationToken)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.SnapshotName))
                    return BadRequest("Snapshot name is required");

                if (request.SnapshotName.Contains("..") || request.SnapshotName.Contains('/') || request.SnapshotName.Contains('\\'))
                    return BadRequest("Invalid snapshot name");

                var media = _mediaService.GetById(request.MediaKey);
                if (media == null) return NotFound("Media item not found");

                var umbracoFileValue = media.GetValue<string>("umbracoFile");
                string? folderPath = _blobService.ExtractFolderPath(umbracoFileValue);

                if (string.IsNullOrEmpty(folderPath))
                    return BadRequest("Unable to determine media folder path");

                var snapshotContainer = _blobService.GetSnapshotContainer();
                var snapshotBlobPath = $"{folderPath}/{request.SnapshotName}";
                var snapshotBlob = snapshotContainer.GetBlobClient(snapshotBlobPath);

                if (!await snapshotBlob.ExistsAsync(cancellationToken))
                    return NotFound("Snapshot file not found");

                await snapshotBlob.DeleteAsync(cancellationToken: cancellationToken);

                _logger.LogInformation("Deleted snapshot {SnapshotName} for media {MediaKey}",
                    request.SnapshotName, request.MediaKey);

                return Ok(new DeleteResultModel
                {
                    Success = true,
                    Message = $"Successfully deleted snapshot: {request.SnapshotName}",
                    DeletedCount = 1
                });
            }
            catch (RequestFailedException ex)
            {
                _logger.LogError(ex, "Azure storage error while deleting snapshot {SnapshotName} for media {MediaKey}",
                    request.SnapshotName, request.MediaKey);
                return Problem("Failed to delete snapshot due to storage error");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting snapshot {SnapshotName} for media {MediaKey}",
                    request.SnapshotName, request.MediaKey);
                return Problem("An unexpected error occurred while deleting the snapshot");
            }
        }

        /// <summary>
        /// Deletes multiple snapshot blobs for a media item in one operation
        /// </summary>
        /// <param name="request">The request<see cref="BulkDeleteSnapshotsRequest"/></param>
        /// <param name="cancellationToken">The cancellationToken<see cref="CancellationToken"/></param>
        /// <returns>The <see cref="Task{IActionResult}"/></returns>
        [HttpPost("delete-bulk")]
        [ProducesResponseType(typeof(DeleteResultModel), 200)]
        [ProducesResponseType(typeof(ProblemDetails), 400)]
        [ProducesResponseType(typeof(ProblemDetails), 500)]
        public async Task<IActionResult> BulkDeleteSnapshots([FromBody] BulkDeleteSnapshotsRequest request, CancellationToken cancellationToken)
        {
            try
            {
                if (request.SnapshotNames is not { Count: > 0 })
                    return BadRequest("At least one snapshot name is required");

                // Validate all names before deleting any
                foreach (var name in request.SnapshotNames)
                {
                    if (string.IsNullOrWhiteSpace(name) || name.Contains("..") || name.Contains('/') || name.Contains('\\'))
                        return BadRequest($"Invalid snapshot name: {name}");
                }

                var media = _mediaService.GetById(request.MediaKey);
                if (media == null) return NotFound("Media item not found");

                var umbracoFileValue = media.GetValue<string>("umbracoFile");
                string? folderPath = _blobService.ExtractFolderPath(umbracoFileValue);

                if (string.IsNullOrEmpty(folderPath))
                    return BadRequest("Unable to determine media folder path");

                var snapshotContainer = _blobService.GetSnapshotContainer();
                int deletedCount = 0;

                foreach (var snapshotName in request.SnapshotNames)
                {
                    var snapshotBlobPath = $"{folderPath}/{snapshotName}";
                    var deleted = await snapshotContainer.DeleteBlobIfExistsAsync(snapshotBlobPath, cancellationToken: cancellationToken);

                    if (deleted)
                    {
                        deletedCount++;
                        _logger.LogInformation("Bulk delete: removed snapshot {SnapshotName} for media {MediaKey}",
                            snapshotName, request.MediaKey);
                    }
                    else
                    {
                        _logger.LogWarning("Bulk delete: snapshot {SnapshotName} not found for media {MediaKey}",
                            snapshotName, request.MediaKey);
                    }
                }

                return Ok(new DeleteResultModel
                {
                    Success = true,
                    Message = $"Successfully deleted {deletedCount} of {request.SnapshotNames.Count} snapshot(s)",
                    DeletedCount = deletedCount
                });
            }
            catch (RequestFailedException ex)
            {
                _logger.LogError(ex, "Azure storage error during bulk delete for media {MediaKey}", request.MediaKey);
                return Problem("Failed to delete snapshots due to storage error");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during bulk delete for media {MediaKey}", request.MediaKey);
                return Problem("An unexpected error occurred while deleting snapshots");
            }
        }

        /// <summary>
        /// Updates the note/label on a snapshot blob's metadata
        /// </summary>
        /// <param name="request">The request<see cref="UpdateSnapshotNoteRequest"/></param>
        /// <param name="cancellationToken">The cancellationToken<see cref="CancellationToken"/></param>
        /// <returns>The <see cref="Task{IActionResult}"/></returns>
        [HttpPost("update-note")]
        [ProducesResponseType(200)]
        [ProducesResponseType(typeof(ProblemDetails), 400)]
        [ProducesResponseType(typeof(ProblemDetails), 404)]
        [ProducesResponseType(typeof(ProblemDetails), 500)]
        public async Task<IActionResult> UpdateSnapshotNote([FromBody] UpdateSnapshotNoteRequest request, CancellationToken cancellationToken)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.SnapshotName))
                    return BadRequest("Snapshot name is required");

                if (request.SnapshotName.Contains("..") || request.SnapshotName.Contains('/') || request.SnapshotName.Contains('\\'))
                    return BadRequest("Invalid snapshot name");

                if (request.Note.Length > 500)
                    return BadRequest("Note must be 500 characters or fewer");

                var media = _mediaService.GetById(request.MediaKey);
                if (media == null) return NotFound("Media item not found");

                var umbracoFileValue = media.GetValue<string>("umbracoFile");
                string? folderPath = _blobService.ExtractFolderPath(umbracoFileValue);

                if (string.IsNullOrEmpty(folderPath))
                    return BadRequest("Unable to determine media folder path");

                var snapshotContainer = _blobService.GetSnapshotContainer();
                var snapshotBlobPath = $"{folderPath}/{request.SnapshotName}";
                var snapshotBlob = snapshotContainer.GetBlobClient(snapshotBlobPath);

                if (!await snapshotBlob.ExistsAsync(cancellationToken))
                    return NotFound("Snapshot file not found");

                var properties = await snapshotBlob.GetPropertiesAsync(cancellationToken: cancellationToken);
                var metadata = new Dictionary<string, string>(properties.Value.Metadata);

                if (string.IsNullOrWhiteSpace(request.Note))
                {
                    metadata.Remove("SnapshotNote");
                }
                else
                {
                    metadata["SnapshotNote"] = request.Note.Trim();
                }

                await snapshotBlob.SetMetadataAsync(metadata, cancellationToken: cancellationToken);

                _logger.LogInformation("Updating note on snapshot {SnapshotName} for media {MediaKey}",
                    request.SnapshotName, request.MediaKey);

                return Ok(new { success = true, message = "Note updated successfully" });
            }
            catch (RequestFailedException ex)
            {
                _logger.LogError(ex, "Azure storage error while updating note on snapshot {SnapshotName}", request.SnapshotName);
                return Problem("Failed to update snapshot note");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating note on snapshot {SnapshotName}", request.SnapshotName);
                return Problem("An unexpected error occurred while updating the note");
            }
        }
    }

}
