namespace UmbracoMediaSnapshot.Core.Models
{
    /// <summary>
    /// Request model for deleting a single snapshot
    /// </summary>
    public class DeleteSnapshotRequest
    {
        /// <summary>
        /// Gets or sets the MediaKey that owns the snapshot
        /// </summary>
        public Guid MediaKey { get; set; }

        /// <summary>
        /// Gets or sets the SnapshotName (filename in the snapshots container)
        /// </summary>
        public string SnapshotName { get; set; } = string.Empty;
    }
}
