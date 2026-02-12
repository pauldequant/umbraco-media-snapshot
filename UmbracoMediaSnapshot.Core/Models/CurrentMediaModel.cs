namespace UmbracoMediaSnapshot.Core.Models
{
    /// <summary>
    /// Represents the current (live) media file metadata and a temporary download URL
    /// </summary>
    public class CurrentMediaModel
    {
        /// <summary>
        /// Gets or sets the Name
        /// </summary>
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Gets or sets the temporary SAS URL
        /// </summary>
        public string Url { get; set; } = string.Empty;

        /// <summary>
        /// Gets or sets the file size in bytes
        /// </summary>
        public long Size { get; set; }

        /// <summary>
        /// Gets or sets the content type
        /// </summary>
        public string? ContentType { get; set; }

        /// <summary>
        /// Gets or sets the last modified date
        /// </summary>
        public DateTime LastModified { get; set; }
    }
}
