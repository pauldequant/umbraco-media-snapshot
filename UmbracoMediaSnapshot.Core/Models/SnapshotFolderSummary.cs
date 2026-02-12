namespace UmbracoMediaSnapshot.Core.Models
{
    /// <summary>
    /// Defines the <see cref="SnapshotFolderSummary" />
    /// </summary>
    public class SnapshotFolderSummary
    {
        /// <summary>
        /// Gets or sets the folder name (Umbraco media GUID folder)
        /// </summary>
        public string FolderName { get; set; } = string.Empty;

        /// <summary>
        /// Gets or sets the Umbraco media item key (GUID) if resolved
        /// </summary>
        public Guid? MediaKey { get; set; }

        /// <summary>
        /// Gets or sets the Umbraco media item name if resolved
        /// </summary>
        public string? MediaName { get; set; }

        /// <summary>
        /// Gets or sets the number of snapshots in this folder
        /// </summary>
        public int SnapshotCount { get; set; }

        /// <summary>
        /// Gets or sets the total size in bytes
        /// </summary>
        public long TotalSizeBytes { get; set; }

        /// <summary>
        /// Gets or sets the total size formatted as a human-readable string
        /// </summary>
        public string TotalSizeFormatted { get; set; } = string.Empty;

        /// <summary>
        /// Gets or sets the most recent snapshot date in this folder
        /// </summary>
        public DateTime? LatestSnapshotDate { get; set; }

        /// <summary>
        /// Gets or sets the oldest snapshot date in this folder
        /// </summary>
        public DateTime? OldestSnapshotDate { get; set; }
    }
}
