namespace UmbracoMediaSnapshot.Core.Models
{
    /// <summary>
    /// Defines the <see cref="SnapshotVersionModel" />
    /// </summary>
    public class SnapshotVersionModel
    {
        /// <summary>
        /// Gets or sets the Name
        /// </summary>
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Gets or sets the Date
        /// </summary>
        public DateTime Date { get; set; }

        /// <summary>
        /// Gets or sets the Size
        /// </summary>
        public long Size { get; set; }

        /// <summary>
        /// Gets or sets the Url
        /// </summary>
        public string Url { get; set; } = string.Empty;

        /// <summary>
        /// Gets or sets the Uploader
        /// </summary>
        public string Uploader { get; set; } = string.Empty;

        /// <summary>
        /// Gets or sets a value indicating whether IsRestored
        /// Gets or sets whether this is a restored version
        /// </summary>
        public bool IsRestored { get; set; }

        /// <summary>
        /// Gets or sets the date when this was restored (if applicable)
        /// </summary>
        public DateTime? RestoredDate { get; set; }

        /// <summary>
        /// Gets or sets the original snapshot this was restored from
        /// </summary>
        public string? RestoredFrom { get; set; }
    }
}
