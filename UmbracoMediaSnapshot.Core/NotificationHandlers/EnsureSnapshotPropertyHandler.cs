namespace UmbracoMediaSnapshot.Core.NotificationHandlers
{
    using Services;
    using Umbraco.Cms.Core.Events;
    using Umbraco.Cms.Core.Models;
    using Umbraco.Cms.Core.Notifications;
    using Umbraco.Cms.Core.Services;
    using Umbraco.Cms.Core.Strings;
    using static Umbraco.Cms.Core.Constants;

    /// <summary>
    /// Runs on every application start to ensure that all configured target media types
    /// (including any added via AdditionalMediaTypes in appsettings) have the
    /// fileVersionHistory property. This covers types added after the initial migration
    /// </summary>
    public class EnsureSnapshotPropertyHandler : INotificationAsyncHandler<UmbracoApplicationStartedNotification>
    {
        /// <summary>
        /// Defines the PROPERTY_ALIAS
        /// </summary>
        private const string PROPERTY_ALIAS = "fileVersionHistory";

        /// <summary>
        /// Defines the PROPERTY_NAME
        /// </summary>
        private const string PROPERTY_NAME = "File Version History";

        /// <summary>
        /// Defines the PROPERTY_DESCRIPTION
        /// </summary>
        private const string PROPERTY_DESCRIPTION = "A list of all previous versions of this file";

        /// <summary>
        /// Defines the DATA_TYPE_NAME
        /// </summary>
        private const string DATA_TYPE_NAME = "Media Snapshot";

        /// <summary>
        /// Defines the DEFAULT_PROPERTY_GROUP
        /// </summary>
        private const string DEFAULT_PROPERTY_GROUP = "Contents";

        /// <summary>
        /// Defines the _mediaTypeService
        /// </summary>
        private readonly IMediaTypeService _mediaTypeService;

        /// <summary>
        /// Defines the _dataTypeService
        /// </summary>
        private readonly IDataTypeService _dataTypeService;

        /// <summary>
        /// Defines the _shortStringHelper
        /// </summary>
        private readonly IShortStringHelper _shortStringHelper;

        /// <summary>
        /// Defines the _blobService
        /// </summary>
        private readonly ISnapshotBlobService _blobService;

        /// <summary>
        /// Defines the _logger
        /// </summary>
        private readonly ILogger<EnsureSnapshotPropertyHandler> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="EnsureSnapshotPropertyHandler"/> class.
        /// </summary>
        /// <param name="mediaTypeService">The mediaTypeService<see cref="IMediaTypeService"/></param>
        /// <param name="dataTypeService">The dataTypeService<see cref="IDataTypeService"/></param>
        /// <param name="shortStringHelper">The shortStringHelper<see cref="IShortStringHelper"/></param>
        /// <param name="blobService">The blobService<see cref="ISnapshotBlobService"/></param>
        /// <param name="logger">The logger<see cref="ILogger{EnsureSnapshotPropertyHandler}"/></param>
        public EnsureSnapshotPropertyHandler(
            IMediaTypeService mediaTypeService,
            IDataTypeService dataTypeService,
            IShortStringHelper shortStringHelper,
            ISnapshotBlobService blobService,
            ILogger<EnsureSnapshotPropertyHandler> logger)
        {
            _mediaTypeService = mediaTypeService;
            _dataTypeService = dataTypeService;
            _shortStringHelper = shortStringHelper;
            _blobService = blobService;
            _logger = logger;
        }

        /// <summary>
        /// Checks all configured target media types and adds the fileVersionHistory
        /// property to any that are missing it
        /// </summary>
        /// <param name="notification">The notification<see cref="UmbracoApplicationStartedNotification"/></param>
        /// <param name="cancellationToken">The cancellationToken<see cref="CancellationToken"/></param>
        /// <returns>The <see cref="Task"/></returns>
        public async Task HandleAsync(UmbracoApplicationStartedNotification notification, CancellationToken cancellationToken)
        {
            try
            {
                // The data type must already exist (created by the migration)
                var dataType = await _dataTypeService.GetAsync(DATA_TYPE_NAME);
                if (dataType == null)
                {
                    _logger.LogDebug("'{DataTypeName}' data type not found — migration may not have run yet. Skipping startup check", DATA_TYPE_NAME);
                    return;
                }

                var addedCount = 0;

                foreach (var alias in _blobService.TargetMediaTypes)
                {
                    var mediaType = _mediaTypeService.Get(alias);
                    if (mediaType == null)
                    {
                        _logger.LogDebug("Media type '{Alias}' not found in Umbraco. Skipping", alias);
                        continue;
                    }

                    if (mediaType.PropertyTypeExists(PROPERTY_ALIAS))
                    {
                        continue;
                    }

                    // Add the property to this media type
                    var property = new PropertyType(_shortStringHelper, dataType, PROPERTY_ALIAS)
                    {
                        Name = PROPERTY_NAME,
                        Description = PROPERTY_DESCRIPTION,
                        Mandatory = false
                    };

                    var propertyGroup = GetPropertyGroupForMediaType(alias, mediaType);
                    mediaType.AddPropertyType(property, propertyGroup);

                    await _mediaTypeService.UpdateAsync(mediaType, Security.SuperUserKey);
                    addedCount++;

                    _logger.LogInformation(
                        "Added '{PropertyAlias}' property to media type '{Alias}' in group '{Group}'",
                        PROPERTY_ALIAS, alias, propertyGroup);
                }

                if (addedCount > 0)
                {
                    _logger.LogInformation(
                        "Startup check complete: added fileVersionHistory property to {Count} media type(s)",
                        addedCount);
                }
            }
            catch (Exception ex)
            {
                // Non-fatal — don't prevent the application from starting
                _logger.LogError(ex, "Error during startup media type property check");
            }
        }

        /// <summary>
        /// Determines the best property group for the given media type
        /// </summary>
        /// <param name="mediaTypeAlias">The mediaTypeAlias<see cref="string"/></param>
        /// <param name="mediaType">The mediaType<see cref="IMediaType"/></param>
        /// <returns>The <see cref="string"/></returns>
        private static string GetPropertyGroupForMediaType(string mediaTypeAlias, IMediaType mediaType)
        {
            // Image media type uses "Image" group
            if (mediaTypeAlias.Equals("Image", StringComparison.OrdinalIgnoreCase))
            {
                var imageGroup = mediaType.PropertyGroups
                    .FirstOrDefault(g => g.Name.Equals("Image", StringComparison.OrdinalIgnoreCase));
                return imageGroup?.Alias ?? "image";
            }

            // Check if the media type has a property group matching its own alias
            var matchingGroup = mediaType.PropertyGroups
                .FirstOrDefault(g => g.Name.Equals(mediaTypeAlias, StringComparison.OrdinalIgnoreCase));
            if (matchingGroup != null) return matchingGroup.Alias;

            // Check if there's a "File" group
            var fileGroup = mediaType.PropertyGroups
                .FirstOrDefault(g => g.Name.Equals("File", StringComparison.OrdinalIgnoreCase));
            if (fileGroup != null) return fileGroup.Alias;

            // Default to the first available group's alias
            return mediaType.PropertyGroups.FirstOrDefault()?.Alias ?? DEFAULT_PROPERTY_GROUP;
        }
    }
}
