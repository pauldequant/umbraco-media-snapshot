namespace UmbracoMediaSnapshot.Core.Services
{
    using Azure.Storage.Blobs;
    using Azure.Storage.Blobs.Models;
    using Configuration;
    using Microsoft.Extensions.Configuration;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;
    using System.Collections.Frozen;
    using System.Text.Json;

    /// <summary>
    /// Defines the <see cref="SnapshotBlobService" />
    /// </summary>
    public class SnapshotBlobService : ISnapshotBlobService
    {
        /// <summary>
        /// Defines the _blobServiceClient
        /// </summary>
        private readonly BlobServiceClient _blobServiceClient;

        /// <summary>
        /// Defines the _mediaContainerName
        /// </summary>
        private readonly string _mediaContainerName;

        /// <summary>
        /// Defines the _settings
        /// </summary>
        private readonly MediaSnapshotSettings _settings;

        /// <summary>
        /// Defines the _logger
        /// </summary>
        private readonly ILogger<SnapshotBlobService> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="SnapshotBlobService"/> class.
        /// </summary>
        /// <param name="blobServiceClient">The blobServiceClient<see cref="BlobServiceClient"/></param>
        /// <param name="configuration">The configuration<see cref="IConfiguration"/></param>
        /// <param name="settings">The settings<see cref="IOptions{MediaSnapshotSettings}"/></param>
        /// <param name="logger">The logger<see cref="ILogger{SnapshotBlobService}"/></param>
        public SnapshotBlobService(
            BlobServiceClient blobServiceClient,
            IConfiguration configuration,
            IOptions<MediaSnapshotSettings> settings,
            ILogger<SnapshotBlobService> logger)
        {
            _blobServiceClient = blobServiceClient;
            _mediaContainerName = configuration.GetValue<string>("Umbraco:Storage:AzureBlob:Media:ContainerName") ?? "umbraco";
            _settings = settings.Value;
            _logger = logger;
        }

        /// <inheritdoc />

        /// <summary>
        /// Gets the SnapshotContainerName
        /// </summary>
        public string SnapshotContainerName => "umbraco-snapshots";

        /// <inheritdoc />

        /// <summary>
        /// The GetSnapshotContainer
        /// </summary>
        /// <returns>The <see cref="BlobContainerClient"/></returns>
        public BlobContainerClient GetSnapshotContainer()
            => _blobServiceClient.GetBlobContainerClient(SnapshotContainerName);

        /// <inheritdoc />

        /// <summary>
        /// The GetMediaContainer
        /// </summary>
        /// <returns>The <see cref="BlobContainerClient"/></returns>
        public BlobContainerClient GetMediaContainer()
            => _blobServiceClient.GetBlobContainerClient(_mediaContainerName);

        /// <inheritdoc />

        /// <summary>
        /// The TargetMediaTypes
        /// </summary>
        public IReadOnlyCollection<string> TargetMediaTypes => TargetMediaTypesSet;

        private static readonly FrozenSet<string> TargetMediaTypesSet = FrozenSet.ToFrozenSet(
        [
            "umbracoMediaArticle",
            "umbracoMediaAudio",
            "File",
            "Image",
            "umbracoMediaVectorGraphics",
            "umbracoMediaVideo"
        ]);

        /// <inheritdoc />

        /// <summary>
        /// The IsTargetMediaType
        /// </summary>
        /// <param name="alias">The alias<see cref="string"/></param>
        /// <returns>The <see cref="bool"/></returns>
        public bool IsTargetMediaType(string alias)
            => TargetMediaTypesSet.Contains(alias);

        /// <inheritdoc />

        /// <summary>
        /// The GetRawBlobPath
        /// </summary>
        /// <param name="value">The value<see cref="string?"/></param>
        /// <returns>The <see cref="string?"/></returns>
        public string? GetRawBlobPath(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;

            string? rawPath;
            if (value.Trim().StartsWith("{"))
            {
                try
                {
                    var json = JsonSerializer.Deserialize<JsonElement>(value);
                    rawPath = json.TryGetProperty("src", out var src) ? src.GetString() : null;
                }
                catch { return null; }
            }
            else
            {
                rawPath = value;
            }

            return rawPath?.TrimStart('/');
        }

        /// <inheritdoc />

        /// <summary>
        /// The ExtractFolderPath
        /// </summary>
        /// <param name="value">The value<see cref="string?"/></param>
        /// <returns>The <see cref="string?"/></returns>
        public string? ExtractFolderPath(string? value)
        {
            var rawPath = GetRawBlobPath(value);
            if (string.IsNullOrEmpty(rawPath)) return null;

            var parts = rawPath.Split('/', StringSplitOptions.RemoveEmptyEntries);

            // "media/if3f2s40/file.csv" → "if3f2s40"
            if (parts.Length > 1 && parts[0].Equals("media", StringComparison.OrdinalIgnoreCase))
                return parts[1];

            return parts.Length > 0 ? parts[0] : null;
        }

        /// <inheritdoc />

        /// <summary>
        /// The ExtractFilePath
        /// </summary>
        /// <param name="value">The value<see cref="string?"/></param>
        /// <returns>The <see cref="string?"/></returns>
        public string? ExtractFilePath(string? value)
        {
            if (string.IsNullOrEmpty(value)) return null;

            if (value.Trim().StartsWith("{"))
            {
                try
                {
                    var json = JsonSerializer.Deserialize<JsonElement>(value);
                    return json.TryGetProperty("src", out var src) ? src.GetString() : null;
                }
                catch { return null; }
            }

            return value;
        }

        /// <inheritdoc />

        /// <summary>
        /// The CleanupOldSnapshotsAsync
        /// </summary>
        /// <param name="folderPrefix">The folderPrefix<see cref="string"/></param>
        /// <param name="cancellationToken">The cancellationToken<see cref="CancellationToken"/></param>
        /// <returns>The <see cref="Task"/></returns>
        public async Task CleanupOldSnapshotsAsync(string folderPrefix, CancellationToken cancellationToken)
        {
            if (!_settings.EnableAutomaticCleanup) return;

            var snapshotContainer = GetSnapshotContainer();
            var snapshots = new List<BlobItem>();
            await foreach (var blob in snapshotContainer.GetBlobsAsync(prefix: folderPrefix, cancellationToken: cancellationToken))
            {
                snapshots.Add(blob);
            }

            var ordered = snapshots
                .OrderByDescending(b => b.Properties.LastModified)
                .ToList();

            var ageCutoff = DateTimeOffset.UtcNow.AddDays(-_settings.MaxSnapshotAgeDays);

            var toDelete = ordered
                .Where((blob, index) =>
                    index >= _settings.MaxSnapshotsPerMedia
                    || blob.Properties.LastModified < ageCutoff)
                .ToList();

            foreach (var blob in toDelete)
            {
                var reason = blob.Properties.LastModified < ageCutoff ? "expired" : "over limit";
                _logger.LogInformation("Deleting {Reason} snapshot: {BlobName}", reason, blob.Name);
                await snapshotContainer.DeleteBlobIfExistsAsync(blob.Name, cancellationToken: cancellationToken);
            }
        }
    }
}
