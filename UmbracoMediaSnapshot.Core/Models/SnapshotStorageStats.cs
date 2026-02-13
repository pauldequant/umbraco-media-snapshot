namespace UmbracoMediaSnapshot.Core.Models
{
    /// <summary>
    /// Raw storage statistics computed from the snapshot container,
    /// separated from the API response model so it can be cached independently
    /// </summary>
    public class SnapshotStorageStats
    {
        /// <summary>
        /// Gets or sets the total number of snapshots
        /// </summary>
        public int TotalSnapshotCount { get; set; }

        /// <summary>
        /// Gets or sets the total size in bytes
        /// </summary>
        public long TotalSizeBytes { get; set; }

        /// <summary>
        /// Gets or sets the number of distinct media folders
        /// </summary>
        public int MediaItemCount { get; set; }

        /// <summary>
        /// Gets or sets the per-folder statistics
        /// </summary>
        public Dictionary<string, FolderStats> Folders { get; set; } = new(StringComparer.OrdinalIgnoreCase);

        /// <summary>
        /// Gets or sets the per-day snapshot creation statistics for trend charting
        /// </summary>
        public Dictionary<DateOnly, DailyTrendStats> DailyTrend { get; set; } = [];

        /// <summary>
        /// Gets or sets the per-media-type-category statistics (Image, Video, Audio, Document, Other)
        /// </summary>
        public Dictionary<string, MediaTypeCategoryStats> MediaTypeBreakdown { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Statistics for a single snapshot folder
    /// </summary>
    public class FolderStats
    {
        /// <summary>
        /// Gets or sets the snapshot count
        /// </summary>
        public int Count { get; set; }

        /// <summary>
        /// Gets or sets the total size in bytes
        /// </summary>
        public long Size { get; set; }

        /// <summary>
        /// Gets or sets the latest snapshot date
        /// </summary>
        public DateTime? Latest { get; set; }

        /// <summary>
        /// Gets or sets the oldest snapshot date
        /// </summary>
        public DateTime? Oldest { get; set; }
    }

    /// <summary>
    /// Snapshot count and size for a single day, used for trend aggregation
    /// </summary>
    public class DailyTrendStats
    {
        /// <summary>
        /// Gets or sets the number of snapshots created on this day
        /// </summary>
        public int Count { get; set; }

        /// <summary>
        /// Gets or sets the total size of snapshots created on this day
        /// </summary>
        public long SizeBytes { get; set; }
    }

    /// <summary>
    /// Snapshot count and size for a single media type category
    /// </summary>
    public class MediaTypeCategoryStats
    {
        /// <summary>
        /// Gets or sets the snapshot count for this category
        /// </summary>
        public int Count { get; set; }

        /// <summary>
        /// Gets or sets the total size in bytes for this category
        /// </summary>
        public long SizeBytes { get; set; }
    }
}
