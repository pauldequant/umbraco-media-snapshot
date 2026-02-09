namespace UmbracoMediaSnapshot.Core.Controllers
{
    using Azure.Storage.Blobs;
    using Azure.Storage.Blobs.Models;
    using Azure.Storage.Sas;
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.Extensions.Configuration;
    using System.Text.Json;
    using Umbraco.Cms.Api.Management.Controllers;
    using Umbraco.Cms.Api.Management.Routing;
    using Umbraco.Cms.Core.Services;

    /// <summary>
    /// Defines the <see cref="SnapshotApiController" />
    /// </summary>
    [VersionedApiBackOfficeRoute("snapshot")]
    [ApiExplorerSettings(GroupName = "Snapshots")]
    public class SnapshotApiController : ManagementApiControllerBase
    {
        /// <summary>
        /// Defines the _configuration
        /// </summary>
        private readonly IConfiguration _configuration;

        /// <summary>
        /// Defines the _mediaService
        /// </summary>
        private readonly IMediaService _mediaService;

        /// <summary>
        /// Initializes a new instance of the <see cref="SnapshotApiController"/> class.
        /// </summary>
        /// <param name="configuration">The configuration<see cref="IConfiguration"/></param>
        /// <param name="mediaService">The mediaService<see cref="IMediaService"/></param>
        public SnapshotApiController(IConfiguration configuration, IMediaService mediaService)
        {
            _configuration = configuration;
            _mediaService = mediaService;
        }

        /// <summary>
        /// The GetVersions
        /// </summary>
        /// <param name="mediaKey">The mediaKey<see cref="Guid"/></param>
        /// <returns>The <see cref="Task{IActionResult}"/></returns>
        [HttpGet("versions/{mediaKey:guid}")]
        [ProducesResponseType(typeof(IEnumerable<SnapshotVersionModel>), 200)]
        public async Task<IActionResult> GetVersions(Guid mediaKey)
        {
            var media = _mediaService.GetById(mediaKey);
            if (media == null) return NotFound();

            var umbracoFileValue = media.GetValue<string>("umbracoFile");
            string? folderPath = ExtractFolderPath(umbracoFileValue);

            if (string.IsNullOrEmpty(folderPath)) return Ok(Enumerable.Empty<SnapshotVersionModel>());

            var connectionString = _configuration.GetValue<string>("Umbraco:Storage:AzureBlob:Media:ConnectionString");
            var serviceClient = new BlobServiceClient(connectionString);
            var snapshotContainer = serviceClient.GetBlobContainerClient("umbraco-snapshots");

            if (!await snapshotContainer.ExistsAsync()) return Ok(Enumerable.Empty<SnapshotVersionModel>());

            var versions = new List<SnapshotVersionModel>();
            var prefix = folderPath.EndsWith("/") ? folderPath : folderPath + "/";

            await foreach (var blobItem in snapshotContainer.GetBlobsAsync(prefix: prefix, traits: BlobTraits.Metadata))
            {
                var blobClient = snapshotContainer.GetBlobClient(blobItem.Name);

                // Generate a temporary SAS link (valid for 1 hour)
                var sasUrl = blobClient.GenerateSasUri(BlobSasPermissions.Read, DateTimeOffset.UtcNow.AddHours(1));

                versions.Add(new SnapshotVersionModel
                {
                    Name = Path.GetFileName(blobItem.Name),
                    Date = blobItem.Properties.LastModified?.DateTime ?? DateTime.MinValue,
                    Size = blobItem.Properties.ContentLength ?? 0,
                    Url = sasUrl.ToString(),
                    Uploader = blobItem.Metadata.ContainsKey("UploaderName") ? blobItem.Metadata["UploaderName"] : "Unknown"
                });
            }

            return Ok(versions.OrderByDescending(v => v.Date));
        }

        /// <summary>
        /// The ExtractFolderPath
        /// </summary>
        /// <param name="value">The value<see cref="string?"/></param>
        /// <returns>The <see cref="string?"/></returns>
        private string? ExtractFolderPath(string? value)
        {
            if (string.IsNullOrEmpty(value)) return null;
            if (value.Trim().StartsWith("{"))
            {
                var json = JsonSerializer.Deserialize<JsonElement>(value);
                value = json.TryGetProperty("src", out var src) ? src.GetString() ?? "" : "";
            }
            var parts = value.TrimStart('/').Split('/').ToList();
            if (parts.Count > 1 && parts[0].Equals("media", StringComparison.OrdinalIgnoreCase)) return parts[1];
            return parts.FirstOrDefault();
        }
    }

    /// <summary>
    /// Defines the <see cref="SnapshotVersionModel" />
    /// </summary>
    public class SnapshotVersionModel
    {
        /// <summary>
        /// Gets or sets the Name
        /// </summary>
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Gets or sets the Date
        /// </summary>
        public DateTime Date { get; set; }

        /// <summary>
        /// Gets or sets the Size
        /// </summary>
        public long Size { get; set; }

        /// <summary>
        /// Gets or sets the Url
        /// </summary>
        public string Url { get; set; } = string.Empty;

        /// <summary>
        /// Gets or sets the Uploader
        /// </summary>
        public string Uploader { get; set; } = string.Empty;
    }
}
