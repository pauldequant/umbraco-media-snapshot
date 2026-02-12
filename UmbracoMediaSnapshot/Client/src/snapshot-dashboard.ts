import { LitElement, html, css, customElement, state } from '@umbraco-cms/backoffice/external/lit';
import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import { UMB_AUTH_CONTEXT } from '@umbraco-cms/backoffice/auth';

interface FolderSummary {
    folderName: string;
    mediaKey: string | null;
    mediaName: string | null;
    snapshotCount: number;
    totalSizeBytes: number;
    totalSizeFormatted: string;
    latestSnapshotDate: string | null;
    oldestSnapshotDate: string | null;
}

interface SettingsSummary {
    maxSnapshotsPerMedia: number;
    maxSnapshotAgeDays: number;
    enableAutomaticCleanup: boolean;
    sasTokenExpirationHours: number;
    trackedMediaTypes: string[];
}

interface StorageStats {
    totalSnapshotCount: number;
    totalSizeBytes: number;
    totalSizeFormatted: string;
    mediaItemCount: number;
    topConsumers: FolderSummary[];
    settings: SettingsSummary;
}

/**
 * Snapshot Storage Dashboard
 * Displays aggregated storage statistics for all media snapshots
 */
@customElement('snapshot-dashboard')
export class SnapshotDashboardElement extends UmbElementMixin(LitElement) {

    @state()
    private _stats: StorageStats | null = null;

    @state()
    private _loading = true;

    @state()
    private _error = '';

    private _authContext?: typeof UMB_AUTH_CONTEXT.TYPE;

    constructor() {
        super();

        this.consumeContext(UMB_AUTH_CONTEXT, (instance) => {
            this._authContext = instance;
            this._fetchStats();
        });
    }

    private async _fetchStats() {
        this._loading = true;
        this._error = '';

        const token = await this._authContext?.getLatestToken();
        if (!token) {
            this._error = 'No authentication token available.';
            this._loading = false;
            return;
        }

        try {
            const response = await fetch('/umbraco/management/api/v1/snapshot/storage-stats', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this._stats = await response.json();
            } else if (response.status === 401) {
                this._error = 'Unauthorized. Your session may have expired.';
            } else {
                this._error = 'Failed to load storage statistics.';
            }
        } catch (error) {
            console.error('Failed to fetch storage stats:', error);
            this._error = 'An error occurred while loading storage statistics.';
        } finally {
            this._loading = false;
        }
    }

    private _formatDate(dateString: string | null): string {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Renders the media folder cell — a clickable link if the media item
     * was resolved, or a plain code label if it was not (e.g. orphaned folder)
     */
    private _renderFolderCell(folder: FolderSummary) {
        if (folder.mediaKey) {
            const href = `/umbraco/section/media/workspace/media/edit/${folder.mediaKey}`;
            return html`
                <a class="media-link" href="${href}" title="Open ${folder.mediaName || folder.folderName} in media editor">
                    <uui-icon name="icon-picture"></uui-icon>
                    <span class="media-link-name">${folder.mediaName || folder.folderName}</span>
                    <code class="folder-name-sub">${folder.folderName}</code>
                </a>
            `;
        }

        return html`
            <span class="folder-unresolved" title="Media item not found — folder may be orphaned">
                <code class="folder-name">${folder.folderName}</code>
                <uui-tag look="secondary" color="warning">Orphaned</uui-tag>
            </span>
        `;
    }

    render() {
        if (this._loading) {
            return html`
                <div class="dashboard-loading">
                    <uui-loader></uui-loader>
                    Loading snapshot storage statistics...
                </div>
            `;
        }

        if (this._error) {
            return html`
                <uui-box>
                    <div class="dashboard-error">
                        <uui-icon name="icon-alert"></uui-icon>
                        <span>${this._error}</span>
                        <uui-button look="primary" compact @click="${this._fetchStats}">
                            <uui-icon name="icon-refresh"></uui-icon> Retry
                        </uui-button>
                    </div>
                </uui-box>
            `;
        }

        const stats = this._stats!;

        return html`
            <div class="dashboard">
                <!-- Header -->
                <div class="dashboard-header">
                    <div>
                        <h2>
                            <uui-icon name="icon-history"></uui-icon>
                            Snapshot Storage
                        </h2>
                        <p class="dashboard-subtitle">Overview of media snapshot storage usage in Azure Blob Storage</p>
                    </div>
                    <uui-button look="secondary" compact @click="${this._fetchStats}">
                        <uui-icon name="icon-refresh"></uui-icon> Refresh
                    </uui-button>
                </div>

                <!-- Summary Cards -->
                <div class="stats-grid">
                    <uui-box>
                        <div class="stat-card">
                            <div class="stat-icon" style="color: var(--uui-color-primary);">
                                <uui-icon name="icon-documents"></uui-icon>
                            </div>
                            <div class="stat-content">
                                <span class="stat-value">${stats.totalSnapshotCount.toLocaleString()}</span>
                                <span class="stat-label">Total Snapshots</span>
                            </div>
                        </div>
                    </uui-box>
                    <uui-box>
                        <div class="stat-card">
                            <div class="stat-icon" style="color: var(--uui-color-positive);">
                                <uui-icon name="icon-server"></uui-icon>
                            </div>
                            <div class="stat-content">
                                <span class="stat-value">${stats.totalSizeFormatted}</span>
                                <span class="stat-label">Total Storage Used</span>
                            </div>
                        </div>
                    </uui-box>
                    <uui-box>
                        <div class="stat-card">
                            <div class="stat-icon" style="color: var(--uui-color-warning);">
                                <uui-icon name="icon-pictures-alt-2"></uui-icon>
                            </div>
                            <div class="stat-content">
                                <span class="stat-value">${stats.mediaItemCount.toLocaleString()}</span>
                                <span class="stat-label">Media Items with Snapshots</span>
                            </div>
                        </div>
                    </uui-box>
                    <uui-box>
                        <div class="stat-card">
                            <div class="stat-icon" style="color: var(--uui-color-text-alt);">
                                <uui-icon name="icon-chart"></uui-icon>
                            </div>
                            <div class="stat-content">
                                <span class="stat-value">
                                    ${stats.totalSnapshotCount > 0 && stats.mediaItemCount > 0
                                        ? (stats.totalSnapshotCount / stats.mediaItemCount).toFixed(1)
                                        : '0'}
                                </span>
                                <span class="stat-label">Avg Snapshots per Media</span>
                            </div>
                        </div>
                    </uui-box>
                </div>

                <!-- Top Consumers -->
                <uui-box headline="Top Storage Consumers">
                    ${stats.topConsumers.length === 0
                        ? html`
                            <div class="empty-state">
                                <uui-icon name="icon-folder" style="font-size: 2rem; color: var(--uui-color-text-alt);"></uui-icon>
                                <p>No snapshots found in storage.</p>
                            </div>
                        `
                        : html`
                            <uui-table>
                                <uui-table-head>
                                    <uui-table-head-cell style="width: 40px;">#</uui-table-head-cell>
                                    <uui-table-head-cell>Media Item</uui-table-head-cell>
                                    <uui-table-head-cell>Snapshots</uui-table-head-cell>
                                    <uui-table-head-cell>Storage Used</uui-table-head-cell>
                                    <uui-table-head-cell>Latest Snapshot</uui-table-head-cell>
                                    <uui-table-head-cell>Oldest Snapshot</uui-table-head-cell>
                                </uui-table-head>
                                ${stats.topConsumers.map((folder, index) => html`
                                    <uui-table-row>
                                        <uui-table-cell>
                                            <span class="rank-badge">${index + 1}</span>
                                        </uui-table-cell>
                                        <uui-table-cell>${this._renderFolderCell(folder)}</uui-table-cell>
                                        <uui-table-cell>${folder.snapshotCount}</uui-table-cell>
                                        <uui-table-cell>${folder.totalSizeFormatted}</uui-table-cell>
                                        <uui-table-cell>${this._formatDate(folder.latestSnapshotDate)}</uui-table-cell>
                                        <uui-table-cell>${this._formatDate(folder.oldestSnapshotDate)}</uui-table-cell>
                                    </uui-table-row>
                                `)}
                            </uui-table>
                        `
                    }
                </uui-box>

                <!-- Current Settings -->
                <uui-box headline="Active Configuration">
                    <div class="settings-grid">
                        <div class="setting-item">
                            <span class="setting-label">Max Snapshots per Media</span>
                            <span class="setting-value">
                                ${stats.settings.maxSnapshotsPerMedia === 0
                                    ? html`<uui-tag look="secondary">Unlimited</uui-tag>`
                                    : stats.settings.maxSnapshotsPerMedia}
                            </span>
                        </div>
                        <div class="setting-item">
                            <span class="setting-label">Max Snapshot Age</span>
                            <span class="setting-value">
                                ${stats.settings.maxSnapshotAgeDays === 0
                                    ? html`<uui-tag look="secondary">Never expires</uui-tag>`
                                    : `${stats.settings.maxSnapshotAgeDays} days`}
                            </span>
                        </div>
                        <div class="setting-item">
                            <span class="setting-label">Automatic Cleanup</span>
                            <span class="setting-value">
                                ${stats.settings.enableAutomaticCleanup
                                    ? html`<uui-tag look="primary" color="positive">Enabled</uui-tag>`
                                    : html`<uui-tag look="primary" color="danger">Disabled</uui-tag>`}
                            </span>
                        </div>
                        <div class="setting-item">
                            <span class="setting-label">SAS Token Expiration</span>
                            <span class="setting-value">${stats.settings.sasTokenExpirationHours} hour${stats.settings.sasTokenExpirationHours !== 1 ? 's' : ''}</span>
                        </div>
                        <div class="setting-item">
                            <span class="setting-label">Tracked Media Types</span>
                            <span class="setting-value setting-value-tags">
                                ${stats.settings.trackedMediaTypes.map(t => html`
                                    <uui-tag look="primary">${t}</uui-tag>
                                `)}
                            </span>
                        </div>
                    </div>
                </uui-box>
            </div>
        `;
    }

    static styles = css`
        :host {
            display: block;
            padding: var(--uui-size-space-5);
        }

        .dashboard {
            display: flex;
            flex-direction: column;
            gap: var(--uui-size-space-5);
            max-width: 1200px;
        }

        .dashboard-loading {
            display: flex;
            align-items: center;
            gap: var(--uui-size-space-3);
            padding: var(--uui-size-space-6);
            color: var(--uui-color-text-alt);
            font-size: 1rem;
        }

        .dashboard-error {
            display: flex;
            align-items: center;
            gap: var(--uui-size-space-3);
            color: var(--uui-color-danger);
        }

        .dashboard-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }

        .dashboard-header h2 {
            margin: 0;
            display: flex;
            align-items: center;
            gap: var(--uui-size-space-2);
            font-size: 1.5rem;
        }

        .dashboard-subtitle {
            margin: var(--uui-size-space-2) 0 0 0;
            color: var(--uui-color-text-alt);
        }

        /* Summary cards */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: var(--uui-size-space-4);
        }

        .stat-card {
            display: flex;
            align-items: center;
            gap: var(--uui-size-space-4);
            padding: var(--uui-size-space-2);
        }

        .stat-icon {
            font-size: 2rem;
            flex-shrink: 0;
        }

        .stat-content {
            display: flex;
            flex-direction: column;
        }

        .stat-value {
            font-size: 1.6rem;
            font-weight: 700;
            line-height: 1.2;
        }

        .stat-label {
            font-size: 0.85rem;
            color: var(--uui-color-text-alt);
            margin-top: 2px;
        }

        /* Top consumers table */
        uui-table {
            border: 1px solid var(--uui-color-border);
            border-radius: var(--uui-border-radius);
            background: var(--uui-color-surface);
        }

        uui-table-head-cell {
            font-weight: bold;
        }

        .rank-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: var(--uui-color-surface-alt);
            border: 1px solid var(--uui-color-border);
            font-size: 0.8rem;
            font-weight: 600;
        }

        .folder-name {
            font-family: monospace;
            font-size: 0.85rem;
            background: var(--uui-color-surface-alt);
            padding: 2px 6px;
            border-radius: 3px;
        }

        /* Media item link */
        .media-link {
            display: flex;
            align-items: center;
            gap: var(--uui-size-space-2);
            color: var(--uui-color-interactive);
            text-decoration: none;
            transition: color 0.2s;
        }

        .media-link:hover {
            color: var(--uui-color-interactive-emphasis);
            text-decoration: underline;
        }

        .media-link uui-icon {
            color: var(--uui-color-primary);
            flex-shrink: 0;
        }

        .media-link-name {
            font-weight: 600;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .folder-name-sub {
            font-family: monospace;
            font-size: 0.75rem;
            color: var(--uui-color-text-alt);
            background: var(--uui-color-surface-alt);
            padding: 1px 4px;
            border-radius: 3px;
            flex-shrink: 0;
        }

        /* Orphaned folder */
        .folder-unresolved {
            display: flex;
            align-items: center;
            gap: var(--uui-size-space-2);
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: var(--uui-size-space-3);
            padding: var(--uui-size-space-6);
            color: var(--uui-color-text-alt);
        }

        /* Settings grid */
        .settings-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: var(--uui-size-space-4);
        }

        .setting-item {
            display: flex;
            flex-direction: column;
            gap: var(--uui-size-space-1);
            padding: var(--uui-size-space-3);
            background: var(--uui-color-surface-alt);
            border-radius: var(--uui-border-radius);
        }

        .setting-label {
            font-size: 0.8rem;
            color: var(--uui-color-text-alt);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .setting-value {
            font-size: 1.1rem;
            font-weight: 600;
        }

        .setting-value-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            font-size: 0.85rem;
        }

        @media (max-width: 768px) {
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            .settings-grid {
                grid-template-columns: 1fr;
            }
            .dashboard-header {
                flex-direction: column;
                gap: var(--uui-size-space-3);
            }
        }
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        'snapshot-dashboard': SnapshotDashboardElement;
    }
}