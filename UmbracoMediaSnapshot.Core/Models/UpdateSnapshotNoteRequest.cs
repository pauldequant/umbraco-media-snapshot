namespace UmbracoMediaSnapshot.Core.Models
{
    /// <summary>
    /// Request model for adding or updating a note on a snapshot
    /// </summary>
    public class UpdateSnapshotNoteRequest
    {
        /// <summary>
        /// Gets or sets the MediaKey that owns the snapshot
        /// </summary>
        public Guid MediaKey { get; set; }

        /// <summary>
        /// Gets or sets the SnapshotName (filename in the snapshots container)
        /// </summary>
        public string SnapshotName { get; set; } = string.Empty;

        /// <summary>
        /// Gets or sets the note text (empty string to clear)
        /// </summary>
        public string Note { get; set; } = string.Empty;
    }
}
