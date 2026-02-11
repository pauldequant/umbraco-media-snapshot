namespace UmbracoMediaSnapshot.Core.NotificationHandlers
{
    using Azure;
    using Azure.Storage.Blobs;
    using Azure.Storage.Blobs.Models;
    using Configuration;
    using Microsoft.Extensions.Options;
    using System.Text.Json;
    using System.Threading;
    using System.Threading.Tasks;
    using Umbraco.Cms.Core.Events;
    using Umbraco.Cms.Core.Notifications;
    using Umbraco.Cms.Core.Security;
    using Umbraco.StorageProviders.AzureBlob.IO;

    /// <summary>
    /// Defines the <see cref="SnapshotMediaSavedHandler" />
    /// </summary>
    public class SnapshotMediaSavedHandler : INotificationAsyncHandler<MediaSavedNotification>
    {
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
        /// Defines the _azureBlobFileSystemProvider
        /// </summary>
        private readonly IAzureBlobFileSystemProvider _azureBlobFileSystemProvider;

        /// <summary>
        /// Defines the _configuration
        /// </summary>
        private readonly IConfiguration _configuration;

        /// <summary>
        /// Defines the _logger
        /// </summary>
        private readonly ILogger<SnapshotMediaSavedHandler> _logger;

        /// <summary>
        /// Defines the _settings
        /// </summary>
        private readonly MediaSnapshotSettings _settings;

        /// <summary>
        /// Defines the _blobServiceClient
        /// </summary>
        private readonly BlobServiceClient _blobServiceClient;

        /// <summary>
        /// Initializes a new instance of the <see cref="SnapshotMediaSavedHandler"/> class.
        /// </summary>
        /// <param name="backofficeSecurityAccessor">The backofficeSecurityAccessor<see cref="IBackOfficeSecurityAccessor"/></param>
        /// <param name="azureBlobFileSystemProvider">The azureBlobFileSystemProvider<see cref="IAzureBlobFileSystemProvider"/></param>
        /// <param name="configuration">The configuration<see cref="IConfiguration"/></param>
        /// <param name="settings">The settings<see cref="IOptions{MediaSnapshotSettings}"/></param>
        /// <param name="logger">The logger<see cref="ILogger{SnapshotMediaSavedHandler}"/></param>
        /// <param name="blobServiceClient">The blobServiceClient<see cref="BlobServiceClient"/></param>
        public SnapshotMediaSavedHandler(
            IBackOfficeSecurityAccessor backofficeSecurityAccessor,
            IAzureBlobFileSystemProvider azureBlobFileSystemProvider,
            IConfiguration configuration,
            IOptions<MediaSnapshotSettings> settings,
            ILogger<SnapshotMediaSavedHandler> logger,
            BlobServiceClient blobServiceClient)
        {
            _backofficeSecurityAccessor = backofficeSecurityAccessor;
            _azureBlobFileSystemProvider = azureBlobFileSystemProvider;
            _configuration = configuration;
            _settings = settings.Value;
            _logger = logger;
            _blobServiceClient = blobServiceClient;
        }

        /// <summary>
        /// The HandleAsync
        /// </summary>
        /// <param name="notification">The notification<see cref="MediaSavedNotification"/></param>
        /// <param name="cancellationToken">The cancellationToken<see cref="CancellationToken"/></param>
        /// <returns>The <see cref="Task"/></returns>
        public async Task HandleAsync(MediaSavedNotification notification, CancellationToken cancellationToken)
        {
            var connectionString = _configuration.GetValue<string>("Umbraco:Storage:AzureBlob:Media:ConnectionString");
            var mediaContainerName = _configuration.GetValue<string>("Umbraco:Storage:AzureBlob:Media:ContainerName") ?? "umbraco";

            // 1. Snapshot Client (Target)
            var snapshotContainer = _blobServiceClient.GetBlobContainerClient("umbraco-snapshots");
            await snapshotContainer.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: cancellationToken);

            // 2. Original Media Client (Source)
            var mediaContainer = _blobServiceClient.GetBlobContainerClient(mediaContainerName);

            // 3. Umbraco FileSystem abstraction
            var azureMediaFileSystem = _azureBlobFileSystemProvider.GetFileSystem("Media");

            foreach (var media in notification.SavedEntities)
            {
                // Only process supported media types
                if (!TARGET_MEDIA_TYPES.Contains(media.ContentType.Alias))
                {
                    _logger.LogDebug("Skipping media {Id} with unsupported content type '{ContentType}'",
                        media.Id, media.ContentType.Alias);
                    continue;
                }

                var umbracoFileValue = media.GetValue<string>("umbracoFile");
                if (string.IsNullOrWhiteSpace(umbracoFileValue)) continue;

                // FULL PATH: "media/if3f2s40/file.csv" (Used for finding the original)
                string? fullBlobPath = GetRawBlobPath(umbracoFileValue);
                if (string.IsNullOrEmpty(fullBlobPath)) continue;

                try
                {
                    // 4. PREPARE SNAPSHOT PATH (Strip 'media/' for the backup container)
                    string snapshotPath = fullBlobPath;
                    if (snapshotPath.StartsWith("media/", StringComparison.OrdinalIgnoreCase))
                    {
                        snapshotPath = snapshotPath.Substring(6); // Remove "media/"
                    }

                    // directory: "if3f2s40", fileName: "file.csv"
                    string directory = Path.GetDirectoryName(snapshotPath)?.Replace("\\", "/") ?? "";
                    string fileName = Path.GetFileName(snapshotPath);

                    // If a restore is in progress, skip the duplicate check entirely —
                    // the restored file must always appear as the latest snapshot.
                    bool forceSnapshot = SnapshotMediaSavingHandler.ForceSnapshotMediaIds.TryRemove(media.Id, out _);

                    // Check if the current file already has an identical snapshot.
                    string folderPrefix = string.IsNullOrEmpty(directory) ? "" : $"{directory}/";
                    bool isDuplicate = false;

                    if (!forceSnapshot)
                    {
                        try
                        {
                            var existingSnapshots = new List<BlobItem>();
                            await foreach (var blob in snapshotContainer.GetBlobsAsync(
                                traits: BlobTraits.None,
                                prefix: folderPrefix,
                                cancellationToken: cancellationToken))
                            {
                                existingSnapshots.Add(blob);
                            }

                            if (existingSnapshots.Count > 0)
                            {
                                var latestSnapshot = existingSnapshots
                                    .OrderByDescending(b => b.Properties.LastModified)
                                    .First();

                                string latestSnapshotName = Path.GetFileName(latestSnapshot.Name);
                                string latestOriginalName = latestSnapshotName.Length > 16
                                    ? latestSnapshotName.Substring(16)
                                    : latestSnapshotName;

                                if (string.Equals(latestOriginalName, fileName, StringComparison.OrdinalIgnoreCase))
                                {
                                    var currentBlob = mediaContainer.GetBlobClient(fullBlobPath);
                                    var currentProps = await currentBlob.GetPropertiesAsync(cancellationToken: cancellationToken);

                                    if (latestSnapshot.Properties.ContentLength == currentProps.Value.ContentLength)
                                    {
                                        isDuplicate = true;
                                    }
                                }
                            }
                        }
                        catch (RequestFailedException ex)
                        {
                            _logger.LogWarning(ex, "Could not check existing snapshots for media {Id}, proceeding with snapshot.", media.Id);
                        }
                    }

                    if (isDuplicate)
                    {
                        _logger.LogDebug("File unchanged for media {Id} (matches latest snapshot), skipping.", media.Id);
                        continue;
                    }

                    string timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");

                    // Final snapshot path: "if3f2s40/20240204_120000_file.csv"
                    string finalVersionPath = string.IsNullOrEmpty(directory)
                        ? $"{timestamp}_{fileName}"
                        : $"{directory}/{timestamp}_{fileName}";

                    var metadata = new Dictionary<string, string>
                    {
                        { "UploaderName", (_backofficeSecurityAccessor.BackOfficeSecurity?.CurrentUser?.Name ?? "System").Replace(" ", "_") },
                        { "UploadDate", DateTime.UtcNow.ToString("O") },
                        { "OriginalMediaId", media.Id.ToString() }
                    };

                    // 5. COPY
                    BlobClient snapshotBlobClient = snapshotContainer.GetBlobClient(finalVersionPath);

                    Stream? stream = null;
                    for (int i = 0; i < 3; i++)
                    {
                        try
                        {
                            stream = azureMediaFileSystem.OpenFile(snapshotPath);
                            if (stream != null) break;
                        }
                        catch
                        {
                            if (i == 2) throw;
                            await Task.Delay(1000, cancellationToken);
                        }
                    }

                    if (stream != null)
                    {
                        using (stream)
                        {
                            await snapshotBlobClient.UploadAsync(stream, new BlobUploadOptions { Metadata = metadata }, cancellationToken);
                            _logger.LogInformation("Snapshot created for Media {Id} ({ContentType}) at {Path}",
                                media.Id, media.ContentType.Alias, finalVersionPath);
                        }
                    }

                    await CleanupOldSnapshotsAsync(snapshotContainer, finalVersionPath.Substring(0, finalVersionPath.LastIndexOf('/') + 1), cancellationToken);
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
