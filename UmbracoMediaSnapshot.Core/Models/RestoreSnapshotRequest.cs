namespace UmbracoMediaSnapshot.Core.Models
{
    /// <summary>
    /// Defines the <see cref="RestoreSnapshotRequest" />
    /// </summary>
    public class RestoreSnapshotRequest
    {
        /// <summary>
        /// Gets or sets the MediaKey
        /// </summary>
        public Guid MediaKey { get; set; }

        /// <summary>
        /// Gets or sets the SnapshotName (filename in the snapshots container)
        /// </summary>
        public string SnapshotName { get; set; } = string.Empty;
    }
}
