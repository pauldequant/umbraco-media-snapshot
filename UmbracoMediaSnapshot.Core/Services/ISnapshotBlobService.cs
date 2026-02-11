namespace UmbracoMediaSnapshot.Core.Services
{
    using Azure.Storage.Blobs;

    /// <summary>
    /// Centralises Azure Blob Storage helpers and shared constants used by the
    /// snapshot notification handlers, controller, and migration
    /// </summary>
    public interface ISnapshotBlobService
    {
        /// <summary>
        /// Gets the SnapshotContainerName
        /// The well-known container name for snapshot blobs.
        /// </summary>
        string SnapshotContainerName { get; }

        /// <summary>
        /// Returns the <see cref="BlobContainerClient"/> for the snapshot container
        /// </summary>
        /// <returns>The <see cref="BlobContainerClient"/></returns>
        BlobContainerClient GetSnapshotContainer();

        /// <summary>
        /// Returns the <see cref="BlobContainerClient"/> for the Umbraco media container
        /// </summary>
        /// <returns>The <see cref="BlobContainerClient"/></returns>
        BlobContainerClient GetMediaContainer();

        /// <summary>
        /// Returns the set of media type aliases that support snapshotting.
        /// </summary>
        IReadOnlyCollection<string> TargetMediaTypes { get; }

        /// <summary>
        /// Determines whether the given media type alias is supported for snapshotting
        /// </summary>
        /// <param name="alias">The alias<see cref="string"/></param>
        /// <returns>The <see cref="bool"/></returns>
        bool IsTargetMediaType(string alias);

        /// <summary>
        /// Extracts the raw blob path from an umbracoFile property value.
        /// Handles both plain string paths and JSON image-cropper values.
        /// Returns a path like "media/if3f2s40/file.csv" (no leading slash)
        /// </summary>
        /// <param name="value">The value<see cref="string?"/></param>
        /// <returns>The <see cref="string?"/></returns>
        string? GetRawBlobPath(string? value);

        /// <summary>
        /// Extracts only the folder segment from an umbracoFile value.
        /// e.g. "/media/if3f2s40/file.csv" → "if3f2s40"
        /// </summary>
        /// <param name="value">The value<see cref="string?"/></param>
        /// <returns>The <see cref="string?"/></returns>
        string? ExtractFolderPath(string? value);

        /// <summary>
        /// Extracts the full file path (with leading slash) from an umbracoFile value.
        /// e.g. JSON { "src": "/media/if3f2s40/file.csv" } → "/media/if3f2s40/file.csv"
        /// </summary>
        /// <param name="value">The value<see cref="string?"/></param>
        /// <returns>The <see cref="string?"/></returns>
        string? ExtractFilePath(string? value);

        /// <summary>
        /// Removes old snapshots beyond <see cref="Configuration.MediaSnapshotSettings.MaxSnapshotsPerMedia"/>
        /// </summary>
        /// <param name="folderPrefix">The folderPrefix<see cref="string"/></param>
        /// <param name="cancellationToken">The cancellationToken<see cref="CancellationToken"/></param>
        /// <returns>The <see cref="Task"/></returns>
        Task CleanupOldSnapshotsAsync(string folderPrefix, CancellationToken cancellationToken);
    }
}
