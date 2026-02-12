namespace UmbracoMediaSnapshot.Core.Configuration
{
    /// <summary>
    /// Defines the <see cref="MediaSnapshotSettings" />
    /// </summary>
    public class MediaSnapshotSettings
    {
        /// <summary>
        /// Defines the SectionName
        /// </summary>
        public const string SectionName = "UmbracoMediaSnapshot";

        /// <summary>
        /// Gets or sets the MaxSnapshotsPerMedia
        /// Maximum number of snapshots to retain per media item (default: 10)
        /// </summary>
        public int MaxSnapshotsPerMedia { get; set; } = 10;

        /// <summary>
        /// Gets or sets the MaxSnapshotAgeDays
        /// Maximum age in days to retain snapshots (default: 365)
        /// </summary>
        public int MaxSnapshotAgeDays { get; set; } = 365;

        /// <summary>
        /// Gets or sets the SasTokenExpirationHours
        /// SAS token expiration in hours (default: 1)
        /// </summary>
        public int SasTokenExpirationHours { get; set; } = 1;

        /// <summary>
        /// Gets or sets a value indicating whether EnableAutomaticCleanup
        /// Enable automatic cleanup of old snapshots (default: true)
        /// </summary>
        public bool EnableAutomaticCleanup { get; set; } = true;

        /// <summary>
        /// Gets or sets the interval in minutes between cleanup runs (default: 60).
        /// Only applies when <see cref="EnableAutomaticCleanup"/> is true.
        /// </summary>
        public int CleanupIntervalMinutes { get; set; } = 60;

        /// <summary>
        /// Gets or sets additional media type aliases to include in snapshot tracking.
        /// The built-in types (Image, File, umbracoMediaArticle, etc.) are always included.
        /// </summary>
        public List<string> AdditionalMediaTypes { get; set; } = [];
    }
}
