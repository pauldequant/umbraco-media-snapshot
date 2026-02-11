namespace UmbracoMediaSnapshot.Core.NotificationHandlers
{
    using Azure.Storage.Blobs;
    using Azure.Storage.Blobs.Models;
    using System.Text.Json;
    using Umbraco.Cms.Core.Events;
    using Umbraco.Cms.Core.Notifications;

    /// <summary>
    /// Defines the <see cref="SnapshotMediaDeletedHandler" />
    /// </summary>
    public class SnapshotMediaDeletedHandler : INotificationAsyncHandler<MediaDeletedNotification>
    {
        /// <summary>
        /// Defines the _logger
        /// </summary>
        private readonly ILogger<SnapshotMediaDeletedHandler> _logger;

        /// <summary>
        /// Defines the _blobServiceClient
        /// </summary>
        private readonly BlobServiceClient _blobServiceClient;

        /// <summary>
        /// Initializes a new instance of the <see cref="SnapshotMediaDeletedHandler"/> class.
        /// </summary>
        /// <param name="logger">The logger<see cref="ILogger{SnapshotMediaDeletedHandler}"/></param>
        /// <param name="blobServiceClient">The blobServiceClient<see cref="BlobServiceClient"/></param>
        public SnapshotMediaDeletedHandler(ILogger<SnapshotMediaDeletedHandler> logger, BlobServiceClient blobServiceClient)
        {
            _logger = logger;
            _blobServiceClient = blobServiceClient;
        }

        /// <summary>
        /// The HandleAsync
        /// </summary>
        /// <param name="notification">The notification<see cref="MediaDeletedNotification"/></param>
        /// <param name="cancellationToken">The cancellationToken<see cref="CancellationToken"/></param>
        /// <returns>The <see cref="Task"/></returns>
        public async Task HandleAsync(MediaDeletedNotification notification, CancellationToken cancellationToken)
        {
            var snapshotContainer = _blobServiceClient.GetBlobContainerClient("umbraco-snapshots");

            // Check if the snapshots container even exists before trying to delete from it
            if (!await snapshotContainer.ExistsAsync(cancellationToken)) return;

            foreach (var media in notification.DeletedEntities)
            {
                var umbracoFileValue = media.GetValue<string>("umbracoFile");
                if (string.IsNullOrWhiteSpace(umbracoFileValue)) continue;

                // We need the folder name (e.g., "if3f2s40") to find all related snapshots
                string? folderPath = ExtractFolderPath(umbracoFileValue);
                if (string.IsNullOrEmpty(folderPath)) continue;

                try
                {
                    _logger.LogInformation("Media {Id} permanently deleted. Cleaning up snapshots in folder: {Folder}", media.Id, folderPath);

                    // List all blobs in the snapshot container that start with the folder prefix
                    // e.g. "if3f2s40/"
                    var prefix = folderPath.EndsWith("/") ? folderPath : folderPath + "/";
   
                    var blobsToDelete = snapshotContainer.GetBlobsAsync(prefix: prefix, cancellationToken: cancellationToken);

                    int deleteCount = 0;
                    await foreach (BlobItem blobItem in blobsToDelete)
                    {
                        await snapshotContainer.DeleteBlobIfExistsAsync(blobItem.Name, DeleteSnapshotsOption.IncludeSnapshots, cancellationToken: cancellationToken);
                        deleteCount++;
                    }

                    _logger.LogInformation("Deleted {Count} snapshots for Media {Id}", deleteCount, media.Id);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to clean up snapshots for deleted Media {Id}", media.Id);
                }
            }
        }

        /// <summary>
        /// The ExtractFolderPath
        /// </summary>
        /// <param name="value">The value<see cref="string"/></param>
        /// <returns>The <see cref="string?"/></returns>
        private string? ExtractFolderPath(string value)
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

            if (string.IsNullOrEmpty(rawPath)) return null;

            // Remove leading slash and split: "media/if3f2s40/file.csv" -> ["media", "if3f2s40", "file.csv"]
            var parts = rawPath.TrimStart('/').Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries).ToList();

            // If it starts with "media", the next part is the folder we want
            if (parts.Count > 1 && parts[0].Equals("media", StringComparison.OrdinalIgnoreCase))
            {
                return parts[1];
            }

            // If there is no "media" prefix, the first part is the folder
            return parts.FirstOrDefault();
        }
    }
}
