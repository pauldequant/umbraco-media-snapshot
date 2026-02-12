namespace UmbracoMediaSnapshot.Core.Models
{
    /// <summary>
    /// Defines the <see cref="SnapshotSettingsSummary" />
    /// </summary>
    public class SnapshotSettingsSummary
    {
        /// <summary>
        /// Gets or sets the maximum snapshots per media item
        /// </summary>
        public int MaxSnapshotsPerMedia { get; set; }

        /// <summary>
        /// Gets or sets the maximum snapshot age in days
        /// </summary>
        public int MaxSnapshotAgeDays { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether EnableAutomaticCleanup
        /// Gets or sets whether automatic cleanup is enabled
        /// </summary>
        public bool EnableAutomaticCleanup { get; set; }

        /// <summary>
        /// Gets or sets the SAS token expiration in hours
        /// </summary>
        public int SasTokenExpirationHours { get; set; }
    }
}
