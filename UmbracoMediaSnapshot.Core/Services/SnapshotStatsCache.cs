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
        public void Invalidate()
        {
            _cache.Remove(CacheKey);
            _logger.LogDebug("Snapshot storage stats cache invalidated");
        }

        /// <summary>
        /// Enumerates the snapshot container and computes per-folder,
        /// per-day, and per-media-type statistics in a single pass
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
            var dailyTrend = new Dictionary<DateOnly, DailyTrendStats>();
            var mediaTypes = new Dictionary<string, MediaTypeCategoryStats>(StringComparer.OrdinalIgnoreCase);

            await foreach (var blob in snapshotContainer.GetBlobsAsync(cancellationToken: cancellationToken))
            {
                var parts = blob.Name.Split('/', 2);
                var folder = parts.Length > 1 ? parts[0] : "(root)";
                var size = blob.Properties.ContentLength ?? 0;

                // Use CreatedOn (immutable) for trend data; fall back to LastModified
                var created = blob.Properties.CreatedOn?.DateTime
                              ?? blob.Properties.LastModified?.DateTime;

                // Per-folder stats
                if (folders.TryGetValue(folder, out var existing))
                {
                    existing.Count++;
                    existing.Size += size;
                    if (created > existing.Latest || existing.Latest is null) existing.Latest = created;
                    if (created < existing.Oldest || existing.Oldest is null) existing.Oldest = created;
                }
                else
                {
                    folders[folder] = new FolderStats
                    {
                        Count = 1,
                        Size = size,
                        Latest = created,
                        Oldest = created
                    };
                }

                // Per-day trend stats
                if (created.HasValue)
                {
                    var dateKey = DateOnly.FromDateTime(created.Value);

                    if (dailyTrend.TryGetValue(dateKey, out var daily))
                    {
                        daily.Count++;
                        daily.SizeBytes += size;
                    }
                    else
                    {
                        dailyTrend[dateKey] = new DailyTrendStats { Count = 1, SizeBytes = size };
                    }
                }

                // Per-media-type stats
                var category = CategorizeByExtension(Path.GetExtension(blob.Name));

                if (mediaTypes.TryGetValue(category, out var catStats))
                {
                    catStats.Count++;
                    catStats.SizeBytes += size;
                }
                else
                {
                    mediaTypes[category] = new MediaTypeCategoryStats { Count = 1, SizeBytes = size };
                }
            }

            return new SnapshotStorageStats
            {
                TotalSnapshotCount = folders.Values.Sum(f => f.Count),
                TotalSizeBytes = folders.Values.Sum(f => f.Size),
                MediaItemCount = folders.Count,
                Folders = folders,
                DailyTrend = dailyTrend,
                MediaTypeBreakdown = mediaTypes
            };
        }

        /// <summary>
        /// Maps a file extension to a media type category for breakdown reporting
        /// </summary>
        /// <param name="extension">The file extension including the leading dot</param>
        /// <returns>One of: Image, Video, Audio, Document, Other</returns>
        private static string CategorizeByExtension(string extension) => extension.ToLowerInvariant() switch
        {
            ".jpg" or ".jpeg" or ".png" or ".gif" or ".bmp" or ".webp" or ".svg" or ".tiff" or ".tif" or ".avif" or ".ico" => "Image",
            ".mp4" or ".webm" or ".mov" or ".avi" or ".wmv" or ".mkv" or ".m4v" => "Video",
            ".mp3" or ".wav" or ".ogg" or ".aac" or ".flac" or ".m4a" or ".wma" => "Audio",
            ".pdf" or ".doc" or ".docx" or ".xls" or ".xlsx" or ".ppt" or ".pptx" or ".txt" or ".csv" or ".rtf" => "Document",
            _ => "Other"
        };
    }
}
