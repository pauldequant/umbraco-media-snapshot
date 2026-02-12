namespace UmbracoMediaSnapshot.Core.Services
{
    using Microsoft.Extensions.Caching.Memory;
    using Microsoft.Extensions.Logging;
    using Models;

    /// <summary>
    /// Caches snapshot storage statistics in memory with a configurable TTL.
    /// Invalidated when snapshots are created, deleted, or restored
    /// </summary>
    public class SnapshotStatsCache : ISnapshotStatsCache
    {
        /// <summary>
        /// Defines the CacheKey
        /// </summary>
        private const string CacheKey = "SnapshotStorageStats";

        /// <summary>
        /// Defines the CacheDuration
        /// </summary>
        private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);

        /// <summary>
        /// Defines the _cache
        /// </summary>
        private readonly IMemoryCache _cache;

        /// <summary>
        /// Defines the _blobService
        /// </summary>
        private readonly ISnapshotBlobService _blobService;

        /// <summary>
        /// Defines the _logger
        /// </summary>
        private readonly ILogger<SnapshotStatsCache> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="SnapshotStatsCache"/> class.
        /// </summary>
        /// <param name="cache">The cache<see cref="IMemoryCache"/></param>
        /// <param name="blobService">The blobService<see cref="ISnapshotBlobService"/></param>
        /// <param name="logger">The logger<see cref="ILogger{SnapshotStatsCache}"/></param>
        public SnapshotStatsCache(IMemoryCache cache, ISnapshotBlobService blobService, ILogger<SnapshotStatsCache> logger)
        {
            _cache = cache;
            _blobService = blobService;
            _logger = logger;
        }

        /// <inheritdoc />

        /// <summary>
        /// The GetOrComputeAsync
        /// </summary>
        /// <param name="cancellationToken">The cancellationToken<see cref="CancellationToken"/></param>
        /// <returns>The <see cref="Task{SnapshotStorageStats}"/></returns>
        public async Task<SnapshotStorageStats> GetOrComputeAsync(CancellationToken cancellationToken)
        {
            if (_cache.TryGetValue(CacheKey, out SnapshotStorageStats? cached) && cached is not null)
            {
                _logger.LogDebug("Returning cached snapshot storage stats");
                return cached;
            }

            _logger.LogInformation("Computing snapshot storage stats (cache miss or expired)");

            var stats = await ComputeStatsAsync(cancellationToken);

            _cache.Set(CacheKey, stats, CacheDuration);

            return stats;
        }

        /// <inheritdoc />

        /// <summary>
        /// The Invalidate
        /// </summary>
        public void Invalidate()
        {
            _cache.Remove(CacheKey);
            _logger.LogDebug("Snapshot storage stats cache invalidated");
        }

        /// <summary>
        /// Enumerates the snapshot container and computes per-folder statistics
        /// </summary>
        /// <param name="cancellationToken">The cancellationToken<see cref="CancellationToken"/></param>
        /// <returns>The <see cref="Task{SnapshotStorageStats}"/></returns>
        private async Task<SnapshotStorageStats> ComputeStatsAsync(CancellationToken cancellationToken)
        {
            var snapshotContainer = _blobService.GetSnapshotContainer();

            if (!await snapshotContainer.ExistsAsync(cancellationToken))
            {
                return new SnapshotStorageStats();
            }

            var folders = new Dictionary<string, FolderStats>(StringComparer.OrdinalIgnoreCase);

            await foreach (var blob in snapshotContainer.GetBlobsAsync(cancellationToken: cancellationToken))
            {
                var parts = blob.Name.Split('/', 2);
                var folder = parts.Length > 1 ? parts[0] : "(root)";
                var size = blob.Properties.ContentLength ?? 0;
                var modified = blob.Properties.LastModified?.DateTime;

                if (folders.TryGetValue(folder, out var existing))
                {
                    existing.Count++;
                    existing.Size += size;
                    if (modified > existing.Latest || existing.Latest is null) existing.Latest = modified;
                    if (modified < existing.Oldest || existing.Oldest is null) existing.Oldest = modified;
                }
                else
                {
                    folders[folder] = new FolderStats
                    {
                        Count = 1,
                        Size = size,
                        Latest = modified,
                        Oldest = modified
                    };
                }
            }

            return new SnapshotStorageStats
            {
                TotalSnapshotCount = folders.Values.Sum(f => f.Count),
                TotalSizeBytes = folders.Values.Sum(f => f.Size),
                MediaItemCount = folders.Count,
                Folders = folders
            };
        }
    }
}
