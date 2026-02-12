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
    }
}
