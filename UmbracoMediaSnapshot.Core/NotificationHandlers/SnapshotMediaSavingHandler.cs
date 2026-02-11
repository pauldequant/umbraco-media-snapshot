namespace UmbracoMediaSnapshot.Core.NotificationHandlers
{
    using Azure;
    using Azure.Storage.Blobs;
    using Azure.Storage.Blobs.Models;
    using Configuration;
    using Microsoft.Extensions.Options;
    using System.Collections.Concurrent;
    using System.Text.Json;
    using System.Threading;
    using System.Threading.Tasks;
    using Umbraco.Cms.Core.Events;
    using Umbraco.Cms.Core.Notifications;
    using Umbraco.Cms.Core.Security;
    using Umbraco.Cms.Core.Services;

    /// <summary>
    /// Handles <see cref="MediaSavingNotification"/> to snapshot the previous version of a media file
    /// before it is replaced by a new upload. No snapshot is taken on first upload.
    /// Uses a Copy-on-Write strategy: only the outgoing file is archived to umbraco-snapshots
    /// </summary>
    public class SnapshotMediaSavingHandler : INotificationAsyncHandler<MediaSavingNotification>
    {
        /// <summary>
        /// Media items whose Id is in this set will be skipped by the handler.
        /// The restore endpoint adds an Id here before calling <c>IMediaService.Save</c>
        /// so that the save does not create a redundant snapshot
        /// </summary>
        internal static readonly ConcurrentDictionary<int, byte> SuppressedMediaIds = new();

        /// <summary>
        /// Media items whose Id is in this set will bypass the duplicate check
        /// in the Saved handler. The restore endpoint adds an Id here so that
        /// the restored file always appears as the latest snapshot
        /// </summary>
        internal static readonly ConcurrentDictionary<int, byte> ForceSnapshotMediaIds = new();

        /// <summary>
        /// Defines the TARGET_MEDIA_TYPES
        /// </summary>
        private static readonly string[] TARGET_MEDIA_TYPES = new[]
        {
            "umbracoMediaArticle",
            "umbracoMediaAudio",
            "File",
            "Image",
            "umbracoMediaVectorGraphics",
            "umbracoMediaVideo"
        };

        /// <summary>
        /// Defines the _backofficeSecurityAccessor
        /// </summary>
        private readonly IBackOfficeSecurityAccessor _backofficeSecurityAccessor;

        /// <summary>
        /// Defines the _mediaService
        /// </summary>
        private readonly IMediaService _mediaService;

        /// <summary>
        /// Defines the _configuration
        /// </summary>
        private readonly IConfiguration _configuration;

        /// <summary>
        /// Defines the _logger
        /// </summary>
        private readonly ILogger<SnapshotMediaSavingHandler> _logger;

        /// <summary>
        /// Defines the _settings
        /// </summary>
        private readonly MediaSnapshotSettings _settings;

        /// <summary>
        /// Defines the _blobServiceClient
        /// </summary>
        private readonly BlobServiceClient _blobServiceClient;

        /// <summary>
        /// Initializes a new instance of the <see cref="SnapshotMediaSavingHandler"/> class.
        /// </summary>
        /// <param name="backofficeSecurityAccessor">The backofficeSecurityAccessor<see cref="IBackOfficeSecurityAccessor"/></param>
        /// <param name="mediaService">The mediaService<see cref="IMediaService"/></param>
        /// <param name="configuration">The configuration<see cref="IConfiguration"/></param>
        /// <param name="settings">The settings<see cref="IOptions{MediaSnapshotSettings}"/></param>
        /// <param name="logger">The logger<see cref="ILogger{SnapshotMediaSavingHandler}"/></param>
        /// <param name="blobServiceClient">The blobServiceClient<see cref="BlobServiceClient"/></param>
        public SnapshotMediaSavingHandler(
            IBackOfficeSecurityAccessor backofficeSecurityAccessor,
            IMediaService mediaService,
            IConfiguration configuration,
            IOptions<MediaSnapshotSettings> settings,
            ILogger<SnapshotMediaSavingHandler> logger,
            BlobServiceClient blobServiceClient)
        {
            _backofficeSecurityAccessor = backofficeSecurityAccessor;
            _mediaService = mediaService;
            _configuration = configuration;
            _settings = settings.Value;
            _logger = logger;
            _blobServiceClient = blobServiceClient;
        }

        /// <summary>
        /// The HandleAsync
        /// </summary>
        /// <param name="notification">The notification<see cref="MediaSavingNotification"/></param>
        /// <param name="cancellationToken">The cancellationToken<see cref="CancellationToken"/></param>
        /// <returns>The <see cref="Task"/></returns>
        public async Task HandleAsync(MediaSavingNotification notification, CancellationToken cancellationToken)
        {
            var connectionString = _configuration.GetValue<string>("Umbraco:Storage:AzureBlob:Media:ConnectionString");
            var mediaContainerName = _configuration.GetValue<string>("Umbraco:Storage:AzureBlob:Media:ContainerName") ?? "umbraco";

            // 1. Snapshot Client (Target)
            var snapshotContainer = _blobServiceClient.GetBlobContainerClient("umbraco-snapshots");
            await snapshotContainer.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: cancellationToken);

            // 2. Original Media Client (Source)
            var mediaContainer = _blobServiceClient.GetBlobContainerClient(mediaContainerName);

            foreach (var media in notification.SavedEntities)
            {
                // Only process supported media types
                if (!TARGET_MEDIA_TYPES.Contains(media.ContentType.Alias))
                {
                    _logger.LogDebug("Skipping media {Id} with unsupported content type '{ContentType}'",
                        media.Id, media.ContentType.Alias);
                    continue;
                }

                // Fast-path: definitely a new item (no identity assigned yet)
                if (!media.HasIdentity || media.Id == 0)
                {
                    _logger.LogDebug("Skipping new media item (no identity yet), no snapshot needed.");
                    continue;
                }

                // Skip if the restore endpoint has suppressed snapshotting for this media
                if (SuppressedMediaIds.TryRemove(media.Id, out _))
                {
                    _logger.LogDebug("Snapshot suppressed for media {Id} (restore in progress).", media.Id);
                    continue;
                }

                // Definitively check whether this item exists in the database.
                // In Umbraco 17, HasIdentity can be true for items that have not
                // yet been persisted, so the fast-path above is not sufficient.
                var existingMedia = _mediaService.GetById(media.Id);
                if (existingMedia is null)
                {
                    _logger.LogDebug("Media {Id} not yet persisted (new upload), letting Saved handler create first snapshot.", media.Id);
                    continue;
                }

                // Only act when the file is actually being replaced
                if (!media.WasPropertyDirty("umbracoFile"))
                {
                    _logger.LogDebug("umbracoFile not dirty for media {Id}, skipping snapshot.", media.Id);
                    continue;
                }

                try
                {
                    var oldUmbracoFileValue = existingMedia.GetValue<string>("umbracoFile");
                    if (string.IsNullOrWhiteSpace(oldUmbracoFileValue))
                    {
                        _logger.LogDebug("No existing umbracoFile value for media {Id}, skipping snapshot.", media.Id);
                        continue;
                    }

                    // FULL PATH: "media/if3f2s40/file.csv" (the old file still in the media container)
                    string? oldBlobPath = GetRawBlobPath(oldUmbracoFileValue);
                    if (string.IsNullOrEmpty(oldBlobPath))
                    {
                        _logger.LogDebug("Could not parse old blob path for media {Id}, skipping snapshot.", media.Id);
                        continue;
                    }

                    // Verify the old blob actually exists before trying to snapshot it
                    var oldBlobClient = mediaContainer.GetBlobClient(oldBlobPath);
                    BlobProperties oldBlobProperties;
                    try
                    {
                        var propertiesResponse = await oldBlobClient.GetPropertiesAsync(cancellationToken: cancellationToken);
                        oldBlobProperties = propertiesResponse.Value;
                    }
                    catch (RequestFailedException ex) when (ex.Status == 404)
                    {
                        _logger.LogWarning("Old blob {Path} not found for media {Id}, cannot create snapshot.", oldBlobPath, media.Id);
                        continue;
                    }

                    // PREPARE SNAPSHOT PATH (Strip 'media/' for the backup container)
                    string snapshotPath = oldBlobPath;
                    if (snapshotPath.StartsWith("media/", StringComparison.OrdinalIgnoreCase))
                    {
                        snapshotPath = snapshotPath.Substring(6); // Remove "media/"
                    }

                    // directory: "if3f2s40", fileName: "file.csv"
                    string directory = Path.GetDirectoryName(snapshotPath)?.Replace("\\", "/") ?? "";
                    string fileName = Path.GetFileName(snapshotPath);

                    // ── Duplicate check: skip if the outgoing file already has a
                    //    matching snapshot (same original filename + same size). ──
                    //    The Saved handler already snapshotted this file when it was
                    //    first uploaded, so archiving it again would create a duplicate.
                    string folderPrefix = string.IsNullOrEmpty(directory) ? "" : $"{directory}/";
                    bool alreadySnapshotted = false;

                    try
                    {
                        await foreach (var blob in snapshotContainer.GetBlobsAsync(
                            traits: BlobTraits.None,
                            prefix: folderPrefix,
                            cancellationToken: cancellationToken))
                        {
                            string snapshotFileName = Path.GetFileName(blob.Name);
                            string originalName = snapshotFileName.Length > 16
                                ? snapshotFileName.Substring(16)
                                : snapshotFileName;

                            if (string.Equals(originalName, fileName, StringComparison.OrdinalIgnoreCase)
                                && blob.Properties.ContentLength == oldBlobProperties.ContentLength)
                            {
                                alreadySnapshotted = true;
                                break;
                            }
                        }
                    }
                    catch (RequestFailedException ex)
                    {
                        _logger.LogWarning(ex, "Could not check existing snapshots for media {Id}, proceeding with archive.", media.Id);
                    }

                    if (alreadySnapshotted)
                    {
                        _logger.LogDebug("Outgoing file for media {Id} already exists in snapshot container, skipping archive.", media.Id);
                        continue;
                    }

                    string timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");

                    // Final snapshot path: "if3f2s40/20240204_120000_file.csv"
                    string finalVersionPath = string.IsNullOrEmpty(directory)
                        ? $"{timestamp}_{fileName}"
                        : $"{directory}/{timestamp}_{fileName}";

                    // Preserve the original upload date from the blob, not the snapshot date
                    string originalUploadDate = oldBlobProperties.Metadata.TryGetValue("UploadDate", out var existingUploadDate)
                        ? existingUploadDate
                        : oldBlobProperties.CreatedOn.ToString("O");

                    var metadata = new Dictionary<string, string>
                    {
                        { "UploaderName", (_backofficeSecurityAccessor.BackOfficeSecurity?.CurrentUser?.Name ?? "System").Replace(" ", "_") },
                        { "UploadDate", originalUploadDate },
                        { "SnapshotDate", DateTime.UtcNow.ToString("O") },
                        { "OriginalMediaId", media.Id.ToString() }
                    };

                    // COPY the old file from the media container to the snapshot container
                    BlobClient snapshotBlobClient = snapshotContainer.GetBlobClient(finalVersionPath);

                    using var stream = await oldBlobClient.OpenReadAsync(cancellationToken: cancellationToken);
                    await snapshotBlobClient.UploadAsync(stream, new BlobUploadOptions
                    {
                        Metadata = metadata,
                        HttpHeaders = new BlobHttpHeaders { ContentType = oldBlobProperties.ContentType }
                    }, cancellationToken);

                    _logger.LogInformation("Snapshot created for Media {Id} ({ContentType}) at {Path}",
                        media.Id, media.ContentType.Alias, finalVersionPath);

                    // Clean up old snapshots if configured
                    folderPrefix = finalVersionPath.Substring(0, finalVersionPath.LastIndexOf('/') + 1);
                    await CleanupOldSnapshotsAsync(snapshotContainer, folderPrefix, cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Versioning failed for Media {Id} ({ContentType})",
                        media.Id, media.ContentType.Alias);
                }
            }
        }

        /// <summary>
        /// The GetRawBlobPath
        /// </summary>
        /// <param name="value">The value<see cref="string"/></param>
        /// <returns>The <see cref="string?"/></returns>
        private string? GetRawBlobPath(string value)
        {
            string? rawPath = null;
            if (value.Trim().StartsWith("{"))
            {
                try
                {
                    var json = JsonSerializer.Deserialize<JsonElement>(value);
                    if (json.TryGetProperty("src", out var src)) rawPath = src.GetString();
                }
                catch { return null; }
            }
            else { rawPath = value; }

            // "media/if3f2s40/file.csv"
            return rawPath?.TrimStart('/');
        }

        /// <summary>
        /// The CleanupOldSnapshotsAsync
        /// </summary>
        /// <param name="snapshotContainer">The snapshotContainer<see cref="BlobContainerClient"/></param>
        /// <param name="folderPath">The folderPath<see cref="string"/></param>
        /// <param name="cancellationToken">The cancellationToken<see cref="CancellationToken"/></param>
        /// <returns>The <see cref="Task"/></returns>
        private async Task CleanupOldSnapshotsAsync(BlobContainerClient snapshotContainer, string folderPath, CancellationToken cancellationToken)
        {
            if (!_settings.EnableAutomaticCleanup) return;

            var snapshots = new List<BlobItem>();
            await foreach (var blob in snapshotContainer.GetBlobsAsync(prefix: folderPath, cancellationToken: cancellationToken))
            {
                snapshots.Add(blob);
            }

            // Sort by last modified descending
            var toDelete = snapshots
                .OrderByDescending(b => b.Properties.LastModified)
                .Skip(_settings.MaxSnapshotsPerMedia)
                .ToList();

            foreach (var blob in toDelete)
            {
                _logger.LogInformation("Deleting old snapshot: {BlobName}", blob.Name);
                await snapshotContainer.DeleteBlobIfExistsAsync(blob.Name, cancellationToken: cancellationToken);
            }
        }
    }
}
