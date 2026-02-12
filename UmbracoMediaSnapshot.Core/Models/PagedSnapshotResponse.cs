namespace UmbracoMediaSnapshot.Core.Models
{
    /// <summary>
    /// Paginated response for snapshot versions
    /// </summary>
    public class PagedSnapshotResponse
    {
        /// <summary>
        /// Gets or sets the snapshot versions for the current page
        /// </summary>
        public List<SnapshotVersionModel> Items { get; set; } = [];

        /// <summary>
        /// Gets or sets the total number of snapshots across all pages
        /// </summary>
        public int TotalCount { get; set; }

        /// <summary>
        /// Gets or sets the current page number (1-based)
        /// </summary>
        public int Page { get; set; }

        /// <summary>
        /// Gets or sets the page size
        /// </summary>
        public int PageSize { get; set; }

        /// <summary>
        /// Gets or sets the total number of pages
        /// </summary>
        public int TotalPages { get; set; }

        /// <summary>
        /// Gets or sets the total size in bytes across all snapshots (not just this page)
        /// </summary>
        public long TotalSizeBytes { get; set; }

        /// <summary>
        /// Gets or sets the oldest snapshot date across all snapshots
        /// </summary>
        public DateTime? OldestDate { get; set; }

        /// <summary>
        /// Gets or sets the newest snapshot date across all snapshots
        /// </summary>
        public DateTime? NewestDate { get; set; }

        /// <summary>
        /// Gets or sets the number of unique uploaders across all snapshots
        /// </summary>
        public int UniqueUploaderCount { get; set; }
    }
}
