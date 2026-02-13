import { LitElement as D, html as n, svg as p, css as M, state as x, customElement as L } from "@umbraco-cms/backoffice/external/lit";
import { UmbElementMixin as q } from "@umbraco-cms/backoffice/element-api";
import { UmbLocalizationController as P } from "@umbraco-cms/backoffice/localization-api";
import { UMB_AUTH_CONTEXT as A } from "@umbraco-cms/backoffice/auth";
var E = Object.defineProperty, B = Object.getOwnPropertyDescriptor, C = (a) => {
  throw TypeError(a);
}, v = (a, t, r, l) => {
  for (var o = l > 1 ? void 0 : l ? B(t, r) : t, g = a.length - 1, c; g >= 0; g--)
    (c = a[g]) && (o = (l ? c(t, r, o) : c(o)) || o);
  return l && o && E(t, r, o), o;
}, T = (a, t, r) => t.has(a) || C("Cannot " + r), U = (a, t, r) => (T(a, t, "read from private field"), r ? r.call(a) : t.get(a)), z = (a, t, r) => t.has(a) ? C("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(a) : t.set(a, r), s = (a, t, r) => (T(a, t, "access private method"), r), k, e, i;
let h = class extends q(D) {
  constructor() {
    super(), z(this, e), z(this, k, new P(this)), this._stats = null, this._loading = !0, this._error = "", this._trendPeriod = 30, this.consumeContext(A, (a) => {
      this._authContext = a, this._fetchStats();
    });
  }
  async _fetchStats() {
    this._loading = !0, this._error = "";
    const a = await this._authContext?.getLatestToken();
    if (!a) {
      this._error = s(this, e, i).call(this, "noAuthToken"), this._loading = !1;
      return;
    }
    try {
      const t = await fetch("/umbraco/management/api/v1/snapshot/storage-stats", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${a}`,
          "Content-Type": "application/json"
        }
      });
      t.ok ? this._stats = await t.json() : t.status === 401 ? this._error = s(this, e, i).call(this, "dashboardUnauthorized") : this._error = s(this, e, i).call(this, "dashboardLoadFailed");
    } catch (t) {
      console.error("Failed to fetch storage stats:", t), this._error = s(this, e, i).call(this, "dashboardLoadError");
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
  _renderFolderCell(a) {
    if (a.mediaKey) {
      const t = `/umbraco/section/media/workspace/media/edit/${a.mediaKey}`, r = a.mediaName || a.folderName;
      return n`
                <a class="media-link" href="${t}" title="${s(this, e, i).call(this, "dashboardOpenInEditor").replace("{0}", r)}">
                    <uui-icon name="icon-picture"></uui-icon>
                    <span class="media-link-name">${r}</span>
                    <code class="folder-name-sub">${a.folderName}</code>
                </a>
            `;
    }
    return n`
            <span class="folder-unresolved" title="${s(this, e, i).call(this, "dashboardOrphanedTitle")}">
                <code class="folder-name">${a.folderName}</code>
                <uui-tag look="secondary" color="warning">${s(this, e, i).call(this, "dashboardOrphaned")}</uui-tag>
            </span>
        `;
  }
  // --- Trend chart helpers ---
  _utcDateKey(a) {
    const t = /* @__PURE__ */ new Date();
    return t.setUTCDate(t.getUTCDate() - a), t.toISOString().slice(0, 10);
  }
  _getTrendDataForPeriod() {
    const a = this._stats?.trendData ?? [], t = [], r = new Map(a.map((l) => [l.date, l]));
    for (let l = this._trendPeriod - 1; l >= 0; l--) {
      const o = this._utcDateKey(l);
      t.push(r.get(o) ?? { date: o, count: 0, sizeBytes: 0 });
    }
    return t;
  }
  _formatTrendLabel(a) {
    const [t, r, l] = a.split("-").map(Number);
    return new Date(Date.UTC(t, r - 1, l)).toLocaleDateString(void 0, { day: "numeric", month: "short", timeZone: "UTC" });
  }
  _renderTrendChart() {
    const a = this._getTrendDataForPeriod();
    if (!a.some((d) => d.count > 0))
      return n`
                <div class="trend-empty">
                    <uui-icon name="icon-chart"></uui-icon>
                    <p>${s(this, e, i).call(this, "dashboardTrendNoData")}</p>
                </div>
            `;
    const r = 700, l = 220, o = { top: 24, right: 16, bottom: 44, left: 44 }, g = r - o.left - o.right, c = l - o.top - o.bottom, y = Math.max(...a.map((d) => d.count), 1), b = g / a.length, _ = Math.max(1, b * 0.25), S = [0.25, 0.5, 0.75, 1].map((d) => ({
      y: o.top + c - d * c,
      label: Math.round(d * y)
    })), $ = Math.max(1, Math.floor(a.length / 7));
    return n`
            <svg viewBox="0 0 ${r} ${l}" class="trend-svg" preserveAspectRatio="xMidYMid meet">
                ${p`
                    <!-- Grid lines -->
                    ${S.map((d) => p`
                        <line x1="${o.left}" y1="${d.y}" x2="${r - o.right}" y2="${d.y}" class="trend-grid" />
                        <text x="${o.left - 8}" y="${d.y + 4}" class="trend-axis-label" text-anchor="end">${d.label}</text>
                    `)}
                    <!-- Baseline -->
                    <line x1="${o.left}" y1="${o.top + c}" x2="${r - o.right}" y2="${o.top + c}" class="trend-baseline" />

                    <!-- Bars -->
                    ${a.map((d, m) => {
      const u = y > 0 ? d.count / y * c : 0, f = o.left + m * b + _ / 2, w = o.top + c - u;
      return p`
                            <rect
                                x="${f}" y="${u > 0 ? w : o.top + c - 1}"
                                width="${b - _}"
                                height="${u > 0 ? u : 1}"
                                class="trend-bar ${d.count === 0 ? "trend-bar-zero" : ""}"
                                rx="2">
                                <title>${d.count} ${s(this, e, i).call(this, "snapshots")} — ${this._formatTrendLabel(d.date)}</title>
                            </rect>
                        `;
    })}

                    <!-- X-axis labels -->
                    ${a.map((d, m) => {
      const u = m % $ === 0, f = m === a.length - 1;
      if (!u && !f) return p``;
      if (f && !u && (a.length - 1) % $ < $ / 2) return p``;
      const w = o.left + m * b + b / 2;
      return p`
                            <text x="${w}" y="${l - 8}" class="trend-axis-label" text-anchor="middle">
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
  _getCategoryLabel(a) {
    const t = `dashboardMediaType${a}`;
    return s(this, e, i).call(this, t);
  }
  /** Maps an API category to an Umbraco icon name */
  _getCategoryIcon(a) {
    switch (a) {
      case "Image":
        return "icon-picture";
      case "Video":
        return "icon-video";
      case "Audio":
        return "icon-sound-waves";
      case "Document":
        return "icon-document";
      default:
        return "icon-folder";
    }
  }
  /** Maps an API category to a CSS color for the breakdown chart */
  _getCategoryColor(a) {
    switch (a) {
      case "Image":
        return "#3544b1";
      case "Video":
        return "#2bc37c";
      case "Audio":
        return "#f0a30a";
      case "Document":
        return "#8b5cf6";
      default:
        return "#6b7280";
    }
  }
  /** Renders the media type breakdown section */
  _renderMediaTypeBreakdown() {
    const a = this._stats?.mediaTypeBreakdown ?? [];
    return a.length === 0 ? n`` : n`
            <uui-box>
                <div class="breakdown-section">
                    <h3>
                        <uui-icon name="icon-categories"></uui-icon>
                        ${s(this, e, i).call(this, "dashboardMediaTypeTitle")}
                    </h3>

                    <!-- Stacked bar -->
                    <div class="breakdown-bar">
                        ${a.map((t) => n`
                            <div
                                class="breakdown-bar-segment"
                                style="width: ${Math.max(t.percentage, 0.5)}%; background: ${this._getCategoryColor(t.category)};"
                                title="${this._getCategoryLabel(t.category)}: ${t.sizeFormatted} (${t.percentage}%)">
                            </div>
                        `)}
                    </div>

                    <!-- Legend table -->
                    <div class="breakdown-legend">
                        ${a.map((t) => n`
                            <div class="breakdown-row">
                                <div class="breakdown-row-label">
                                    <span class="breakdown-swatch" style="background: ${this._getCategoryColor(t.category)};"></span>
                                    <uui-icon name="${this._getCategoryIcon(t.category)}"></uui-icon>
                                    <span>${this._getCategoryLabel(t.category)}</span>
                                </div>
                                <div class="breakdown-row-stats">
                                    <span class="breakdown-count">${t.count.toLocaleString()}</span>
                                    <span class="breakdown-size">${t.sizeFormatted}</span>
                                    <span class="breakdown-pct">${t.percentage}%</span>
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
  _renderQuotaWarning() {
    const a = this._stats?.settings;
    if (!a || a.storageQuotaWarningGB <= 0 || a.quotaUsagePercent === null)
      return n``;
    const t = a.quotaUsagePercent, r = a.storageQuotaWarningGB, l = this._stats.totalSizeFormatted;
    if (t < 80)
      return n``;
    const o = t >= 100;
    return n`
            <div class="quota-banner ${o ? "quota-danger" : "quota-warning"}">
                <uui-icon name="${o ? "icon-alert" : "icon-info"}"></uui-icon>
                <div class="quota-banner-content">
                    <strong>${o ? s(this, e, i).call(this, "dashboardQuotaExceeded") : s(this, e, i).call(this, "dashboardQuotaWarning")}</strong>
                    <span>${s(this, e, i).call(this, "dashboardQuotaUsage").replace("{0}", l).replace("{1}", `${r} GB`).replace("{2}", `${t}`)}</span>
                </div>
                <div class="quota-bar-track">
                    <div class="quota-bar-fill ${o ? "quota-bar-danger" : "quota-bar-warn"}"
                         style="width: ${Math.min(t, 100)}%;">
                    </div>
                </div>
            </div>
        `;
  }
  render() {
    if (this._loading)
      return n`
                <div class="dashboard-loading">
                    <uui-loader></uui-loader>
                    ${s(this, e, i).call(this, "dashboardLoading")}
                </div>
            `;
    if (this._error)
      return n`
                <uui-box>
                    <div class="dashboard-error">
                        <uui-icon name="icon-alert"></uui-icon>
                        <span>${this._error}</span>
                        <uui-button look="primary" compact @click="${this._fetchStats}">
                            <uui-icon name="icon-refresh"></uui-icon> ${s(this, e, i).call(this, "dashboardRetry")}
                        </uui-button>
                    </div>
                </uui-box>
            `;
    const a = this._stats, t = a.settings.sasTokenExpirationHours;
    return n`
            <div class="dashboard">
                <div class="dashboard-header">
                    <div>
                        <h2>
                            <uui-icon name="icon-history"></uui-icon>
                            ${s(this, e, i).call(this, "dashboardTitle")}
                        </h2>
                        <p class="dashboard-subtitle">${s(this, e, i).call(this, "dashboardSubtitle")}</p>
                    </div>
                    <uui-button look="secondary" compact @click="${this._fetchStats}">
                        <uui-icon name="icon-refresh"></uui-icon> ${s(this, e, i).call(this, "dashboardRefresh")}
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
                                <span class="stat-value">${a.totalSnapshotCount.toLocaleString()}</span>
                                <span class="stat-label">${s(this, e, i).call(this, "dashboardTotalSnapshots")}</span>
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
                                <span class="stat-label">${s(this, e, i).call(this, "dashboardTotalStorage")}</span>
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
                                <span class="stat-label">${s(this, e, i).call(this, "dashboardMediaItems")}</span>
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
                                <span class="stat-label">${s(this, e, i).call(this, "dashboardAvgSnapshots")}</span>
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
                                ${s(this, e, i).call(this, "dashboardTrendTitle")}
                            </h3>
                            <div class="trend-period-selector">
                                <uui-button look="${this._trendPeriod === 7 ? "primary" : "secondary"}" compact
                                    @click="${() => this._trendPeriod = 7}">${s(this, e, i).call(this, "dashboardTrend7Days")}</uui-button>
                                <uui-button look="${this._trendPeriod === 30 ? "primary" : "secondary"}" compact
                                    @click="${() => this._trendPeriod = 30}">${s(this, e, i).call(this, "dashboardTrend30Days")}</uui-button>
                                <uui-button look="${this._trendPeriod === 90 ? "primary" : "secondary"}" compact
                                    @click="${() => this._trendPeriod = 90}">${s(this, e, i).call(this, "dashboardTrend90Days")}</uui-button>
                            </div>
                        </div>
                        ${this._renderTrendChart()}
                    </div>
                </uui-box>

                <!-- Media Type Breakdown -->
                ${this._renderMediaTypeBreakdown()}

                <!-- Top Consumers -->
                <uui-box headline="${s(this, e, i).call(this, "dashboardTopConsumers")}">
                    ${a.topConsumers.length === 0 ? n`
                            <div class="empty-state">
                                <uui-icon name="icon-folder" style="font-size: 2rem; color: var(--uui-color-text-alt);"></uui-icon>
                                <p>${s(this, e, i).call(this, "dashboardNoSnapshots")}</p>
                            </div>
                        ` : n`
                            <uui-table>
                                <uui-table-head>
                                    <uui-table-head-cell style="width: 40px;">#</uui-table-head-cell>
                                    <uui-table-head-cell>${s(this, e, i).call(this, "dashboardMediaItem")}</uui-table-head-cell>
                                    <uui-table-head-cell>${s(this, e, i).call(this, "snapshots")}</uui-table-head-cell>
                                    <uui-table-head-cell>${s(this, e, i).call(this, "dashboardStorageUsed")}</uui-table-head-cell>
                                    <uui-table-head-cell>${s(this, e, i).call(this, "dashboardLatestSnapshot")}</uui-table-head-cell>
                                    <uui-table-head-cell>${s(this, e, i).call(this, "dashboardOldestSnapshot")}</uui-table-head-cell>
                                </uui-table-head>
                                ${a.topConsumers.map((r, l) => n`
                                    <uui-table-row>
                                        <uui-table-cell>
                                            <span class="rank-badge">${l + 1}</span>
                                        </uui-table-cell>
                                        <uui-table-cell>${this._renderFolderCell(r)}</uui-table-cell>
                                        <uui-table-cell>${r.snapshotCount}</uui-table-cell>
                                        <uui-table-cell>${r.totalSizeFormatted}</uui-table-cell>
                                        <uui-table-cell>${this._formatDate(r.latestSnapshotDate)}</uui-table-cell>
                                        <uui-table-cell>${this._formatDate(r.oldestSnapshotDate)}</uui-table-cell>
                                    </uui-table-row>
                                `)}
                            </uui-table>
                        `}
                </uui-box>

                <!-- Current Settings -->
                <uui-box headline="${s(this, e, i).call(this, "dashboardActiveConfig")}">
                    <div class="settings-grid">
                        <div class="setting-item">
                            <span class="setting-label">${s(this, e, i).call(this, "dashboardMaxPerMedia")}</span>
                            <span class="setting-value">
                                ${a.settings.maxSnapshotsPerMedia === 0 ? n`<uui-tag look="secondary">${s(this, e, i).call(this, "dashboardUnlimited")}</uui-tag>` : a.settings.maxSnapshotsPerMedia}
                            </span>
                        </div>
                        <div class="setting-item">
                            <span class="setting-label">${s(this, e, i).call(this, "dashboardMaxAge")}</span>
                            <span class="setting-value">
                                ${a.settings.maxSnapshotAgeDays === 0 ? n`<uui-tag look="secondary">${s(this, e, i).call(this, "dashboardNeverExpires")}</uui-tag>` : `${a.settings.maxSnapshotAgeDays} ${s(this, e, i).call(this, "dashboardDays")}`}
                            </span>
                        </div>
                        <div class="setting-item">
                            <span class="setting-label">${s(this, e, i).call(this, "dashboardAutoCleanup")}</span>
                            <span class="setting-value">
                                ${a.settings.enableAutomaticCleanup ? n`<uui-tag look="primary" color="positive">${s(this, e, i).call(this, "dashboardEnabled")}</uui-tag>` : n`<uui-tag look="primary" color="danger">${s(this, e, i).call(this, "dashboardDisabled")}</uui-tag>`}
                            </span>
                        </div>
                        <div class="setting-item">
                            <span class="setting-label">${s(this, e, i).call(this, "dashboardSasExpiration")}</span>
                            <span class="setting-value">${t} ${t !== 1 ? s(this, e, i).call(this, "dashboardHours") : s(this, e, i).call(this, "dashboardHour")}</span>
                        </div>
                        <div class="setting-item">
                            <span class="setting-label">${s(this, e, i).call(this, "dashboardTrackedTypes")}</span>
                            <span class="setting-value setting-value-tags">
                                ${a.settings.trackedMediaTypes.map((r) => n`
                                    <uui-tag look="primary">${r}</uui-tag>
                                `)}
                            </span>
                        </div>
                    </div>
                </uui-box>
            </div>
        `;
  }
};
k = /* @__PURE__ */ new WeakMap();
e = /* @__PURE__ */ new WeakSet();
i = function(a) {
  return U(this, k).term(`umbracoMediaSnapshot_${a}`);
};
h.styles = M`
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
v([
  x()
], h.prototype, "_stats", 2);
v([
  x()
], h.prototype, "_loading", 2);
v([
  x()
], h.prototype, "_error", 2);
v([
  x()
], h.prototype, "_trendPeriod", 2);
h = v([
  L("snapshot-dashboard")
], h);
export {
  h as SnapshotDashboardElement
};
//# sourceMappingURL=umbraco-media-snapshot2.js.map
