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
}
