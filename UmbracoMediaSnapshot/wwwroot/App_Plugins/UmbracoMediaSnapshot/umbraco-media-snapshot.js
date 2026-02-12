import { LitElement as d, html as o, css as p, state as l, customElement as h } from "@umbraco-cms/backoffice/external/lit";
import { UmbElementMixin as m } from "@umbraco-cms/backoffice/element-api";
import { UMB_WORKSPACE_CONTEXT as g } from "@umbraco-cms/backoffice/workspace";
import { UMB_AUTH_CONTEXT as v } from "@umbraco-cms/backoffice/auth";
import { UMB_NOTIFICATION_CONTEXT as b } from "@umbraco-cms/backoffice/notification";
import { UMB_MODAL_MANAGER_CONTEXT as f, UMB_CONFIRM_MODAL as _ } from "@umbraco-cms/backoffice/modal";
var w = Object.defineProperty, y = Object.getOwnPropertyDescriptor, n = (e, i, a, t) => {
  for (var r = t > 1 ? void 0 : t ? y(i, a) : i, u = e.length - 1, c; u >= 0; u--)
    (c = e[u]) && (r = (t ? c(i, a, r) : c(r)) || r);
  return t && r && w(i, a, r), r;
};
let s = class extends m(d) {
  constructor() {
    super(), this._versions = [], this._loading = !0, this._mediaKey = "", this._previewImageUrl = null, this._previewImageName = "", this._showPreview = !1, this._isRestoring = !1, this._currentPage = 1, this._showComparison = !1, this._comparisonSnapshot = null, this._comparisonCurrent = null, this._comparisonLoading = !1, this._comparisonMode = "side-by-side", this._sliderPosition = 50, this._pageSize = 10, this.consumeContext(v, (e) => {
      this._authContext = e;
    }), this.consumeContext(b, (e) => {
      this._notificationContext = e;
    }), this.consumeContext(f, (e) => {
      this._modalManagerContext = e;
    }), this.consumeContext(g, (e) => {
      const i = e;
      i.unique && this.observe(i.unique, (a) => {
        a && a !== this._mediaKey && (this._mediaKey = a.toString(), this._currentPage = 1, this._fetchVersions(this._mediaKey));
      });
    });
  }
  /**
   * Calls the C# Management API to get the list of blobs
   * Umbraco 17 automatically injects Auth Bearer tokens into fetch 
   * requests starting with /umbraco/management/api/
   */
  async _fetchVersions(e) {
    this._loading = !0;
    const i = await this._authContext?.getLatestToken();
    if (!i) {
      console.error("No authentication token available."), this._notificationContext?.peek("danger", {
        data: { headline: "Authentication Error", message: "No authentication token available." }
      }), this._loading = !1;
      return;
    }
    try {
      const a = `/umbraco/management/api/v1/snapshot/versions/${e}`, t = await fetch(a, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${i}`,
          "Content-Type": "application/json"
        }
      });
      t.ok ? this._versions = await t.json() : t.status === 401 && (console.error("Unauthorized: The session may have expired."), this._notificationContext?.peek("danger", {
        data: { headline: "Unauthorized", message: "The session may have expired." }
      }));
    } catch (a) {
      console.error("Failed to fetch snapshots:", a), this._notificationContext?.peek("danger", {
        data: { headline: "Error", message: "Failed to fetch snapshots." }
      });
    } finally {
      this._loading = !1;
    }
  }
  /**
   * Fetches the current (live) media file metadata and SAS URL
   */
  async _fetchCurrentMedia() {
    const e = await this._authContext?.getLatestToken();
    if (!e) return null;
    try {
      const i = `/umbraco/management/api/v1/snapshot/current/${this._mediaKey}`, a = await fetch(i, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${e}`,
          "Content-Type": "application/json"
        }
      });
      if (a.ok)
        return await a.json();
    } catch (i) {
      console.error("Failed to fetch current media:", i);
    }
    return null;
  }
  /**
   * Opens the comparison panel for a specific snapshot version
   */
  async _openComparison(e) {
    this._comparisonLoading = !0, this._comparisonSnapshot = e, this._showComparison = !0, this._sliderPosition = 50;
    const i = await this._fetchCurrentMedia();
    this._comparisonCurrent = i, this._comparisonLoading = !1;
  }
  /**
   * Closes the comparison panel
   */
  _closeComparison() {
    this._showComparison = !1, this._comparisonSnapshot = null, this._comparisonCurrent = null;
  }
  /**
   * Toggles the comparison mode between side-by-side and slider
   */
  _toggleComparisonMode() {
    this._comparisonMode = this._comparisonMode === "side-by-side" ? "slider" : "side-by-side";
  }
  /**
   * Handles the slider input for overlay comparison
   */
  _onSliderInput(e) {
    const i = e.target;
    this._sliderPosition = parseInt(i.value, 10);
  }
  /**
   * Returns the total number of pages based on versions count and page size
   */
  get _totalPages() {
    return Math.max(1, Math.ceil(this._versions.length / this._pageSize));
  }
  /**
   * Returns the versions for the current page
   */
  get _pagedVersions() {
    const e = (this._currentPage - 1) * this._pageSize;
    return this._versions.slice(e, e + this._pageSize);
  }
  /**
   * Handles page change from the pagination component
   */
  _onPageChange(e) {
    const i = e.target;
    this._currentPage = i.current;
  }
  /**
   * Checks if a filename is an image based on extension
   */
  _isImage(e) {
    const i = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"], a = e.substring(e.lastIndexOf(".")).toLowerCase();
    return i.includes(a);
  }
  /**
   * Opens the image preview panel
   */
  _openImagePreview(e) {
    this._isImage(e.name) && (this._previewImageUrl = e.url, this._previewImageName = e.name, this._showPreview = !0);
  }
  /**
   * Closes the image preview panel
   */
  _closePreview() {
    this._showPreview = !1, this._previewImageUrl = null, this._previewImageName = "";
  }
  /**
   * Restores a specific snapshot version as the current file
   */
  async _restoreVersion(e) {
    if (this._isRestoring) {
      console.warn("Restore already in progress");
      return;
    }
    if (!this._modalManagerContext) {
      console.error("Modal manager context not available");
      return;
    }
    const i = this._modalManagerContext.open(this, _, {
      data: {
        headline: "Restore File Version",
        content: o`
                    <p>Are you sure you want to restore <strong>"${e.name}"</strong>?</p>
                    <p>This will replace the current file and create a new snapshot.</p>
                    <uui-box>
                        <p style="margin: 0;">
                            <uui-icon name="icon-alert"></uui-icon>
                            <strong>Warning:</strong> This action cannot be undone.
                        </p>
                    </uui-box>
                `,
        color: "danger",
        confirmLabel: "Restore"
      }
    });
    try {
      await i.onSubmit();
    } catch {
      return;
    }
    this._isRestoring = !0;
    const a = await this._authContext?.getLatestToken();
    if (!a) {
      this._notificationContext?.peek("danger", {
        data: { headline: "Authentication Error", message: "No authentication token available." }
      }), this._isRestoring = !1;
      return;
    }
    try {
      const r = await fetch("/umbraco/management/api/v1/snapshot/restore", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${a}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mediaKey: this._mediaKey,
          snapshotName: e.name
        })
      });
      if (r.ok) {
        const u = await r.json();
        this._notificationContext?.peek("positive", {
          data: {
            headline: "Snapshot Restored",
            message: u.message
          }
        }), await this._fetchVersions(this._mediaKey);
      } else if (r.status === 401)
        this._notificationContext?.peek("danger", {
          data: {
            headline: "Unauthorized",
            message: "Your session may have expired. Please refresh the page."
          }
        });
      else {
        const u = await r.json();
        this._notificationContext?.peek("danger", {
          data: {
            headline: "Restore Failed",
            message: u.detail || "Unknown error"
          }
        });
      }
    } catch (t) {
      console.error("Failed to restore snapshot:", t), this._notificationContext?.peek("danger", {
        data: {
          headline: "Error",
          message: "An error occurred while restoring the snapshot. Please try again."
        }
      });
    } finally {
      this._isRestoring = !1;
    }
  }
  /**
   * Formats a byte count into a human-readable size string
   */
  _formatSize(e) {
    if (e === 0) return "0 B";
    const i = ["B", "KB", "MB", "GB"], a = Math.floor(Math.log(e) / Math.log(1024));
    return (e / Math.pow(1024, a)).toFixed(1) + " " + i[a];
  }
  /**
   * Renders the status tag for a snapshot version based on its metadata
   */
  _renderStatus(e, i) {
    return e.isRestored ? o`
                <uui-tag look="primary" color="positive">
                    <uui-icon name="icon-refresh"></uui-icon>
                    Restored ${e.restoredDate ? this._formatDate(e.restoredDate) : ""}
                </uui-tag>
            ` : i === 0 ? o`
                <uui-tag look="primary" color="default">
                    <uui-icon name="icon-check"></uui-icon>
                    Latest
                </uui-tag>
            ` : o`
            <uui-tag look="secondary" color="default">
                Original
            </uui-tag>
        `;
  }
  /**
   * Renders the comparison panel content
   */
  _renderComparison() {
    if (!this._showComparison) return "";
    const e = this._comparisonSnapshot, i = this._comparisonCurrent, a = e && i && this._isImage(e.name) && this._isImage(i.name);
    return o`
            <div class="preview-overlay" @click="${this._closeComparison}"></div>
            <div class="comparison-panel">
                <div class="preview-header">
                    <h3>
                        <uui-icon name="icon-split"></uui-icon>
                        Compare Versions
                    </h3>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${a ? o`
                            <uui-button
                                look="secondary"
                                compact
                                @click="${this._toggleComparisonMode}"
                                title="Toggle comparison mode">
                                <uui-icon name="${this._comparisonMode === "side-by-side" ? "icon-layers-alt" : "icon-split"}"></uui-icon>
                                ${this._comparisonMode === "side-by-side" ? "Slider" : "Side-by-Side"}
                            </uui-button>
                        ` : ""}
                        <uui-button
                            look="secondary"
                            compact
                            @click="${this._closeComparison}">
                            <uui-icon name="icon-delete"></uui-icon>
                        </uui-button>
                    </div>
                </div>
                <div class="comparison-content">
                    ${this._comparisonLoading ? o`<div class="loader"><uui-loader></uui-loader> Loading current file...</div>` : i ? a ? this._renderImageComparison(i, e) : this._renderMetadataComparison(i, e) : o`<uui-box><p>Unable to load the current media file for comparison.</p></uui-box>`}
                </div>
            </div>
        `;
  }
  /**
   * Renders a side-by-side or slider image comparison
   */
  _renderImageComparison(e, i) {
    return this._comparisonMode === "slider" ? o`
                <div class="slider-comparison">
                    <div class="slider-container">
                        <img class="slider-img-under" src="${e.url}" alt="Current" />
                        <div class="slider-img-over" style="width: ${this._sliderPosition}%;">
                            <img src="${i.url}" alt="Snapshot" />
                        </div>
                        <div class="slider-handle" style="left: ${this._sliderPosition}%;">
                            <div class="slider-handle-line"></div>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            .value="${String(this._sliderPosition)}"
                            @input="${this._onSliderInput}"
                            class="slider-range"
                        />
                    </div>
                    <div class="slider-labels">
                        <span><uui-tag look="primary" color="default">Snapshot</uui-tag> ${i.name}</span>
                        <span><uui-tag look="primary" color="positive">Current</uui-tag> ${e.name}</span>
                    </div>
                </div>
                ${this._renderMetadataComparison(e, i)}
            ` : o`
            <div class="side-by-side">
                <div class="compare-column">
                    <div class="compare-label">
                        <uui-tag look="primary" color="default">Snapshot</uui-tag>
                        <span class="compare-filename">${i.name}</span>
                    </div>
                    <div class="compare-image-container">
                        <img src="${i.url}" alt="${i.name}" />
                    </div>
                </div>
                <div class="compare-divider"></div>
                <div class="compare-column">
                    <div class="compare-label">
                        <uui-tag look="primary" color="positive">Current</uui-tag>
                        <span class="compare-filename">${e.name}</span>
                    </div>
                    <div class="compare-image-container">
                        <img src="${e.url}" alt="${e.name}" />
                    </div>
                </div>
            </div>
            ${this._renderMetadataComparison(e, i)}
        `;
  }
  /**
   * Renders a metadata diff table comparing the snapshot and current file
   */
  _renderMetadataComparison(e, i) {
    const a = e.size - i.size, t = a > 0 ? `+${this._formatSize(a)}` : a < 0 ? `-${this._formatSize(Math.abs(a))}` : "No change";
    return o`
            <div class="metadata-comparison">
                <h4>File Details</h4>
                <uui-table>
                    <uui-table-head>
                        <uui-table-head-cell>Property</uui-table-head-cell>
                        <uui-table-head-cell>Snapshot</uui-table-head-cell>
                        <uui-table-head-cell>Current</uui-table-head-cell>
                        <uui-table-head-cell>Difference</uui-table-head-cell>
                    </uui-table-head>
                    <uui-table-row>
                        <uui-table-cell><strong>Filename</strong></uui-table-cell>
                        <uui-table-cell>${i.name}</uui-table-cell>
                        <uui-table-cell>${e.name}</uui-table-cell>
                        <uui-table-cell>
                            ${i.name === e.name ? o`<uui-tag look="secondary" color="default">Same</uui-tag>` : o`<uui-tag look="primary" color="warning">Changed</uui-tag>`}
                        </uui-table-cell>
                    </uui-table-row>
                    <uui-table-row>
                        <uui-table-cell><strong>File Size</strong></uui-table-cell>
                        <uui-table-cell>${this._formatSize(i.size)}</uui-table-cell>
                        <uui-table-cell>${this._formatSize(e.size)}</uui-table-cell>
                        <uui-table-cell>
                            <uui-tag look="secondary" color="${a === 0 ? "default" : a > 0 ? "warning" : "positive"}">
                                ${t}
                            </uui-tag>
                        </uui-table-cell>
                    </uui-table-row>
                    <uui-table-row>
                        <uui-table-cell><strong>Date</strong></uui-table-cell>
                        <uui-table-cell>${this._formatDate(i.date)}</uui-table-cell>
                        <uui-table-cell>${this._formatDate(e.lastModified)}</uui-table-cell>
                        <uui-table-cell></uui-table-cell>
                    </uui-table-row>
                    ${i.uploader ? o`
                        <uui-table-row>
                            <uui-table-cell><strong>Uploaded By</strong></uui-table-cell>
                            <uui-table-cell>${i.uploader.replace(/_/g, " ")}</uui-table-cell>
                            <uui-table-cell>—</uui-table-cell>
                            <uui-table-cell></uui-table-cell>
                        </uui-table-row>
                    ` : ""}
                </uui-table>
            </div>
        `;
  }
  render() {
    if (this._loading)
      return o`<div class="loader"><uui-loader></uui-loader> Fetching snapshots...</div>`;
    if (this._versions.length === 0)
      return o`
                <uui-box>
                    <div style="display: flex; align-items: center; gap: var(--uui-size-space-3);">
                        <uui-icon name="info" style="color: var(--uui-color-primary);"></uui-icon>
                        <span>No previous versions found in the snapshots container.</span>
                    </div>
                </uui-box>
            `;
    const e = this._versions.length === 1, i = this._pagedVersions, a = (this._currentPage - 1) * this._pageSize;
    return o`
            <div class="snapshot-container">
                <uui-table>
                    <uui-table-head>
                        <uui-table-head-cell>Version Filename</uui-table-head-cell>
                        <uui-table-head-cell>Date Uploaded</uui-table-head-cell>
                        <uui-table-head-cell>Uploaded By</uui-table-head-cell>
                        <uui-table-head-cell>Status</uui-table-head-cell>
                        <uui-table-head-cell>Actions</uui-table-head-cell>
                    </uui-table-head>

                    ${i.map((t, r) => o`
                        <uui-table-row>
                            <uui-table-cell>
                                ${this._isImage(t.name) ? o`
                                        <button 
                                            class="filename-link" 
                                            @click="${() => this._openImagePreview(t)}"
                                            title="Click to preview image">
                                            <uui-icon name="icon-picture"></uui-icon>
                                            ${t.name}
                                        </button>
                                    ` : o`<span>${t.name}</span>`}
                            </uui-table-cell>
                            <uui-table-cell>${this._formatDate(t.date)}</uui-table-cell>
                            <uui-table-cell>${t.uploader.replace(/_/g, " ")}</uui-table-cell>
                            <uui-table-cell>
                                ${this._renderStatus(t, a + r)}
                            </uui-table-cell>
                            <uui-table-cell>
                                <div style="display: flex; gap: 8px;">
                                    <uui-button
                                        look="secondary"
                                        compact
                                        ?disabled="${a + r === 0}"
                                        title="${a + r === 0 ? "This is the latest version" : "Compare with current file"}"
                                        @click="${() => this._openComparison(t)}">
                                        <uui-icon name="icon-split"></uui-icon> Compare
                                    </uui-button>
                                    <uui-button 
                                        look="secondary" 
                                        compact 
                                        href="${t.url}" 
                                        target="_blank">
                                        <uui-icon name="icon-download-alt"></uui-icon> Download
                                    </uui-button>
                                    <uui-button 
                                        look="primary" 
                                        color="positive"
                                        compact
                                        ?disabled="${e || this._isRestoring || a + r === 0}"
                                        title="${e ? "Cannot restore when only one version exists" : a + r === 0 ? "This is already the latest version" : "Restore this version"}"
                                        @click="${() => this._restoreVersion(t)}">
                                        <uui-icon name="icon-refresh"></uui-icon> ${this._isRestoring ? "Restoring..." : "Restore"}
                                    </uui-button>
                                </div>
                            </uui-table-cell>
                        </uui-table-row>
                    `)}
                </uui-table>

                ${this._totalPages > 1 ? o`
                    <div class="pagination-container">
                        <uui-pagination
                            .current="${this._currentPage}"
                            .total="${this._totalPages}"
                            @change="${this._onPageChange}">
                        </uui-pagination>
                    </div>
                ` : ""}

                <!-- Image Preview Side Panel -->
                ${this._showPreview ? o`
                    <div class="preview-overlay" @click="${this._closePreview}"></div>
                    <div class="preview-panel">
                        <div class="preview-header">
                            <h3>
                                <uui-icon name="icon-picture"></uui-icon>
                                Image Preview
                            </h3>
                            <uui-button 
                                look="secondary" 
                                compact
                                @click="${this._closePreview}">
                                <uui-icon name="icon-delete"></uui-icon>
                            </uui-button>
                        </div>
                        <div class="preview-content">
                            <div class="preview-filename">
                                <strong>Filename:</strong> <br/>${this._previewImageName}
                            </div>
                            <div class="preview-image-container">
                                ${this._previewImageUrl ? o`
                                        <img 
                                            src="${this._previewImageUrl}" 
                                            alt="${this._previewImageName}"
                                            @error="${() => {
      this._notificationContext?.peek("warning", {
        data: {
          headline: "Preview Error",
          message: "Unable to load image preview"
        }
      });
    }}"
                                        />
                                    ` : o`<uui-loader></uui-loader>`}
                            </div>
                            <div class="preview-actions">
                                <uui-button 
                                    look="primary" 
                                    href="${this._previewImageUrl}" 
                                    target="_blank">
                                    <uui-icon name="icon-out"></uui-icon> Open in New Tab
                                </uui-button>
                                <uui-button 
                                    look="secondary" 
                                    href="${this._previewImageUrl}" 
                                    download="${this._previewImageName}">
                                    <uui-icon name="icon-download-alt"></uui-icon> Download
                                </uui-button>
                            </div>
                        </div>
                    </div>
                ` : ""}

                <!-- Comparison Panel -->
                ${this._renderComparison()}
            </div>
        `;
  }
  _formatDate(e) {
    return new Date(e).toLocaleDateString(void 0, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
};
s.styles = p`
        :host {
            display: block;
            margin-bottom: 20px;
        }

        .snapshot-container {
            position: relative;
        }
        
        .loader {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 20px;
            color: var(--uui-color-text-alt);
        }

        uui-table {
            border: 1px solid var(--uui-color-border);
            border-radius: var(--uui-border-radius);
            background: var(--uui-color-surface);
        }

        uui-table-head-cell {
            font-weight: bold;
        }

        uui-icon {
            margin-right: 4px;
        }

        .filename-link {
            background: none;
            border: none;
            color: var(--uui-color-interactive);
            cursor: pointer;
            padding: 0;
            font: inherit;
            display: flex;
            align-items: center;
            gap: 4px;
            text-decoration: underline;
            transition: color 0.2s;
        }

        .filename-link:hover {
            color: var(--uui-color-interactive-emphasis);
        }

        .filename-link uui-icon {
            margin-right: 4px;
            color: var(--uui-color-primary);
        }

        /* Pagination Styles */
        .pagination-container {
            display: flex;
            justify-content: center;
            padding: var(--uui-size-space-5) 0;
        }

        /* Preview Panel Styles */
        .preview-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            animation: fadeIn 0.2s ease-in;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
        }

        .preview-panel {
            position: fixed;
            top: 0;
            right: 0;
            bottom: 0;
            width: 500px;
            max-width: 90vw;
            background: var(--uui-color-surface);
            box-shadow: -2px 0 8px rgba(0, 0, 0, 0.2);
            z-index: 1001;
            display: flex;
            flex-direction: column;
            animation: slideIn 0.3s ease-out;
        }

        .preview-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: var(--uui-size-space-5);
            border-bottom: 1px solid var(--uui-color-border);
            background: var(--uui-color-surface-alt);
        }

        .preview-header h3 {
            margin: 0;
            font-size: 1.2rem;
            display: flex;
            align-items: center;
            gap: var(--uui-size-space-2);
        }

        .preview-content {
            flex: 1;
            overflow-y: auto;
            padding: var(--uui-size-space-5);
            display: flex;
            flex-direction: column;
            gap: var(--uui-size-space-4);
        }

        .preview-filename {
            padding: var(--uui-size-space-3);
            background: var(--uui-color-surface-alt);
            border-radius: var(--uui-border-radius);
            word-break: break-all;
        }

        .preview-image-container {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--uui-color-surface-alt);
            border-radius: var(--uui-border-radius);
            padding: var(--uui-size-space-4);
            min-height: 300px;
        }

        .preview-image-container img {
            max-width: 100%;
            max-height: 60vh;
            object-fit: contain;
            border-radius: var(--uui-border-radius);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .preview-actions {
            display: flex;
            gap: var(--uui-size-space-3);
            padding-top: var(--uui-size-space-4);
            border-top: 1px solid var(--uui-color-border);
        }

        .preview-actions uui-button {
            flex: 1;
        }

        /* Comparison Panel Styles */
        .comparison-panel {
            position: fixed;
            top: 0;
            right: 0;
            bottom: 0;
            width: 900px;
            max-width: 95vw;
            background: var(--uui-color-surface);
            box-shadow: -2px 0 8px rgba(0, 0, 0, 0.2);
            z-index: 1001;
            display: flex;
            flex-direction: column;
            animation: slideIn 0.3s ease-out;
        }

        .comparison-content {
            flex: 1;
            overflow-y: auto;
            padding: var(--uui-size-space-5);
            display: flex;
            flex-direction: column;
            gap: var(--uui-size-space-5);
        }

        /* Side-by-side image layout */
        .side-by-side {
            display: flex;
            gap: var(--uui-size-space-4);
            align-items: flex-start;
        }

        .compare-column {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: var(--uui-size-space-3);
        }

        .compare-label {
            display: flex;
            align-items: center;
            gap: var(--uui-size-space-2);
        }

        .compare-filename {
            font-size: 0.85rem;
            color: var(--uui-color-text-alt);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .compare-image-container {
            background: var(--uui-color-surface-alt);
            border-radius: var(--uui-border-radius);
            padding: var(--uui-size-space-3);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 200px;
            border: 1px solid var(--uui-color-border);
        }

        .compare-image-container img {
            max-width: 100%;
            max-height: 50vh;
            object-fit: contain;
            border-radius: var(--uui-border-radius);
        }

        .compare-divider {
            width: 1px;
            align-self: stretch;
            background: var(--uui-color-border);
        }

        /* Slider comparison */
        .slider-comparison {
            display: flex;
            flex-direction: column;
            gap: var(--uui-size-space-3);
        }

        .slider-container {
            position: relative;
            overflow: hidden;
            border-radius: var(--uui-border-radius);
            border: 1px solid var(--uui-color-border);
            background: var(--uui-color-surface-alt);
        }

        .slider-img-under {
            display: block;
            width: 100%;
            max-height: 50vh;
            object-fit: contain;
        }

        .slider-img-over {
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            overflow: hidden;
        }

        .slider-img-over img {
            display: block;
            height: 100%;
            max-height: 50vh;
            object-fit: contain;
        }

        .slider-handle {
            position: absolute;
            top: 0;
            bottom: 0;
            width: 3px;
            background: var(--uui-color-interactive);
            transform: translateX(-50%);
            pointer-events: none;
        }

        .slider-handle-line {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: var(--uui-color-interactive);
            border: 2px solid var(--uui-color-surface);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .slider-range {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            opacity: 0;
            cursor: ew-resize;
            margin: 0;
        }

        .slider-labels {
            display: flex;
            justify-content: space-between;
            font-size: 0.85rem;
        }

        .slider-labels span {
            display: flex;
            align-items: center;
            gap: var(--uui-size-space-2);
        }

        /* Metadata diff table */
        .metadata-comparison {
            border-top: 1px solid var(--uui-color-border);
            padding-top: var(--uui-size-space-4);
        }

        .metadata-comparison h4 {
            margin: 0 0 var(--uui-size-space-3) 0;
            font-size: 1rem;
        }

        @media (max-width: 768px) {
            .preview-panel {
                width: 100vw;
                max-width: 100vw;
            }
            .comparison-panel {
                width: 100vw;
                max-width: 100vw;
            }
            .side-by-side {
                flex-direction: column;
            }
            .compare-divider {
                width: 100%;
                height: 1px;
            }
        }
    `;
n([
  l()
], s.prototype, "_versions", 2);
n([
  l()
], s.prototype, "_loading", 2);
n([
  l()
], s.prototype, "_mediaKey", 2);
n([
  l()
], s.prototype, "_previewImageUrl", 2);
n([
  l()
], s.prototype, "_previewImageName", 2);
n([
  l()
], s.prototype, "_showPreview", 2);
n([
  l()
], s.prototype, "_isRestoring", 2);
n([
  l()
], s.prototype, "_currentPage", 2);
n([
  l()
], s.prototype, "_showComparison", 2);
n([
  l()
], s.prototype, "_comparisonSnapshot", 2);
n([
  l()
], s.prototype, "_comparisonCurrent", 2);
n([
  l()
], s.prototype, "_comparisonLoading", 2);
n([
  l()
], s.prototype, "_comparisonMode", 2);
n([
  l()
], s.prototype, "_sliderPosition", 2);
s = n([
  h("snapshot-viewer")
], s);
export {
  s as SnapshotViewerElement
};
//# sourceMappingURL=umbraco-media-snapshot.js.map
