using UmbracoMediaSnapshot.Core.Configuration;

namespace UmbracoMediaSnapshot.Core.Composers
{
    using Umbraco.Cms.Core.Composing;
    using Umbraco.Cms.Core.DependencyInjection;
    using Umbraco.Cms.Core.Notifications;
    using Umbraco.Extensions;
    using UmbracoMediaSnapshot.Core.Migrations;
    using UmbracoMediaSnapshot.Core.NotificationHandlers;

    /// <summary>
    /// Defines the <see cref="SnapshotComposer" />
    /// </summary>
    public class SnapshotComposer : IComposer
    {
        /// <summary>
        /// The Compose
        /// </summary>
        /// <param name="builder">The builder<see cref="IUmbracoBuilder"/></param>
        public void Compose(IUmbracoBuilder builder)
        {
            builder.Services.Configure<MediaSnapshotSettings>(builder.Config.GetSection("UmbracoMediaSnapshot"));

            builder.PackageMigrationPlans().Add<UmbracoMediaSnapshotMigrationPlan>();

            builder.AddNotificationAsyncHandler<MediaSavingNotification, SnapshotMediaSavingHandler>();
            builder.AddNotificationAsyncHandler<MediaSavedNotification, SnapshotMediaSavedHandler>();
            builder.AddNotificationAsyncHandler<MediaDeletedNotification, SnapshotMediaDeletedHandler>();
        }
    }
}
