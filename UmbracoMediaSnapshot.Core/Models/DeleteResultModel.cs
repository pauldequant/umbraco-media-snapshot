namespace UmbracoMediaSnapshot.Core.Models
{
    /// <summary>
    /// Result model returned after a delete operation
    /// </summary>
    public class DeleteResultModel
    {
        /// <summary>
        /// Gets or sets a value indicating whether the operation succeeded
        /// </summary>
        public bool Success { get; set; }

        /// <summary>
        /// Gets or sets the result message
        /// </summary>
        public string Message { get; set; } = string.Empty;

        /// <summary>
        /// Gets or sets the number of snapshots deleted
        /// </summary>
        public int DeletedCount { get; set; }
    }
}
