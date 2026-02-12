namespace UmbracoMediaSnapshot.Core.Models
{
    /// <summary>
    /// Request model for deleting multiple snapshots at once
    /// </summary>
    public class BulkDeleteSnapshotsRequest
    {
        /// <summary>
        /// Gets or sets the MediaKey that owns the snapshots
        /// </summary>
        public Guid MediaKey { get; set; }

        /// <summary>
        /// Gets or sets the list of snapshot filenames to delete
        /// </summary>
        public List<string> SnapshotNames { get; set; } = [];
    }
}
