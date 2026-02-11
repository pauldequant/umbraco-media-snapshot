namespace UmbracoMediaSnapshot.Core.NotificationHandlers
{
    using Azure.Storage.Blobs.Models;
    using Services;
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
        /// Defines the _blobService
        /// </summary>
        private readonly ISnapshotBlobService _blobService;

        /// <summary>
        /// Initializes a new instance of the <see cref="SnapshotMediaDeletedHandler"/> class.
        /// </summary>
        /// <param name="logger">The logger<see cref="ILogger{SnapshotMediaDeletedHandler}"/></param>
        /// <param name="blobService">The blobService<see cref="ISnapshotBlobService"/></param>
        public SnapshotMediaDeletedHandler(ILogger<SnapshotMediaDeletedHandler> logger, ISnapshotBlobService blobService)
        {
            _logger = logger;
            _blobService = blobService;
        }

        /// <summary>
        /// The HandleAsync
        /// </summary>
        /// <param name="notification">The notification<see cref="MediaDeletedNotification"/></param>
        /// <param name="cancellationToken">The cancellationToken<see cref="CancellationToken"/></param>
        /// <returns>The <see cref="Task"/></returns>
        public async Task HandleAsync(MediaDeletedNotification notification, CancellationToken cancellationToken)
        {
            var snapshotContainer = _blobService.GetSnapshotContainer();

            // Check if the snapshots container even exists before trying to delete from it
            if (!await snapshotContainer.ExistsAsync(cancellationToken)) return;

            foreach (var media in notification.DeletedEntities)
            {
                var umbracoFileValue = media.GetValue<string>("umbracoFile");
                if (string.IsNullOrWhiteSpace(umbracoFileValue)) continue;

                string? folderPath = _blobService.ExtractFolderPath(umbracoFileValue);
                if (string.IsNullOrEmpty(folderPath)) continue;

                try
                {
                    _logger.LogInformation("Media {Id} permanently deleted. Cleaning up snapshots in folder: {Folder}", media.Id, folderPath);

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
    }
}
