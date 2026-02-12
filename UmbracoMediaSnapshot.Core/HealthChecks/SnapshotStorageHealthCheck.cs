namespace UmbracoMediaSnapshot.Core.HealthChecks
{
    using Azure;
    using Azure.Storage.Blobs;
    using Azure.Storage.Sas;
    using Configuration;
    using Microsoft.Extensions.Options;
    using Services;
    using Umbraco.Cms.Core.HealthChecks;

    /// <summary>
    /// Umbraco Health Check that verifies the snapshot infrastructure is correctly
    /// configured and operational. Checks Azure Blob Storage connectivity,
    /// snapshot container access, media container access, and SAS token generation.
    /// </summary>
    [HealthCheck(
        "E4A6F9B2-7C3D-4A1E-B8F5-2D9C0E1A3B4F",
        "Media Snapshot Storage",
        Description = "Checks that Azure Blob Storage is accessible and the snapshot container is operational.",
        Group = "Media")]
    public class SnapshotStorageHealthCheck : HealthCheck
    {
        /// <summary>
        /// Defines the _blobService
        /// </summary>
        private readonly ISnapshotBlobService _blobService;

        /// <summary>
        /// Defines the _blobServiceClient
        /// </summary>
        private readonly BlobServiceClient _blobServiceClient;

        /// <summary>
        /// Defines the _settings
        /// </summary>
        private readonly MediaSnapshotSettings _settings;

        /// <summary>
        /// Initializes a new instance of the <see cref="SnapshotStorageHealthCheck"/> class.
        /// </summary>
        /// <param name="blobService">The blobService<see cref="ISnapshotBlobService"/></param>
        /// <param name="blobServiceClient">The blobServiceClient<see cref="BlobServiceClient"/></param>
        /// <param name="settings">The settings<see cref="IOptions{MediaSnapshotSettings}"/></param>
        public SnapshotStorageHealthCheck(
            ISnapshotBlobService blobService,
            BlobServiceClient blobServiceClient,
            IOptions<MediaSnapshotSettings> settings)
        {
            _blobService = blobService;
            _blobServiceClient = blobServiceClient;
            _settings = settings.Value;
        }

        /// <summary>
        /// Runs all snapshot storage health checks and returns the results
        /// </summary>
        /// <returns>The <see cref="Task{IEnumerable{HealthCheckStatus}}"/></returns>
        public override async Task<IEnumerable<HealthCheckStatus>> GetStatusAsync()
        {
            var results = new List<HealthCheckStatus>();

            results.Add(await CheckAzureConnectivity());
            results.Add(await CheckSnapshotContainer());
            results.Add(await CheckMediaContainer());
            results.Add(CheckSasTokenGeneration());
            results.Add(CheckConfiguration());

            return results;
        }

        /// <summary>
        /// Not applicable — this health check is read-only diagnostics
        /// </summary>
        /// <param name="action">The action<see cref="HealthCheckAction"/></param>
        /// <returns>The <see cref="HealthCheckStatus"/></returns>
        public override HealthCheckStatus ExecuteAction(HealthCheckAction action)
        {
            return new HealthCheckStatus("No actions available for this health check.")
            {
                ResultType = StatusResultType.Info
            };
        }

        /// <summary>
        /// Verifies the BlobServiceClient can reach Azure Storage by requesting account info
        /// </summary>
        /// <returns>The <see cref="Task{HealthCheckStatus}"/></returns>
        private async Task<HealthCheckStatus> CheckAzureConnectivity()
        {
            try
            {
                var properties = await _blobServiceClient.GetPropertiesAsync();

                return new HealthCheckStatus("Azure Blob Storage connection is healthy.")
                {
                    ResultType = StatusResultType.Success,
                    Description = $"Connected to storage account. Default service version: {properties.Value.DefaultServiceVersion ?? "N/A"}."
                };
            }
            catch (RequestFailedException ex)
            {
                return new HealthCheckStatus("Azure Blob Storage connection failed.")
                {
                    ResultType = StatusResultType.Error,
                    Description = $"Unable to connect to Azure Blob Storage. Status: {ex.Status}, Error: {ex.Message}. " +
                                  "Verify the connection string at 'Umbraco:Storage:AzureBlob:Media:ConnectionString'."
                };
            }
            catch (Exception ex)
            {
                return new HealthCheckStatus("Azure Blob Storage connection failed.")
                {
                    ResultType = StatusResultType.Error,
                    Description = $"Unexpected error connecting to Azure Blob Storage: {ex.Message}. " +
                                  "Verify the connection string at 'Umbraco:Storage:AzureBlob:Media:ConnectionString'."
                };
            }
        }

        /// <summary>
        /// Verifies the umbraco-snapshots container exists and is accessible
        /// </summary>
        /// <returns>The <see cref="Task{HealthCheckStatus}"/></returns>
        private async Task<HealthCheckStatus> CheckSnapshotContainer()
        {
            try
            {
                var container = _blobService.GetSnapshotContainer();
                var exists = await container.ExistsAsync();

                if (exists)
                {
                    // Verify we can list blobs (proves read permission)
                    var count = 0;
                    await foreach (var _ in container.GetBlobsAsync().ConfigureAwait(false))
                    {
                        count++;
                        if (count >= 1) break; // Only need to prove enumeration works
                    }

                    return new HealthCheckStatus($"Snapshot container '{_blobService.SnapshotContainerName}' is accessible.")
                    {
                        ResultType = StatusResultType.Success,
                        Description = "Container exists and blob enumeration is working."
                    };
                }

                return new HealthCheckStatus($"Snapshot container '{_blobService.SnapshotContainerName}' does not exist yet.")
                {
                    ResultType = StatusResultType.Warning,
                    Description = "The container will be created automatically when the first media file is saved. This is normal for a fresh installation."
                };
            }
            catch (RequestFailedException ex)
            {
                return new HealthCheckStatus($"Snapshot container '{_blobService.SnapshotContainerName}' is not accessible.")
                {
                    ResultType = StatusResultType.Error,
                    Description = $"Failed to access snapshot container. Status: {ex.Status}, Error: {ex.Message}. " +
                                  "Check storage account permissions."
                };
            }
        }

        /// <summary>
        /// Verifies the Umbraco media container exists and is accessible
        /// </summary>
        /// <returns>The <see cref="Task{HealthCheckStatus}"/></returns>
        private async Task<HealthCheckStatus> CheckMediaContainer()
        {
            try
            {
                var container = _blobService.GetMediaContainer();
                var exists = await container.ExistsAsync();

                if (exists)
                {
                    return new HealthCheckStatus("Umbraco media container is accessible.")
                    {
                        ResultType = StatusResultType.Success,
                        Description = "The media container exists and is reachable."
                    };
                }

                return new HealthCheckStatus("Umbraco media container does not exist.")
                {
                    ResultType = StatusResultType.Error,
                    Description = "The media container configured at 'Umbraco:Storage:AzureBlob:Media:ContainerName' could not be found. " +
                                  "Media snapshot operations will fail."
                };
            }
            catch (RequestFailedException ex)
            {
                return new HealthCheckStatus("Umbraco media container is not accessible.")
                {
                    ResultType = StatusResultType.Error,
                    Description = $"Failed to access media container. Status: {ex.Status}, Error: {ex.Message}."
                };
            }
        }

        /// <summary>
        /// Verifies that SAS token generation is possible (requires account key or user delegation)
        /// </summary>
        /// <returns>The <see cref="HealthCheckStatus"/></returns>
        private HealthCheckStatus CheckSasTokenGeneration()
        {
            try
            {
                var container = _blobService.GetSnapshotContainer();
                var testBlob = container.GetBlobClient("__healthcheck_test__");

                // Attempt to build a SAS URI — this validates that the credential supports signing
                var sasUri = testBlob.GenerateSasUri(BlobSasPermissions.Read, DateTimeOffset.UtcNow.AddMinutes(5));

                if (sasUri != null && sasUri.Query.Contains("sig="))
                {
                    return new HealthCheckStatus("SAS token generation is working.")
                    {
                        ResultType = StatusResultType.Success,
                        Description = $"Download links will be valid for {_settings.SasTokenExpirationHours} hour(s) as configured."
                    };
                }

                return new HealthCheckStatus("SAS token generation returned an unexpected result.")
                {
                    ResultType = StatusResultType.Warning,
                    Description = "A SAS URI was generated but may not contain a valid signature."
                };
            }
            catch (InvalidOperationException)
            {
                return new HealthCheckStatus("SAS token generation is not supported.")
                {
                    ResultType = StatusResultType.Error,
                    Description = "The storage account credential does not support SAS token generation. " +
                                  "Ensure the connection string includes an account key, or configure user delegation SAS. " +
                                  "Without SAS support, snapshot download links will not work."
                };
            }
            catch (Exception ex)
            {
                return new HealthCheckStatus("SAS token generation check failed.")
                {
                    ResultType = StatusResultType.Error,
                    Description = $"Unexpected error testing SAS generation: {ex.Message}"
                };
            }
        }

        /// <summary>
        /// Validates the current MediaSnapshotSettings for potential misconfigurations
        /// </summary>
        /// <returns>The <see cref="HealthCheckStatus"/></returns>
        private HealthCheckStatus CheckConfiguration()
        {
            var warnings = new List<string>();

            if (_settings.MaxSnapshotsPerMedia <= 0)
            {
                warnings.Add("MaxSnapshotsPerMedia is unlimited (0). Snapshot storage may grow unbounded.");
            }

            if (_settings.MaxSnapshotAgeDays <= 0)
            {
                warnings.Add("MaxSnapshotAgeDays is unlimited (0). Old snapshots will never be auto-deleted.");
            }

            if (!_settings.EnableAutomaticCleanup)
            {
                warnings.Add("Automatic cleanup is disabled. Snapshots will accumulate until manually deleted.");
            }

            if (_settings.SasTokenExpirationHours <= 0)
            {
                warnings.Add("SasTokenExpirationHours is 0 or negative. Download links may not work.");
            }

            if (warnings.Count > 0)
            {
                return new HealthCheckStatus("Configuration has potential issues.")
                {
                    ResultType = StatusResultType.Warning,
                    Description = string.Join(" ", warnings)
                };
            }

            return new HealthCheckStatus("Configuration is valid.")
            {
                ResultType = StatusResultType.Success,
                Description = $"Max snapshots: {_settings.MaxSnapshotsPerMedia}, " +
                              $"Max age: {_settings.MaxSnapshotAgeDays} days, " +
                              $"Auto-cleanup: {(_settings.EnableAutomaticCleanup ? "enabled" : "disabled")}, " +
                              $"SAS expiry: {_settings.SasTokenExpirationHours}h, " +
                              $"Tracked types: {_blobService.TargetMediaTypes.Count}."
            };
        }
    }
}
