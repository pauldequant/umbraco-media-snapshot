namespace UmbracoMediaSnapshot.Core.Services
{
    using System.Threading;
    using System.Threading.Tasks;
    using UmbracoMediaSnapshot.Core.Models;

    /// <summary>
    /// Provides cached access to snapshot storage statistics to avoid
    /// full container enumeration on every dashboard load
    /// </summary>
    public interface ISnapshotStatsCache
    {
        /// <summary>
        /// Returns cached storage stats, or computes them if the cache is stale
        /// </summary>
        /// <param name="cancellationToken">The cancellationToken<see cref="CancellationToken"/></param>
        /// <returns>The <see cref="Task{SnapshotStorageStats}"/></returns>
        Task<SnapshotStorageStats> GetOrComputeAsync(CancellationToken cancellationToken);

        /// <summary>
        /// Invalidates the cached stats so they are recomputed on next access
        /// </summary>
        void Invalidate();
    }
}
