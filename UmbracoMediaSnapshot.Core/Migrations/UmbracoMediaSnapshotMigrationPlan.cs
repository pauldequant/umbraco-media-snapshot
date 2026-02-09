namespace UmbracoMediaSnapshot.Core.Migrations
{
    using Umbraco.Cms.Core.Packaging;

    /// <summary>
    /// Defines the <see cref="UmbracoMediaSnapshotMigrationPlan" />
    /// </summary>
    public class UmbracoMediaSnapshotMigrationPlan : PackageMigrationPlan
    {
        // 1. MUST be a parameterless constructor

        /// <summary>
        /// Initializes a new instance of the <see cref="UmbracoMediaSnapshotMigrationPlan"/> class.
        /// </summary>
        public UmbracoMediaSnapshotMigrationPlan()
            : base("UmbracoMediaSnapshot")
        {
        }

        /// <summary>
        /// The DefinePlan
        /// </summary>
        protected override void DefinePlan()
        {
            // 3. This points to your migration logic step
            To<UmbracoMediaSnapshotMigration>("DataType Setup");
        }
    }
}
