namespace UmbracoMediaSnapshot.Core.Composers
{
    using Azure.Storage.Blobs;
    using BackgroundTasks;
    using Configuration;
    using Microsoft.Extensions.DependencyInjection;
    using Migrations;
    using NotificationHandlers;
    using Services;
    using Umbraco.Cms.Core.Composing;
    using Umbraco.Cms.Core.DependencyInjection;
    using Umbraco.Cms.Core.Notifications;
    using Umbraco.Extensions;

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

            // Ensure IMemoryCache is available for the stats cache
            builder.Services.AddMemoryCache();

            builder.Services.AddSingleton(sp =>
            {
                var configuration = sp.GetRequiredService<IConfiguration>();
                var connectionString = configuration.GetValue<string>("Umbraco:Storage:AzureBlob:Media:ConnectionString");
                return string.IsNullOrEmpty(connectionString)
                    ? throw new InvalidOperationException("Azure Blob Storage connection string is not configured at 'Umbraco:Storage:AzureBlob:Media:ConnectionString'.")
                    : new BlobServiceClient(connectionString);
            });

            builder.Services.AddSingleton<ISnapshotBlobService, SnapshotBlobService>();
            builder.Services.AddSingleton<ISnapshotStatsCache, SnapshotStatsCache>();

            builder.PackageMigrationPlans().Add<UmbracoMediaSnapshotMigrationPlan>();

            builder.AddNotificationAsyncHandler<MediaSavingNotification, SnapshotMediaSavingHandler>();
            builder.AddNotificationAsyncHandler<MediaSavedNotification, SnapshotMediaSavedHandler>();
            builder.AddNotificationAsyncHandler<MediaDeletedNotification, SnapshotMediaDeletedHandler>();

            // Ensure all configured media types have the fileVersionHistory property on startup
            builder.AddNotificationAsyncHandler<UmbracoApplicationStartedNotification, EnsureSnapshotPropertyHandler>();

            // Register the recurring background cleanup task
            builder.Services.AddRecurringBackgroundJob<SnapshotCleanupTask>();
        }
    }
}
