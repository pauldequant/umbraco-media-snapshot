namespace UmbracoMediaSnapshot.Core.Models
{
    /// <summary>
    /// Request model for toggling the pinned state of a snapshot
    /// </summary>
    public class TogglePinRequest
    {
        /// <summary>
        /// Gets or sets the media item key
        /// </summary>
        public Guid MediaKey { get; set; }

        /// <summary>
        /// Gets or sets the snapshot blob filename
        /// </summary>
        public string SnapshotName { get; set; } = string.Empty;
    }
}
