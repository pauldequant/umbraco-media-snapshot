namespace UmbracoMediaSnapshot.Core.Models
{
    /// <summary>
    /// Defines the <see cref="RestoreResultModel" />
    /// </summary>
    public class RestoreResultModel
    {
        /// <summary>
        /// Gets or sets a value indicating whether Success
        /// Gets or sets whether the restore was successful
        /// </summary>
        public bool Success { get; set; }

        /// <summary>
        /// Gets or sets the result message
        /// </summary>
        public string Message { get; set; } = string.Empty;

        /// <summary>
        /// Gets or sets the RestoredDate
        /// Gets or sets when the restore occurred
        /// </summary>
        public DateTime RestoredDate { get; set; }
    }
}
