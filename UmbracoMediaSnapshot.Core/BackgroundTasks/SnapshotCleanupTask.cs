namespace UmbracoMediaSnapshot.Core.BackgroundTasks
{
    using Azure.Storage.Blobs.Models;
    using Configuration;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;
    using Services;
    using Umbraco.Cms.Infrastructure.BackgroundJobs;

    /// <summary>
    /// Recurring background task that enforces snapshot retention policies
    /// across all media folders. Replaces the inline cleanup calls that
    /// previously ran during every media save operation.
    /// </summary>
    public class SnapshotCleanupTask : IRecurringBackgroundJob
    {
        /// <summary>
        /// Defines the _blobService
        /// </summary>
        private readonly ISnapshotBlobService _blobService;

        /// <summary>
        /// Defines the _statsCache
        /// </summary>
        private readonly ISnapshotStatsCache _statsCache;

        /// <summary>
        /// Defines the _settings
        /// </summary>
        private readonly MediaSnapshotSettings _settings;

        /// <summary>
        /// Defines the _logger
        /// </summary>
        private readonly ILogger<SnapshotCleanupTask> _logger;

        /// <summary>
        /// Gets the period between cleanup runs
        /// </summary>
        public TimeSpan Period => TimeSpan.FromMinutes(
            Math.Max(1, _settings.CleanupIntervalMinutes));

        /// <summary>
        /// Gets the delay before the first run after startup.
        /// Waits 5 minutes so the application can finish booting.
        /// </summary>
        public TimeSpan Delay => TimeSpan.FromMinutes(5);

        /// <summary>
        /// Gets the event that controls one-time server role assignment.
        /// Runs on all server roles (single-server and multi-server).
        /// </summary>
        public event EventHandler PeriodChanged { add { } remove { } }

        /// <summary>
        /// Initializes a new instance of the <see cref="SnapshotCleanupTask"/> class.
        /// </summary>
        /// <param name="blobService">The blobService<see cref="ISnapshotBlobService"/></param>
        /// <param name="statsCache">The statsCache<see cref="ISnapshotStatsCache"/></param>
        /// <param name="settings">The settings<see cref="IOptions{MediaSnapshotSettings}"/></param>
        /// <param name="logger">The logger<see cref="ILogger{SnapshotCleanupTask}"/></param>
        public SnapshotCleanupTask(
            ISnapshotBlobService blobService,
            ISnapshotStatsCache statsCache,
            IOptions<MediaSnapshotSettings> settings,
            ILogger<SnapshotCleanupTask> logger)
        {
            _blobService = blobService;
            _statsCache = statsCache;
            _settings = settings.Value;
            _logger = logger;
        }

        /// <summary>
        /// Required by <see cref="IRecurringBackgroundJob"/>. Delegates to the
        /// cancellation-aware overload with <see cref="CancellationToken.None"/>.
        /// </summary>
        /// <returns>The <see cref="Task"/></returns>
        public Task RunJobAsync() => RunJobAsync(CancellationToken.None);

        /// <summary>
        /// Executes the cleanup across all snapshot folders
        /// </summary>
        /// <param name="cancellationToken">The cancellationToken<see cref="CancellationToken"/></param>
        /// <returns>The <see cref="Task"/></returns>
        public async Task RunJobAsync(CancellationToken cancellationToken)
        {
            if (!_settings.EnableAutomaticCleanup)
            {
                _logger.LogDebug("Snapshot cleanup is disabled, skipping run");
                return;
            }

            _logger.LogInformation("Snapshot cleanup task starting — MaxPerMedia: {Max}, MaxAgeDays: {Age}",
                _settings.MaxSnapshotsPerMedia, _settings.MaxSnapshotAgeDays);

            var snapshotContainer = _blobService.GetSnapshotContainer();

            if (!await snapshotContainer.ExistsAsync(cancellationToken))
            {
                _logger.LogDebug("Snapshot container does not exist, nothing to clean up");
                return;
            }

            // Group all blobs by their top-level folder
            var folderBlobs = new Dictionary<string, List<BlobItem>>(StringComparer.OrdinalIgnoreCase);

            await foreach (var blob in snapshotContainer.GetBlobsAsync(traits: BlobTraits.Metadata, cancellationToken: cancellationToken))
            {
                var parts = blob.Name.Split('/', 2);
                var folder = parts.Length > 1 ? parts[0] : "(root)";

                if (!folderBlobs.TryGetValue(folder, out var list))
                {
                    list = [];
                    folderBlobs[folder] = list;
                }

                list.Add(blob);
            }

            var ageCutoff = DateTimeOffset.UtcNow.AddDays(-_settings.MaxSnapshotAgeDays);
            int totalDeleted = 0;
            int pinnedSkipped = 0;
            int foldersProcessed = 0;

            foreach (var (folder, blobs) in folderBlobs)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var ordered = blobs
                    .OrderByDescending(b => b.Properties.LastModified)
                    .ToList();

                var toDelete = ordered
                    .Where((blob, index) =>
                        index >= _settings.MaxSnapshotsPerMedia
                        || blob.Properties.LastModified < ageCutoff)
                    .ToList();

                foreach (var blob in toDelete)
                {
                    // Never delete pinned snapshots
                    if (blob.Metadata.TryGetValue("Pinned", out var pinned)
                        && string.Equals(pinned, "true", StringComparison.OrdinalIgnoreCase))
                    {
                        pinnedSkipped++;
                        _logger.LogDebug("Skipping pinned snapshot: {BlobName}", blob.Name);
                        continue;
                    }

                    var reason = blob.Properties.LastModified < ageCutoff ? "expired" : "over limit";
                    _logger.LogInformation("Cleanup: deleting {Reason} snapshot {BlobName}", reason, blob.Name);
                    await snapshotContainer.DeleteBlobIfExistsAsync(blob.Name, cancellationToken: cancellationToken);
                    totalDeleted++;
                }

                foldersProcessed++;
            }

            if (totalDeleted > 0)
            {
                // Invalidate the stats cache so the dashboard reflects the cleanup
                _statsCache.Invalidate();
            }

            _logger.LogInformation("Snapshot cleanup completed — processed {Folders} folders, deleted {Deleted} snapshots, skipped {Pinned} pinned",
                foldersProcessed, totalDeleted, pinnedSkipped);
        }
    }
}
