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
        /// Gets or sets the interval in minutes between background cleanup runs
        /// </summary>
        public int CleanupIntervalMinutes { get; set; }

        /// <summary>
        /// Gets or sets the SAS token expiration in hours
        /// </summary>
        public int SasTokenExpirationHours { get; set; }

        /// <summary>
        /// Gets or sets the effective list of tracked media type aliases
        /// (built-in + any user-configured additional types)
        /// </summary>
        public List<string> TrackedMediaTypes { get; set; } = [];

        /// <summary>
        /// Gets or sets the storage quota warning threshold in gigabytes.
        /// 0 means quota warnings are disabled.
        /// </summary>
        public double StorageQuotaWarningGB { get; set; }

        /// <summary>
        /// Gets or sets whether the current total storage exceeds the configured quota
        /// </summary>
        public bool QuotaExceeded { get; set; }

        /// <summary>
        /// Gets or sets the percentage of quota used (0–100+). Null when quota is disabled.
        /// </summary>
        public double? QuotaUsagePercent { get; set; }
    }
}
