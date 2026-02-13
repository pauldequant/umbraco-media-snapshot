namespace UmbracoMediaSnapshot.Core.Models
{
    /// <summary>
    /// Defines the <see cref="SnapshotStorageModel" />
    /// </summary>
    public class SnapshotStorageModel
    {
        /// <summary>
        /// Gets or sets the total number of snapshots across all media items
        /// </summary>
        public int TotalSnapshotCount { get; set; }

        /// <summary>
        /// Gets or sets the total size of all snapshots in bytes
        /// </summary>
        public long TotalSizeBytes { get; set; }

        /// <summary>
        /// Gets or sets the total size formatted as a human-readable string
        /// </summary>
        public string TotalSizeFormatted { get; set; } = string.Empty;

        /// <summary>
        /// Gets or sets the number of distinct media folders with snapshots
        /// </summary>
        public int MediaItemCount { get; set; }

        /// <summary>
        /// Gets or sets the top media folders ranked by total snapshot size
        /// </summary>
        public List<SnapshotFolderSummary> TopConsumers { get; set; } = [];

        /// <summary>
        /// Gets or sets the current configuration settings for display
        /// </summary>
        public SnapshotSettingsSummary Settings { get; set; } = new();

        /// <summary>
        /// Gets or sets the daily snapshot trend data for charting
        /// </summary>
        public List<TrendDataPoint> TrendData { get; set; } = [];

        /// <summary>
        /// Gets or sets the storage breakdown by media type category
        /// </summary>
        public List<MediaTypeBreakdownItem> MediaTypeBreakdown { get; set; } = [];
    }

    /// <summary>
    /// A single day's snapshot activity for trend charting
    /// </summary>
    public class TrendDataPoint
    {
        /// <summary>
        /// Gets or sets the date
        /// </summary>
        public DateOnly Date { get; set; }

        /// <summary>
        /// Gets or sets the number of snapshots created on this day
        /// </summary>
        public int Count { get; set; }

        /// <summary>
        /// Gets or sets the total size of snapshots created on this day in bytes
        /// </summary>
        public long SizeBytes { get; set; }
    }

    /// <summary>
    /// Storage breakdown for a single media type category (e.g. Image, Video)
    /// </summary>
    public class MediaTypeBreakdownItem
    {
        /// <summary>
        /// Gets or sets the category name (Image, Video, Audio, Document, Other)
        /// </summary>
        public string Category { get; set; } = string.Empty;

        /// <summary>
        /// Gets or sets the number of snapshots in this category
        /// </summary>
        public int Count { get; set; }

        /// <summary>
        /// Gets or sets the total size in bytes
        /// </summary>
        public long SizeBytes { get; set; }

        /// <summary>
        /// Gets or sets the formatted size string
        /// </summary>
        public string SizeFormatted { get; set; } = string.Empty;

        /// <summary>
        /// Gets or sets the percentage of total storage
        /// </summary>
        public double Percentage { get; set; }
    }
}
