import { LitElement as f, html as o, css as x, state as p, customElement as y } from "@umbraco-cms/backoffice/external/lit";
import { UmbElementMixin as $ } from "@umbraco-cms/backoffice/element-api";
import { UmbLocalizationController as _ } from "@umbraco-cms/backoffice/localization-api";
import { UMB_AUTH_CONTEXT as z } from "@umbraco-cms/backoffice/auth";
var k = Object.defineProperty, S = Object.getOwnPropertyDescriptor, v = (a) => {
  throw TypeError(a);
}, d = (a, i, l, n) => {
  for (var r = n > 1 ? void 0 : n ? S(i, l) : i, c = a.length - 1, h; c >= 0; c--)
    (h = a[c]) && (r = (n ? h(i, l, r) : h(r)) || r);
  return n && r && k(i, l, r), r;
}, g = (a, i, l) => i.has(a) || v("Cannot " + l), w = (a, i, l) => (g(a, i, "read from private field"), l ? l.call(a) : i.get(a)), b = (a, i, l) => i.has(a) ? v("Cannot add the same private member more than once") : i instanceof WeakSet ? i.add(a) : i.set(a, l), s = (a, i, l) => (g(a, i, "access private method"), l), m, t, e;
let u = class extends $(f) {
  constructor() {
    super(), b(this, t), b(this, m, new _(this)), this._stats = null, this._loading = !0, this._error = "", this.consumeContext(z, (a) => {
      this._authContext = a, this._fetchStats();
    });
  }
  async _fetchStats() {
    this._loading = !0, this._error = "";
    const a = await this._authContext?.getLatestToken();
    if (!a) {
      this._error = s(this, t, e).call(this, "noAuthToken"), this._loading = !1;
      return;
    }
    try {
      const i = await fetch("/umbraco/management/api/v1/snapshot/storage-stats", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${a}`,
          "Content-Type": "application/json"
        }
      });
      i.ok ? this._stats = await i.json() : i.status === 401 ? this._error = s(this, t, e).call(this, "dashboardUnauthorized") : this._error = s(this, t, e).call(this, "dashboardLoadFailed");
    } catch (i) {
      console.error("Failed to fetch storage stats:", i), this._error = s(this, t, e).call(this, "dashboardLoadError");
    } finally {
      this._loading = !1;
    }
  }
  _formatDate(a) {
    return a ? new Date(a).toLocaleDateString(void 0, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }) : "—";
  }
  /**
   * Renders the media folder cell — a clickable link if the media item
   * was resolved, or a plain code label if it was not (e.g. orphaned folder)
   */
  _renderFolderCell(a) {
    if (a.mediaKey) {
      const i = `/umbraco/section/media/workspace/media/edit/${a.mediaKey}`, l = a.mediaName || a.folderName;
      return o`
                <a class="media-link" href="${i}" title="${s(this, t, e).call(this, "dashboardOpenInEditor").replace("{0}", l)}">
                    <uui-icon name="icon-picture"></uui-icon>
                    <span class="media-link-name">${l}</span>
                    <code class="folder-name-sub">${a.folderName}</code>
                </a>
            `;
    }
    return o`
            <span class="folder-unresolved" title="${s(this, t, e).call(this, "dashboardOrphanedTitle")}">
                <code class="folder-name">${a.folderName}</code>
                <uui-tag look="secondary" color="warning">${s(this, t, e).call(this, "dashboardOrphaned")}</uui-tag>
            </span>
        `;
  }
  render() {
    if (this._loading)
      return o`
                <div class="dashboard-loading">
                    <uui-loader></uui-loader>
                    ${s(this, t, e).call(this, "dashboardLoading")}
                </div>
            `;
    if (this._error)
      return o`
                <uui-box>
                    <div class="dashboard-error">
                        <uui-icon name="icon-alert"></uui-icon>
                        <span>${this._error}</span>
                        <uui-button look="primary" compact @click="${this._fetchStats}">
                            <uui-icon name="icon-refresh"></uui-icon> ${s(this, t, e).call(this, "dashboardRetry")}
                        </uui-button>
                    </div>
                </uui-box>
            `;
    const a = this._stats, i = a.settings.sasTokenExpirationHours;
    return o`
            <div class="dashboard">
                <!-- Header -->
                <div class="dashboard-header">
                    <div>
                        <h2>
                            <uui-icon name="icon-history"></uui-icon>
                            ${s(this, t, e).call(this, "dashboardTitle")}
                        </h2>
                        <p class="dashboard-subtitle">${s(this, t, e).call(this, "dashboardSubtitle")}</p>
                    </div>
                    <uui-button look="secondary" compact @click="${this._fetchStats}">
                        <uui-icon name="icon-refresh"></uui-icon> ${s(this, t, e).call(this, "dashboardRefresh")}
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
                                <span class="stat-value">${a.totalSnapshotCount.toLocaleString()}</span>
                                <span class="stat-label">${s(this, t, e).call(this, "dashboardTotalSnapshots")}</span>
                            </div>
                        </div>
                    </uui-box>
                    <uui-box>
                        <div class="stat-card">
                            <div class="stat-icon" style="color: var(--uui-color-positive);">
                                <uui-icon name="icon-server"></uui-icon>
                            </div>
                            <div class="stat-content">
                                <span class="stat-value">${a.totalSizeFormatted}</span>
                                <span class="stat-label">${s(this, t, e).call(this, "dashboardTotalStorage")}</span>
                            </div>
                        </div>
                    </uui-box>
                    <uui-box>
                        <div class="stat-card">
                            <div class="stat-icon" style="color: var(--uui-color-warning);">
                                <uui-icon name="icon-pictures-alt-2"></uui-icon>
                            </div>
                            <div class="stat-content">
                                <span class="stat-value">${a.mediaItemCount.toLocaleString()}</span>
                                <span class="stat-label">${s(this, t, e).call(this, "dashboardMediaItems")}</span>
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
                                    ${a.totalSnapshotCount > 0 && a.mediaItemCount > 0 ? (a.totalSnapshotCount / a.mediaItemCount).toFixed(1) : "0"}
                                </span>
                                <span class="stat-label">${s(this, t, e).call(this, "dashboardAvgSnapshots")}</span>
                            </div>
                        </div>
                    </uui-box>
                </div>

                <!-- Top Consumers -->
                <uui-box headline="${s(this, t, e).call(this, "dashboardTopConsumers")}">
                    ${a.topConsumers.length === 0 ? o`
                            <div class="empty-state">
                                <uui-icon name="icon-folder" style="font-size: 2rem; color: var(--uui-color-text-alt);"></uui-icon>
                                <p>${s(this, t, e).call(this, "dashboardNoSnapshots")}</p>
                            </div>
                        ` : o`
                            <uui-table>
                                <uui-table-head>
                                    <uui-table-head-cell style="width: 40px;">#</uui-table-head-cell>
                                    <uui-table-head-cell>${s(this, t, e).call(this, "dashboardMediaItem")}</uui-table-head-cell>
                                    <uui-table-head-cell>${s(this, t, e).call(this, "snapshots")}</uui-table-head-cell>
                                    <uui-table-head-cell>${s(this, t, e).call(this, "dashboardStorageUsed")}</uui-table-head-cell>
                                    <uui-table-head-cell>${s(this, t, e).call(this, "dashboardLatestSnapshot")}</uui-table-head-cell>
                                    <uui-table-head-cell>${s(this, t, e).call(this, "dashboardOldestSnapshot")}</uui-table-head-cell>
                                </uui-table-head>
                                ${a.topConsumers.map((l, n) => o`
                                    <uui-table-row>
                                        <uui-table-cell>
                                            <span class="rank-badge">${n + 1}</span>
                                        </uui-table-cell>
                                        <uui-table-cell>${this._renderFolderCell(l)}</uui-table-cell>
                                        <uui-table-cell>${l.snapshotCount}</uui-table-cell>
                                        <uui-table-cell>${l.totalSizeFormatted}</uui-table-cell>
                                        <uui-table-cell>${this._formatDate(l.latestSnapshotDate)}</uui-table-cell>
                                        <uui-table-cell>${this._formatDate(l.oldestSnapshotDate)}</uui-table-cell>
                                    </uui-table-row>
                                `)}
                            </uui-table>
                        `}
                </uui-box>

                <!-- Current Settings -->
                <uui-box headline="${s(this, t, e).call(this, "dashboardActiveConfig")}">
                    <div class="settings-grid">
                        <div class="setting-item">
                            <span class="setting-label">${s(this, t, e).call(this, "dashboardMaxPerMedia")}</span>
                            <span class="setting-value">
                                ${a.settings.maxSnapshotsPerMedia === 0 ? o`<uui-tag look="secondary">${s(this, t, e).call(this, "dashboardUnlimited")}</uui-tag>` : a.settings.maxSnapshotsPerMedia}
                            </span>
                        </div>
                        <div class="setting-item">
                            <span class="setting-label">${s(this, t, e).call(this, "dashboardMaxAge")}</span>
                            <span class="setting-value">
                                ${a.settings.maxSnapshotAgeDays === 0 ? o`<uui-tag look="secondary">${s(this, t, e).call(this, "dashboardNeverExpires")}</uui-tag>` : `${a.settings.maxSnapshotAgeDays} ${s(this, t, e).call(this, "dashboardDays")}`}
                            </span>
                        </div>
                        <div class="setting-item">
                            <span class="setting-label">${s(this, t, e).call(this, "dashboardAutoCleanup")}</span>
                            <span class="setting-value">
                                ${a.settings.enableAutomaticCleanup ? o`<uui-tag look="primary" color="positive">${s(this, t, e).call(this, "dashboardEnabled")}</uui-tag>` : o`<uui-tag look="primary" color="danger">${s(this, t, e).call(this, "dashboardDisabled")}</uui-tag>`}
                            </span>
                        </div>
                        <div class="setting-item">
                            <span class="setting-label">${s(this, t, e).call(this, "dashboardSasExpiration")}</span>
                            <span class="setting-value">${i} ${i !== 1 ? s(this, t, e).call(this, "dashboardHours") : s(this, t, e).call(this, "dashboardHour")}</span>
                        </div>
                        <div class="setting-item">
                            <span class="setting-label">${s(this, t, e).call(this, "dashboardTrackedTypes")}</span>
                            <span class="setting-value setting-value-tags">
                                ${a.settings.trackedMediaTypes.map((l) => o`
                                    <uui-tag look="primary">${l}</uui-tag>
                                `)}
                            </span>
                        </div>
                    </div>
                </uui-box>
            </div>
        `;
  }
};
m = /* @__PURE__ */ new WeakMap();
t = /* @__PURE__ */ new WeakSet();
e = function(a) {
  return w(this, m).term(`umbracoMediaSnapshot_${a}`);
};
u.styles = x`
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
d([
  p()
], u.prototype, "_stats", 2);
d([
  p()
], u.prototype, "_loading", 2);
d([
  p()
], u.prototype, "_error", 2);
u = d([
  y("snapshot-dashboard")
], u);
export {
  u as SnapshotDashboardElement
};
//# sourceMappingURL=umbraco-media-snapshot2.js.map
