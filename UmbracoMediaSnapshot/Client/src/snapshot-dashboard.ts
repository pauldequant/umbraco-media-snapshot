import { LitElement, html, css, customElement, state } from '@umbraco-cms/backoffice/external/lit';
import { svg } from '@umbraco-cms/backoffice/external/lit';
import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import { UmbLocalizationController } from '@umbraco-cms/backoffice/localization-api';
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
    storageQuotaWarningGB: number;
    quotaExceeded: boolean;
    quotaUsagePercent: number | null;
}

interface TrendDataPoint {
    date: string;
    count: number;
    sizeBytes: number;
}

interface MediaTypeBreakdownItem {
    category: string;
    count: number;
    sizeBytes: number;
    sizeFormatted: string;
    percentage: number;
}

interface StorageStats {
    totalSnapshotCount: number;
    totalSizeBytes: number;
    totalSizeFormatted: string;
    mediaItemCount: number;
    topConsumers: FolderSummary[];
    settings: SettingsSummary;
    trendData: TrendDataPoint[];
    mediaTypeBreakdown: MediaTypeBreakdownItem[];
}

/**
 * Snapshot Storage Dashboard
 * Displays aggregated storage statistics for all media snapshots
 */
@customElement('snapshot-dashboard')
export class SnapshotDashboardElement extends UmbElementMixin(LitElement) {

    readonly #localize = new UmbLocalizationController(this);

    /** Shorthand for localize.term with the package prefix */
    #t(key: string): string {
        return this.#localize.term(`umbracoMediaSnapshot_${key}`);
    }

    @state()
    private _stats: StorageStats | null = null;

    @state()
    private _loading = true;

    @state()
    private _error = '';

    @state()
    private _trendPeriod: 7 | 30 | 90 = 30;

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
            this._error = this.#t('noAuthToken');
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
                this._error = this.#t('dashboardUnauthorized');
            } else {
                this._error = this.#t('dashboardLoadFailed');
            }
        } catch (error) {
            console.error('Failed to fetch storage stats:', error);
            this._error = this.#t('dashboardLoadError');
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

    private _renderFolderCell(folder: FolderSummary) {
        if (folder.mediaKey) {
            const href = `/umbraco/section/media/workspace/media/edit/${folder.mediaKey}`;
            const displayName = folder.mediaName || folder.folderName;
            return html`
                <a class="media-link" href="${href}" title="${this.#t('dashboardOpenInEditor').replace('{0}', displayName)}">
                    <uui-icon name="icon-picture"></uui-icon>
                    <span class="media-link-name">${displayName}</span>
                    <code class="folder-name-sub">${folder.folderName}</code>
                </a>
            `;
        }

        return html`
            <span class="folder-unresolved" title="${this.#t('dashboardOrphanedTitle')}">
                <code class="folder-name">${folder.folderName}</code>
                <uui-tag look="secondary" color="warning">${this.#t('dashboardOrphaned')}</uui-tag>
            </span>
        `;
    }

    // --- Trend chart helpers ---

    private _utcDateKey(daysAgo: number): string {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - daysAgo);
        return d.toISOString().slice(0, 10);
    }

    private _getTrendDataForPeriod(): TrendDataPoint[] {
        const raw = this._stats?.trendData ?? [];
        const result: TrendDataPoint[] = [];
        const dataMap = new Map(raw.map(d => [d.date, d]));

        for (let i = this._trendPeriod - 1; i >= 0; i--) {
            const key = this._utcDateKey(i);
            result.push(dataMap.get(key) ?? { date: key, count: 0, sizeBytes: 0 });
        }

        return result;
    }

    private _formatTrendLabel(dateStr: string): string {
        const [year, month, day] = dateStr.split('-').map(Number);
        const d = new Date(Date.UTC(year, month - 1, day));
        return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
    }

    private _renderTrendChart() {
        const data = this._getTrendDataForPeriod();
        const hasActivity = data.some(d => d.count > 0);

        if (!hasActivity) {
            return html`
                <div class="trend-empty">
                    <uui-icon name="icon-chart"></uui-icon>
                    <p>${this.#t('dashboardTrendNoData')}</p>
                </div>
            `;
        }

        const width = 700;
        const height = 220;
        const pad = { top: 24, right: 16, bottom: 44, left: 44 };
        const chartW = width - pad.left - pad.right;
        const chartH = height - pad.top - pad.bottom;

        const maxVal = Math.max(...data.map(d => d.count), 1);
        const barW = chartW / data.length;
        const gap = Math.max(1, barW * 0.25);

        const gridLines = [0.25, 0.5, 0.75, 1].map(frac => ({
            y: pad.top + chartH - frac * chartH,
            label: Math.round(frac * maxVal)
        }));

        const labelInterval = Math.max(1, Math.floor(data.length / 7));

        return html`
            <svg viewBox="0 0 ${width} ${height}" class="trend-svg" preserveAspectRatio="xMidYMid meet">
                ${svg`
                    <!-- Grid lines -->
                    ${gridLines.map(g => svg`
                        <line x1="${pad.left}" y1="${g.y}" x2="${width - pad.right}" y2="${g.y}" class="trend-grid" />
                        <text x="${pad.left - 8}" y="${g.y + 4}" class="trend-axis-label" text-anchor="end">${g.label}</text>
                    `)}
                    <!-- Baseline -->
                    <line x1="${pad.left}" y1="${pad.top + chartH}" x2="${width - pad.right}" y2="${pad.top + chartH}" class="trend-baseline" />

                    <!-- Bars -->
                    ${data.map((d, i) => {
                        const barH = maxVal > 0 ? (d.count / maxVal) * chartH : 0;
                        const x = pad.left + i * barW + gap / 2;
                        const y = pad.top + chartH - barH;
                        return svg`
                            <rect
                                x="${x}" y="${barH > 0 ? y : pad.top + chartH - 1}"
                                width="${barW - gap}"
                                height="${barH > 0 ? barH : 1}"
                                class="trend-bar ${d.count === 0 ? 'trend-bar-zero' : ''}"
                                rx="2">
                                <title>${d.count} ${this.#t('snapshots')} — ${this._formatTrendLabel(d.date)}</title>
                            </rect>
                        `;
                    })}

                    <!-- X-axis labels -->
                    ${data.map((d, i) => {
                        const isRegular = i % labelInterval === 0;
                        const isLast = i === data.length - 1;
                        // Skip the forced last label if it's too close to the previous regular one
                        if (!isRegular && !isLast) return svg``;
                        if (isLast && !isRegular && (data.length - 1) % labelInterval < labelInterval / 2) return svg``;
                        const x = pad.left + i * barW + barW / 2;
                        return svg`
                            <text x="${x}" y="${height - 8}" class="trend-axis-label" text-anchor="middle">
                                ${this._formatTrendLabel(d.date)}
                            </text>
                        `;
                    })}
                `}}
            </svg>
        `;
    }

    // --- Media type breakdown helpers ---

    /** Maps an API category name to a localised label */
    private _getCategoryLabel(category: string): string {
        const key = `dashboardMediaType${category}`;
        return this.#t(key);
    }

    /** Maps an API category to an Umbraco icon name */
    private _getCategoryIcon(category: string): string {
        switch (category) {
            case 'Image': return 'icon-picture';
            case 'Video': return 'icon-video';
            case 'Audio': return 'icon-sound-waves';
            case 'Document': return 'icon-document';
            default: return 'icon-folder';
        }
    }

    /** Maps an API category to a CSS color for the breakdown chart */
    private _getCategoryColor(category: string): string {
        switch (category) {
            case 'Image': return '#3544b1';
            case 'Video': return '#2bc37c';
            case 'Audio': return '#f0a30a';
            case 'Document': return '#8b5cf6';
            default: return '#6b7280';
        }
    }

    /** Renders the media type breakdown section */
    private _renderMediaTypeBreakdown() {
        const items = this._stats?.mediaTypeBreakdown ?? [];

        if (items.length === 0) {
            return html``;
        }

        return html`
            <uui-box>
                <div class="breakdown-section">
                    <h3>
                        <uui-icon name="icon-categories"></uui-icon>
                        ${this.#t('dashboardMediaTypeTitle')}
                    </h3>

                    <!-- Stacked bar -->
                    <div class="breakdown-bar">
                        ${items.map(item => html`
                            <div
                                class="breakdown-bar-segment"
                                style="width: ${Math.max(item.percentage, 0.5)}%; background: ${this._getCategoryColor(item.category)};"
                                title="${this._getCategoryLabel(item.category)}: ${item.sizeFormatted} (${item.percentage}%)">
                            </div>
                        `)}
                    </div>

                    <!-- Legend table -->
                    <div class="breakdown-legend">
                        ${items.map(item => html`
                            <div class="breakdown-row">
                                <div class="breakdown-row-label">
                                    <span class="breakdown-swatch" style="background: ${this._getCategoryColor(item.category)};"></span>
                                    <uui-icon name="${this._getCategoryIcon(item.category)}"></uui-icon>
                                    <span>${this._getCategoryLabel(item.category)}</span>
                                </div>
                                <div class="breakdown-row-stats">
                                    <span class="breakdown-count">${item.count.toLocaleString()}</span>
                                    <span class="breakdown-size">${item.sizeFormatted}</span>
                                    <span class="breakdown-pct">${item.percentage}%</span>
                                </div>
                            </div>
                        `)}
                    </div>
                </div>
            </uui-box>
        `;
    }

    // --- Quota warning ---

    /** Renders a warning or danger banner when storage quota is approaching or exceeded */
    private _renderQuotaWarning() {
        const settings = this._stats?.settings;
        if (!settings || settings.storageQuotaWarningGB <= 0 || settings.quotaUsagePercent === null) {
            return html``;
        }

        const pct = settings.quotaUsagePercent;
        const quotaGB = settings.storageQuotaWarningGB;
        const usedFormatted = this._stats!.totalSizeFormatted;

        if (pct < 80) {
            return html``;
        }

        const isDanger = pct >= 100;

        return html`
            <div class="quota-banner ${isDanger ? 'quota-danger' : 'quota-warning'}">
                <uui-icon name="${isDanger ? 'icon-alert' : 'icon-info'}"></uui-icon>
                <div class="quota-banner-content">
                    <strong>${isDanger ? this.#t('dashboardQuotaExceeded') : this.#t('dashboardQuotaWarning')}</strong>
                    <span>${this.#t('dashboardQuotaUsage').replace('{0}', usedFormatted).replace('{1}', `${quotaGB} GB`).replace('{2}', `${pct}`)}</span>
                </div>
                <div class="quota-bar-track">
                    <div class="quota-bar-fill ${isDanger ? 'quota-bar-danger' : 'quota-bar-warn'}"
                         style="width: ${Math.min(pct, 100)}%;">
                    </div>
                </div>
            </div>
        `;
    }

    render() {
        if (this._loading) {
            return html`
                <div class="dashboard-loading">
                    <uui-loader></uui-loader>
                    ${this.#t('dashboardLoading')}
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
                            <uui-icon name="icon-refresh"></uui-icon> ${this.#t('dashboardRetry')}
                        </uui-button>
                    </div>
                </uui-box>
            `;
        }

        const stats = this._stats!;
        const hours = stats.settings.sasTokenExpirationHours;

        return html`
            <div class="dashboard">
                <div class="dashboard-header">
                    <div>
                        <h2>
                            <uui-icon name="icon-history"></uui-icon>
                            ${this.#t('dashboardTitle')}
                        </h2>
                        <p class="dashboard-subtitle">${this.#t('dashboardSubtitle')}</p>
                    </div>
                    <uui-button look="secondary" compact @click="${this._fetchStats}">
                        <uui-icon name="icon-refresh"></uui-icon> ${this.#t('dashboardRefresh')}
                    </uui-button>
                </div>

                <!-- Quota Warning -->
                ${this._renderQuotaWarning()}

                <!-- Summary Cards -->
                <div class="stats-grid">
                    <uui-box>
                        <div class="stat-card">
                            <div class="stat-icon" style="color: var(--uui-color-primary);">
                                <uui-icon name="icon-documents"></uui-icon>
                            </div>
                            <div class="stat-content">
                                <span class="stat-value">${stats.totalSnapshotCount.toLocaleString()}</span>
                                <span class="stat-label">${this.#t('dashboardTotalSnapshots')}</span>
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
                                <span class="stat-label">${this.#t('dashboardTotalStorage')}</span>
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
                                <span class="stat-label">${this.#t('dashboardMediaItems')}</span>
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
                                <span class="stat-label">${this.#t('dashboardAvgSnapshots')}</span>
                            </div>
                        </div>
                    </uui-box>
                </div>

                <!-- Trend Chart -->
                <uui-box>
                    <div class="trend-section">
                        <div class="trend-header">
                            <h3>
                                <uui-icon name="icon-chart"></uui-icon>
                                ${this.#t('dashboardTrendTitle')}
                            </h3>
                            <div class="trend-period-selector">
                                <uui-button look="${this._trendPeriod === 7 ? 'primary' : 'secondary'}" compact
                                    @click="${() => this._trendPeriod = 7}">${this.#t('dashboardTrend7Days')}</uui-button>
                                <uui-button look="${this._trendPeriod === 30 ? 'primary' : 'secondary'}" compact
                                    @click="${() => this._trendPeriod = 30}">${this.#t('dashboardTrend30Days')}</uui-button>
                                <uui-button look="${this._trendPeriod === 90 ? 'primary' : 'secondary'}" compact
                                    @click="${() => this._trendPeriod = 90}">${this.#t('dashboardTrend90Days')}</uui-button>
                            </div>
                        </div>
                        ${this._renderTrendChart()}
                    </div>
                </uui-box>

                <!-- Media Type Breakdown -->
                ${this._renderMediaTypeBreakdown()}

                <!-- Top Consumers -->
                <uui-box headline="${this.#t('dashboardTopConsumers')}">
                    ${stats.topConsumers.length === 0
                        ? html`
                            <div class="empty-state">
                                <uui-icon name="icon-folder" style="font-size: 2rem; color: var(--uui-color-text-alt);"></uui-icon>
                                <p>${this.#t('dashboardNoSnapshots')}</p>
                            </div>
                        `
                        : html`
                            <uui-table>
                                <uui-table-head>
                                    <uui-table-head-cell style="width: 40px;">#</uui-table-head-cell>
                                    <uui-table-head-cell>${this.#t('dashboardMediaItem')}</uui-table-head-cell>
                                    <uui-table-head-cell>${this.#t('snapshots')}</uui-table-head-cell>
                                    <uui-table-head-cell>${this.#t('dashboardStorageUsed')}</uui-table-head-cell>
                                    <uui-table-head-cell>${this.#t('dashboardLatestSnapshot')}</uui-table-head-cell>
                                    <uui-table-head-cell>${this.#t('dashboardOldestSnapshot')}</uui-table-head-cell>
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
                <uui-box headline="${this.#t('dashboardActiveConfig')}">
                    <div class="settings-grid">
                        <div class="setting-item">
                            <span class="setting-label">${this.#t('dashboardMaxPerMedia')}</span>
                            <span class="setting-value">
                                ${stats.settings.maxSnapshotsPerMedia === 0
                                    ? html`<uui-tag look="secondary">${this.#t('dashboardUnlimited')}</uui-tag>`
                                    : stats.settings.maxSnapshotsPerMedia}
                            </span>
                        </div>
                        <div class="setting-item">
                            <span class="setting-label">${this.#t('dashboardMaxAge')}</span>
                            <span class="setting-value">
                                ${stats.settings.maxSnapshotAgeDays === 0
                                    ? html`<uui-tag look="secondary">${this.#t('dashboardNeverExpires')}</uui-tag>`
                                    : `${stats.settings.maxSnapshotAgeDays} ${this.#t('dashboardDays')}`}
                            </span>
                        </div>
                        <div class="setting-item">
                            <span class="setting-label">${this.#t('dashboardAutoCleanup')}</span>
                            <span class="setting-value">
                                ${stats.settings.enableAutomaticCleanup
                                    ? html`<uui-tag look="primary" color="positive">${this.#t('dashboardEnabled')}</uui-tag>`
                                    : html`<uui-tag look="primary" color="danger">${this.#t('dashboardDisabled')}</uui-tag>`}
                            </span>
                        </div>
                        <div class="setting-item">
                            <span class="setting-label">${this.#t('dashboardSasExpiration')}</span>
                            <span class="setting-value">${hours} ${hours !== 1 ? this.#t('dashboardHours') : this.#t('dashboardHour')}</span>
                        </div>
                        <div class="setting-item">
                            <span class="setting-label">${this.#t('dashboardTrackedTypes')}</span>
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

        .stat-icon { font-size: 2rem; flex-shrink: 0; }
        .stat-content { display: flex; flex-direction: column; }
        .stat-value { font-size: 1.6rem; font-weight: 700; line-height: 1.2; }
        .stat-label { font-size: 0.85rem; color: var(--uui-color-text-alt); margin-top: 2px; }

        /* Trend chart */
        .trend-section { display: flex; flex-direction: column; gap: var(--uui-size-space-4); }
        .trend-header { display: flex; justify-content: space-between; align-items: center; }
        .trend-header h3 { margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: var(--uui-size-space-2); }
        .trend-period-selector { display: flex; gap: 4px; }
        .trend-svg { width: 100%; height: auto; max-height: 240px; }
        .trend-bar { fill: var(--uui-color-primary); opacity: 0.85; transition: opacity 0.15s; }
        .trend-bar:hover { opacity: 1; cursor: pointer; }
        .trend-bar-zero { fill: var(--uui-color-border); opacity: 0.3; }
        .trend-grid { stroke: var(--uui-color-border); stroke-width: 1; stroke-dasharray: 4 3; }
        .trend-baseline { stroke: var(--uui-color-border); stroke-width: 1; }
        .trend-axis-label { fill: var(--uui-color-text-alt); font-size: 10px; font-family: inherit; }
        .trend-empty { display: flex; flex-direction: column; align-items: center; gap: var(--uui-size-space-3); padding: var(--uui-size-space-6); color: var(--uui-color-text-alt); }
        .trend-empty uui-icon { font-size: 2rem; opacity: 0.4; }

        /* Media type breakdown */
        .breakdown-section {
            display: flex;
            flex-direction: column;
            gap: var(--uui-size-space-4);
        }

        .breakdown-section h3 {
            margin: 0;
            font-size: 1.1rem;
            display: flex;
            align-items: center;
            gap: var(--uui-size-space-2);
        }

        .breakdown-bar {
            display: flex;
            height: 24px;
            border-radius: var(--uui-border-radius);
            overflow: hidden;
            gap: 2px;
        }

        .breakdown-bar-segment {
            min-width: 4px;
            transition: opacity 0.15s;
        }

        .breakdown-bar-segment:hover {
            opacity: 0.8;
        }

        .breakdown-legend {
            display: flex;
            flex-direction: column;
            gap: var(--uui-size-space-2);
        }

        .breakdown-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: var(--uui-size-space-2) var(--uui-size-space-3);
            border-radius: var(--uui-border-radius);
            transition: background 0.15s;
        }

        .breakdown-row:hover {
            background: var(--uui-color-surface-alt);
        }

        .breakdown-row-label {
            display: flex;
            align-items: center;
            gap: var(--uui-size-space-2);
            font-weight: 500;
        }

        .breakdown-swatch {
            width: 12px;
            height: 12px;
            border-radius: 3px;
            flex-shrink: 0;
        }

        .breakdown-row-stats {
            display: flex;
            align-items: center;
            gap: var(--uui-size-space-4);
            font-size: 0.85rem;
            color: var(--uui-color-text-alt);
        }

        .breakdown-count { min-width: 50px; text-align: right; }
        .breakdown-size { min-width: 70px; text-align: right; font-weight: 600; color: var(--uui-color-text); }
        .breakdown-pct { min-width: 45px; text-align: right; font-weight: 600; }

        /* Top consumers table */
        uui-table { border: 1px solid var(--uui-color-border); border-radius: var(--uui-border-radius); background: var(--uui-color-surface); }
        uui-table-head-cell { font-weight: bold; }
        .rank-badge { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: var(--uui-color-surface-alt); border: 1px solid var(--uui-color-border); font-size: 0.8rem; font-weight: 600; }
        .folder-name { font-family: monospace; font-size: 0.85rem; background: var(--uui-color-surface-alt); padding: 2px 6px; border-radius: 3px; }
        .media-link { display: flex; align-items: center; gap: var(--uui-size-space-2); color: var(--uui-color-interactive); text-decoration: none; transition: color 0.2s; }
        .media-link:hover { color: var(--uui-color-interactive-emphasis); text-decoration: underline; }
        .media-link uui-icon { color: var(--uui-color-primary); flex-shrink: 0; }
        .media-link-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .folder-name-sub { font-family: monospace; font-size: 0.75rem; color: var(--uui-color-text-alt); background: var(--uui-color-surface-alt); padding: 1px 4px; border-radius: 3px; flex-shrink: 0; }
        .folder-unresolved { display: flex; align-items: center; gap: var(--uui-size-space-2); }
        .empty-state { display: flex; flex-direction: column; align-items: center; gap: var(--uui-size-space-3); padding: var(--uui-size-space-6); color: var(--uui-color-text-alt); }

        /* Settings grid */
        .settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--uui-size-space-4); }
        .setting-item { display: flex; flex-direction: column; gap: var(--uui-size-space-1); padding: var(--uui-size-space-3); background: var(--uui-color-surface-alt); border-radius: var(--uui-border-radius); }
        .setting-label { font-size: 0.8rem; color: var(--uui-color-text-alt); text-transform: uppercase; letter-spacing: 0.5px; }
        .setting-value { font-size: 1.1rem; font-weight: 600; }
        .setting-value-tags { display: flex; flex-wrap: wrap; gap: 4px; font-size: 0.85rem; }

        /* Quota warning banner */
        .quota-banner {
            display: flex;
            align-items: center;
            gap: var(--uui-size-space-3);
            padding: var(--uui-size-space-3) var(--uui-size-space-4);
            border-radius: var(--uui-border-radius);
            font-size: 0.9rem;
        }

        .quota-warning {
            background: #fef3cd;
            border: 1px solid #f0a30a;
            color: #664d03;
        }

        .quota-danger {
            background: #f8d7da;
            border: 1px solid #dc3545;
            color: #842029;
        }

        .quota-banner uui-icon {
            font-size: 1.3rem;
            flex-shrink: 0;
        }

        .quota-banner-content {
            display: flex;
            flex-direction: column;
            gap: 2px;
            flex: 1;
        }

        .quota-bar-track {
            width: 120px;
            height: 8px;
            background: rgba(0, 0, 0, 0.1);
            border-radius: 4px;
            overflow: hidden;
            flex-shrink: 0;
        }

        .quota-bar-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 0.3s;
        }

        .quota-bar-warn {
            background: #f0a30a;
        }

        .quota-bar-danger {
            background: #dc3545;
        }

        @media (max-width: 768px) {
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
            .settings-grid { grid-template-columns: 1fr; }
            .dashboard-header { flex-direction: column; gap: var(--uui-size-space-3); }
            .trend-header { flex-direction: column; gap: var(--uui-size-space-3); align-items: flex-start; }
            .breakdown-row-stats { gap: var(--uui-size-space-2); }
        }
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        'snapshot-dashboard': SnapshotDashboardElement;
    }
}