namespace UmbracoMediaSnapshot.Core.Migrations
{
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;
    using Services;
    using Umbraco.Cms.Core.Configuration.Models;
    using Umbraco.Cms.Core.IO;
    using Umbraco.Cms.Core.Models;
    using Umbraco.Cms.Core.PropertyEditors;
    using Umbraco.Cms.Core.Serialization;
    using Umbraco.Cms.Core.Services;
    using Umbraco.Cms.Core.Strings;
    using Umbraco.Cms.Infrastructure.Migrations;
    using Umbraco.Cms.Infrastructure.Packaging;
    using static Umbraco.Cms.Core.Constants;

    /// <summary>
    /// Defines the <see cref="UmbracoMediaSnapshotMigration" />
    /// </summary>
    public class UmbracoMediaSnapshotMigration : AsyncPackageMigrationBase
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
        /// Defines the PROPERTY_EDITOR_ALIAS
        /// </summary>
        private const string PROPERTY_EDITOR_ALIAS = "UmbracoMediaSnapshot.PropertyEditorUi";

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
        /// Defines the _serializer
        /// </summary>
        private readonly IConfigurationEditorJsonSerializer _serializer;

        /// <summary>
        /// Defines the _shortStringHelper
        /// </summary>
        private readonly IShortStringHelper _shortStringHelper;

        /// <summary>
        /// Defines the _propertyEditorCollection
        /// </summary>
        private readonly PropertyEditorCollection _propertyEditorCollection;

        /// <summary>
        /// Defines the _logger
        /// </summary>
        private readonly ILogger<UmbracoMediaSnapshotMigration> _logger;

        /// <summary>
        /// Defines the _blobService
        /// </summary>
        private readonly ISnapshotBlobService _blobService;

        /// <summary>
        /// Initializes a new instance of the <see cref="UmbracoMediaSnapshotMigration"/> class.
        /// </summary>
        /// <param name="packagingService">The packagingService<see cref="IPackagingService"/></param>
        /// <param name="mediaService">The mediaService<see cref="IMediaService"/></param>
        /// <param name="mediaFileManager">The mediaFileManager<see cref="MediaFileManager"/></param>
        /// <param name="mediaUrlGenerators">The mediaUrlGenerators<see cref="MediaUrlGeneratorCollection"/></param>
        /// <param name="shortStringHelper">The shortStringHelper<see cref="IShortStringHelper"/></param>
        /// <param name="contentTypeBaseServiceProvider">The contentTypeBaseServiceProvider<see cref="IContentTypeBaseServiceProvider"/></param>
        /// <param name="context">The context<see cref="IMigrationContext"/></param>
        /// <param name="packageMigrationsSettings">The packageMigrationsSettings<see cref="IOptions{PackageMigrationSettings}"/></param>
        /// <param name="mediaTypeService">The mediaTypeService<see cref="IMediaTypeService"/></param>
        /// <param name="dataTypeService">The dataTypeService<see cref="IDataTypeService"/></param>
        /// <param name="serializer">The serializer<see cref="IConfigurationEditorJsonSerializer"/></param>
        /// <param name="propertyEditorCollection">The propertyEditorCollection<see cref="PropertyEditorCollection"/></param>
        /// <param name="logger">The logger<see cref="ILogger{UmbracoMediaSnapshotMigration}"/></param>
        /// <param name="blobService">The blobService<see cref="ISnapshotBlobService"/></param>
        public UmbracoMediaSnapshotMigration(
            IPackagingService packagingService,
            IMediaService mediaService,
            MediaFileManager mediaFileManager,
            MediaUrlGeneratorCollection mediaUrlGenerators,
            IShortStringHelper shortStringHelper,
            IContentTypeBaseServiceProvider contentTypeBaseServiceProvider,
            IMigrationContext context,
            IOptions<PackageMigrationSettings> packageMigrationsSettings,
            IMediaTypeService mediaTypeService,
            IDataTypeService dataTypeService,
            IConfigurationEditorJsonSerializer serializer,
            PropertyEditorCollection propertyEditorCollection,
            ILogger<UmbracoMediaSnapshotMigration> logger,
            ISnapshotBlobService blobService)
            : base(packagingService, mediaService, mediaFileManager, mediaUrlGenerators, shortStringHelper, contentTypeBaseServiceProvider, context, packageMigrationsSettings)
        {
            _mediaTypeService = mediaTypeService ?? throw new ArgumentNullException(nameof(mediaTypeService));
            _dataTypeService = dataTypeService ?? throw new ArgumentNullException(nameof(dataTypeService));
            _serializer = serializer ?? throw new ArgumentNullException(nameof(serializer));
            _shortStringHelper = shortStringHelper ?? throw new ArgumentNullException(nameof(shortStringHelper));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _propertyEditorCollection = propertyEditorCollection ?? throw new ArgumentNullException(nameof(propertyEditorCollection));
            _blobService = blobService ?? throw new ArgumentNullException(nameof(blobService));
        }

        /// <summary>
        /// The MigrateAsync
        /// </summary>
        /// <returns>The <see cref="Task"/></returns>
        protected override async Task MigrateAsync()
        {
            try
            {
                _logger.LogInformation("Starting Media Snapshot migration for {Count} media types", _blobService.TargetMediaTypes.Count);

                var mediaSnapshotDataType = await GetOrCreateDataTypeAsync();
                if (mediaSnapshotDataType == null)
                {
                    _logger.LogError("Failed to get or create Media Snapshot data type. Migration aborted");
                    return;
                }

                var successCount = 0;
                var skippedCount = 0;
                var notFoundCount = 0;

                foreach (var mediaTypeAlias in _blobService.TargetMediaTypes)
                {
                    var result = await ProcessMediaTypeAsync(mediaTypeAlias, mediaSnapshotDataType);

                    switch (result)
                    {
                        case MigrationResult.Success:
                            successCount++;
                            break;
                        case MigrationResult.Skipped:
                            skippedCount++;
                            break;
                        case MigrationResult.NotFound:
                            notFoundCount++;
                            break;
                    }
                }

                _logger.LogInformation(
                    "Media Snapshot migration completed. Success: {SuccessCount}, Skipped: {SkippedCount}, Not Found: {NotFoundCount}",
                    successCount, skippedCount, notFoundCount);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred during Media Snapshot migration");
                throw;
            }
        }

        /// <summary>
        /// The ProcessMediaTypeAsync
        /// </summary>
        /// <param name="mediaTypeAlias">The mediaTypeAlias<see cref="string"/></param>
        /// <param name="dataType">The dataType<see cref="IDataType"/></param>
        /// <returns>The <see cref="Task{MigrationResult}"/></returns>
        private async Task<MigrationResult> ProcessMediaTypeAsync(string mediaTypeAlias, IDataType dataType)
        {
            var mediaType = _mediaTypeService.Get(mediaTypeAlias);

            if (mediaType == null)
            {
                _logger.LogWarning("Media type '{MediaTypeAlias}' not found. Skipping", mediaTypeAlias);
                return MigrationResult.NotFound;
            }

            if (mediaType.PropertyTypeExists(PROPERTY_ALIAS))
            {
                _logger.LogDebug("Property '{PropertyAlias}' already exists on '{MediaTypeAlias}' media type. Skipping", PROPERTY_ALIAS, mediaTypeAlias);
                return MigrationResult.Skipped;
            }

            AddPropertyToMediaType(mediaType, dataType, mediaTypeAlias);
            await _mediaTypeService.UpdateAsync(mediaType, Security.SuperUserKey);

            _logger.LogInformation("Successfully added property to '{MediaTypeAlias}' media type", mediaTypeAlias);
            return MigrationResult.Success;
        }

        /// <summary>
        /// The GetOrCreateDataTypeAsync
        /// </summary>
        /// <returns>The <see cref="Task{IDataType?}"/></returns>
        private async Task<IDataType?> GetOrCreateDataTypeAsync()
        {
            var dataType = await _dataTypeService.GetAsync(DATA_TYPE_NAME);

            if (dataType != null)
            {
                _logger.LogInformation("Found existing '{DataTypeName}' data type", DATA_TYPE_NAME);
                return dataType;
            }

            _logger.LogInformation("Data type '{DataTypeName}' not found. Creating new data type", DATA_TYPE_NAME);
            return await CreateDataTypeAsync();
        }

        /// <summary>
        /// The CreateDataTypeAsync
        /// </summary>
        /// <returns>The <see cref="Task{IDataType?}"/></returns>
        private async Task<IDataType?> CreateDataTypeAsync()
        {
            try
            {
                // DataType constructor REQUIRES a non-null IDataEditor
                // The editor is auto-discovered from your MediaSnapshotDataEditor class
                if (!_propertyEditorCollection.TryGet(PROPERTY_EDITOR_ALIAS, out var editor))
                {
                    // Log available editors for debugging
                    var availableEditors = string.Join(", ", _propertyEditorCollection.Select(e => e.Alias));
                    _logger.LogError(
                        "Property editor '{PropertyEditorAlias}' not found in PropertyEditorCollection. " +
                        "Available editors: {AvailableEditors}. " +
                        "Ensure MediaSnapshotDataEditor is properly configured with [DataEditor] attribute.",
                        PROPERTY_EDITOR_ALIAS,
                        availableEditors);
                    return null;
                }

                _logger.LogInformation("Found property editor '{PropertyEditorAlias}' in collection", PROPERTY_EDITOR_ALIAS);

                // Create DataType with the IDataEditor instance
                // EditorUiAlias links this to the client-side Property Editor UI in umbraco-package.json
                var dataType = new DataType(editor, _serializer, -1)
                {
                    Name = DATA_TYPE_NAME,
                    DatabaseType = ValueStorageType.Ntext, // JSON storage
                    EditorUiAlias = PROPERTY_EDITOR_ALIAS, // Links to client-side UI
                                                           // ConfigurationData is automatically set by constructor to editor.GetConfigurationEditor().DefaultConfiguration
                };

                var result = await _dataTypeService.CreateAsync(dataType, Security.SuperUserKey);

                if (result.Success)
                {
                    _logger.LogInformation(
                        "Created new data type '{DataTypeName}' with EditorAlias '{EditorAlias}' and EditorUiAlias '{EditorUiAlias}'",
                        DATA_TYPE_NAME,
                        dataType.EditorAlias,
                        dataType.EditorUiAlias);
                    return result.Result;
                }
                else
                {
                    _logger.LogError(
                        "Failed to create data type '{DataTypeName}'. Status: {Status}. Exception: {Exception}",
                        DATA_TYPE_NAME,
                        result.Status,
                        result.Exception?.Message ?? "No exception details");
                    return null;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception while creating data type '{DataTypeName}'", DATA_TYPE_NAME);
                return null;
            }
        }

        /// <summary>
        /// The AddPropertyToMediaType
        /// </summary>
        /// <param name="mediaType">The mediaType<see cref="IMediaType"/></param>
        /// <param name="dataType">The dataType<see cref="IDataType"/></param>
        /// <param name="mediaTypeAlias">The mediaTypeAlias<see cref="string"/></param>
        private void AddPropertyToMediaType(IMediaType mediaType, IDataType dataType, string mediaTypeAlias)
        {
            var property = new PropertyType(_shortStringHelper, dataType, PROPERTY_ALIAS)
            {
                Name = PROPERTY_NAME,
                Description = PROPERTY_DESCRIPTION,
                Mandatory = false
            };

            // Determine the appropriate property group based on media type
            var propertyGroup = GetPropertyGroupForMediaType(mediaTypeAlias, mediaType);

            mediaType.AddPropertyType(property, propertyGroup);
            _logger.LogDebug("Added property '{PropertyAlias}' to '{MediaTypeAlias}' in group '{PropertyGroup}'",
                PROPERTY_ALIAS, mediaTypeAlias, propertyGroup);
        }

        /// <summary>
        /// The GetPropertyGroupForMediaType
        /// </summary>
        /// <param name="mediaTypeAlias">The mediaTypeAlias<see cref="string"/></param>
        /// <param name="mediaType">The mediaType<see cref="IMediaType"/></param>
        /// <returns>The <see cref="string"/></returns>
        private string GetPropertyGroupForMediaType(string mediaTypeAlias, IMediaType mediaType)
        {
            // Image media type uses "Image" group
            if (mediaTypeAlias == "Image")
            {
                var imageGroup = mediaType.PropertyGroups.FirstOrDefault(g => g.Name.Equals("Image", StringComparison.OrdinalIgnoreCase));
                return imageGroup?.Alias ?? "image";
            }

            // Check if the media type has a property group matching its own alias
            var matchingGroup = mediaType.PropertyGroups.FirstOrDefault(g => g.Name.Equals(mediaTypeAlias, StringComparison.OrdinalIgnoreCase));
            if (matchingGroup != null)
            {
                return matchingGroup.Alias;
            }

            // Check if there's a "File" group
            var fileGroup = mediaType.PropertyGroups.FirstOrDefault(g => g.Name.Equals("File", StringComparison.OrdinalIgnoreCase));
            if (fileGroup != null)
            {
                return fileGroup.Alias;
            }

            // Default to the first available group's alias
            return mediaType.PropertyGroups.FirstOrDefault()?.Alias ?? DEFAULT_PROPERTY_GROUP;
        }

        /// <summary>
        /// Defines the MigrationResult
        /// </summary>
        private enum MigrationResult
        {
            /// <summary>
            /// Defines the Success
            /// </summary>
            Success,

            /// <summary>
            /// Defines the Skipped
            /// </summary>
            Skipped,

            /// <summary>
            /// Defines the NotFound
            /// </summary>
            NotFound
        }
    }
}
