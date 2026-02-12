import { LitElement as m, html as s, css as g, state as u, customElement as b } from "@umbraco-cms/backoffice/external/lit";
import { UmbElementMixin as v } from "@umbraco-cms/backoffice/element-api";
import { UMB_WORKSPACE_CONTEXT as f } from "@umbraco-cms/backoffice/workspace";
import { UMB_AUTH_CONTEXT as _ } from "@umbraco-cms/backoffice/auth";
import { UMB_NOTIFICATION_CONTEXT as w } from "@umbraco-cms/backoffice/notification";
import { UMB_MODAL_MANAGER_CONTEXT as y, UMB_CONFIRM_MODAL as p } from "@umbraco-cms/backoffice/modal";
var x = Object.defineProperty, k = Object.getOwnPropertyDescriptor, l = (e, i, t, o) => {
  for (var a = o > 1 ? void 0 : o ? k(i, t) : i, r = e.length - 1, c; r >= 0; r--)
    (c = e[r]) && (a = (o ? c(i, t, a) : c(a)) || a);
  return o && a && x(i, t, a), a;
};
let n = class extends v(m) {
  constructor() {
    super(), this._versions = [], this._loading = !0, this._mediaKey = "", this._previewImageUrl = null, this._previewImageName = "", this._showPreview = !1, this._isRestoring = !1, this._currentPage = 1, this._showComparison = !1, this._comparisonSnapshot = null, this._comparisonCurrent = null, this._comparisonLoading = !1, this._comparisonMode = "side-by-side", this._sliderPosition = 50, this._selectedSnapshots = /* @__PURE__ */ new Set(), this._isDeleting = !1, this._pageSize = 10, this.consumeContext(_, (e) => {
      this._authContext = e;
    }), this.consumeContext(w, (e) => {
      this._notificationContext = e;
    }), this.consumeContext(y, (e) => {
      this._modalManagerContext = e;
    }), this.consumeContext(f, (e) => {
      const i = e;
      i.unique && this.observe(i.unique, (t) => {
        t && t !== this._mediaKey && (this._mediaKey = t.toString(), this._currentPage = 1, this._fetchVersions(this._mediaKey));
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
      const t = `/umbraco/management/api/v1/snapshot/versions/${e}`, o = await fetch(t, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${i}`,
          "Content-Type": "application/json"
        }
      });
      o.ok ? (this._versions = await o.json(), this._selectedSnapshots = /* @__PURE__ */ new Set()) : o.status === 401 && (console.error("Unauthorized: The session may have expired."), this._notificationContext?.peek("danger", {
        data: { headline: "Unauthorized", message: "The session may have expired." }
      }));
    } catch (t) {
      console.error("Failed to fetch snapshots:", t), this._notificationContext?.peek("danger", {
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
      const i = `/umbraco/management/api/v1/snapshot/current/${this._mediaKey}`, t = await fetch(i, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${e}`,
          "Content-Type": "application/json"
        }
      });
      if (t.ok)
        return await t.json();
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
    const i = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"], t = e.substring(e.lastIndexOf(".")).toLowerCase();
    return i.includes(t);
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
  // --- Selection helpers ---
  /**
   * Toggles a single snapshot's selection state
   */
  _toggleSelection(e) {
    const i = new Set(this._selectedSnapshots);
    i.has(e) ? i.delete(e) : i.add(e), this._selectedSnapshots = i;
  }
  /**
   * Toggles select-all for the current page (excluding the latest version at index 0)
   */
  _toggleSelectAll() {
    const e = (this._currentPage - 1) * this._pageSize, i = this._pagedVersions.filter((a, r) => e + r !== 0).map((a) => a.name), t = i.every((a) => this._selectedSnapshots.has(a)), o = new Set(this._selectedSnapshots);
    t ? i.forEach((a) => o.delete(a)) : i.forEach((a) => o.add(a)), this._selectedSnapshots = o;
  }
  /**
   * Whether all selectable items on the current page are selected
   */
  get _allPageSelected() {
    const e = (this._currentPage - 1) * this._pageSize, i = this._pagedVersions.filter((t, o) => e + o !== 0);
    return i.length > 0 && i.every((t) => this._selectedSnapshots.has(t.name));
  }
  /**
   * Clears all selections
   */
  _clearSelection() {
    this._selectedSnapshots = /* @__PURE__ */ new Set();
  }
  // --- Delete operations ---
  /**
   * Deletes a single snapshot after confirmation
   */
  async _deleteSnapshot(e) {
    if (this._isDeleting) return;
    if (!this._modalManagerContext) {
      console.error("Modal manager context not available");
      return;
    }
    const i = this._modalManagerContext.open(this, p, {
      data: {
        headline: "Delete Snapshot",
        content: s`
                    <p>Are you sure you want to permanently delete <strong>"${e.name}"</strong>?</p>
                    <uui-box>
                        <p style="margin: 0;">
                            <uui-icon name="icon-alert"></uui-icon>
                            <strong>Warning:</strong> This action cannot be undone. The snapshot will be permanently removed from storage.
                        </p>
                    </uui-box>
                `,
        color: "danger",
        confirmLabel: "Delete"
      }
    });
    try {
      await i.onSubmit();
    } catch {
      return;
    }
    this._isDeleting = !0;
    const t = await this._authContext?.getLatestToken();
    if (!t) {
      this._notificationContext?.peek("danger", {
        data: { headline: "Authentication Error", message: "No authentication token available." }
      }), this._isDeleting = !1;
      return;
    }
    try {
      const o = await fetch("/umbraco/management/api/v1/snapshot/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mediaKey: this._mediaKey,
          snapshotName: e.name
        })
      });
      if (o.ok) {
        const a = await o.json();
        this._notificationContext?.peek("positive", {
          data: { headline: "Snapshot Deleted", message: a.message }
        }), await this._fetchVersions(this._mediaKey);
      } else if (o.status === 401)
        this._notificationContext?.peek("danger", {
          data: { headline: "Unauthorized", message: "Your session may have expired. Please refresh the page." }
        });
      else {
        const a = await o.json();
        this._notificationContext?.peek("danger", {
          data: { headline: "Delete Failed", message: a.detail || "Unknown error" }
        });
      }
    } catch (o) {
      console.error("Failed to delete snapshot:", o), this._notificationContext?.peek("danger", {
        data: { headline: "Error", message: "An error occurred while deleting the snapshot." }
      });
    } finally {
      this._isDeleting = !1;
    }
  }
  /**
   * Deletes all selected snapshots after confirmation
   */
  async _bulkDeleteSnapshots() {
    if (this._isDeleting || this._selectedSnapshots.size === 0) return;
    if (!this._modalManagerContext) {
      console.error("Modal manager context not available");
      return;
    }
    const e = this._selectedSnapshots.size, i = this._modalManagerContext.open(this, p, {
      data: {
        headline: "Delete Selected Snapshots",
        content: s`
                    <p>Are you sure you want to permanently delete <strong>${e} snapshot${e > 1 ? "s" : ""}</strong>?</p>
                    <uui-box>
                        <p style="margin: 0;">
                            <uui-icon name="icon-alert"></uui-icon>
                            <strong>Warning:</strong> This action cannot be undone. All selected snapshots will be permanently removed from storage.
                        </p>
                    </uui-box>
                `,
        color: "danger",
        confirmLabel: `Delete ${e} Snapshot${e > 1 ? "s" : ""}`
      }
    });
    try {
      await i.onSubmit();
    } catch {
      return;
    }
    this._isDeleting = !0;
    const t = await this._authContext?.getLatestToken();
    if (!t) {
      this._notificationContext?.peek("danger", {
        data: { headline: "Authentication Error", message: "No authentication token available." }
      }), this._isDeleting = !1;
      return;
    }
    try {
      const o = await fetch("/umbraco/management/api/v1/snapshot/delete-bulk", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mediaKey: this._mediaKey,
          snapshotNames: Array.from(this._selectedSnapshots)
        })
      });
      if (o.ok) {
        const a = await o.json();
        this._notificationContext?.peek("positive", {
          data: { headline: "Snapshots Deleted", message: a.message }
        }), await this._fetchVersions(this._mediaKey);
      } else if (o.status === 401)
        this._notificationContext?.peek("danger", {
          data: { headline: "Unauthorized", message: "Your session may have expired. Please refresh the page." }
        });
      else {
        const a = await o.json();
        this._notificationContext?.peek("danger", {
          data: { headline: "Bulk Delete Failed", message: a.detail || "Unknown error" }
        });
      }
    } catch (o) {
      console.error("Failed to bulk delete snapshots:", o), this._notificationContext?.peek("danger", {
        data: { headline: "Error", message: "An error occurred while deleting snapshots." }
      });
    } finally {
      this._isDeleting = !1;
    }
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
    const i = this._modalManagerContext.open(this, p, {
      data: {
        headline: "Restore File Version",
        content: s`
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
    const t = await this._authContext?.getLatestToken();
    if (!t) {
      this._notificationContext?.peek("danger", {
        data: { headline: "Authentication Error", message: "No authentication token available." }
      }), this._isRestoring = !1;
      return;
    }
    try {
      const a = await fetch("/umbraco/management/api/v1/snapshot/restore", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mediaKey: this._mediaKey,
          snapshotName: e.name
        })
      });
      if (a.ok) {
        const r = await a.json();
        this._notificationContext?.peek("positive", {
          data: {
            headline: "Snapshot Restored",
            message: r.message
          }
        }), await this._fetchVersions(this._mediaKey);
      } else if (a.status === 401)
        this._notificationContext?.peek("danger", {
          data: {
            headline: "Unauthorized",
            message: "Your session may have expired. Please refresh the page."
          }
        });
      else {
        const r = await a.json();
        this._notificationContext?.peek("danger", {
          data: {
            headline: "Restore Failed",
            message: r.detail || "Unknown error"
          }
        });
      }
    } catch (o) {
      console.error("Failed to restore snapshot:", o), this._notificationContext?.peek("danger", {
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
    const i = ["B", "KB", "MB", "GB"], t = Math.floor(Math.log(e) / Math.log(1024));
    return (e / Math.pow(1024, t)).toFixed(1) + " " + i[t];
  }
  /**
   * Renders the status tag for a snapshot version based on its metadata
   */
  _renderStatus(e, i) {
    return e.isRestored ? s`
                <uui-tag look="primary" color="positive">
                    <uui-icon name="icon-refresh"></uui-icon>
                    Restored ${e.restoredDate ? this._formatDate(e.restoredDate) : ""}
                </uui-tag>
            ` : i === 0 ? s`
                <uui-tag look="primary" color="default">
                    <uui-icon name="icon-check"></uui-icon>
                    Latest
                </uui-tag>
            ` : s`
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
    const e = this._comparisonSnapshot, i = this._comparisonCurrent, t = e && i && this._isImage(e.name) && this._isImage(i.name);
    return s`
            <div class="preview-overlay" @click="${this._closeComparison}"></div>
            <div class="comparison-panel">
                <div class="preview-header">
                    <h3>
                        <uui-icon name="icon-split"></uui-icon>
                        Compare Versions
                    </h3>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${t ? s`
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
                    ${this._comparisonLoading ? s`<div class="loader"><uui-loader></uui-loader> Loading current file...</div>` : i ? t ? this._renderImageComparison(i, e) : this._renderMetadataComparison(i, e) : s`<uui-box><p>Unable to load the current media file for comparison.</p></uui-box>`}
                </div>
            </div>
        `;
  }
  /**
   * Renders a side-by-side or slider image comparison
   */
  _renderImageComparison(e, i) {
    return this._comparisonMode === "slider" ? s`
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
            ` : s`
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
    const t = e.size - i.size, o = t > 0 ? `+${this._formatSize(t)}` : t < 0 ? `-${this._formatSize(Math.abs(t))}` : "No change";
    return s`
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
                            ${i.name === e.name ? s`<uui-tag look="secondary" color="default">Same</uui-tag>` : s`<uui-tag look="primary" color="warning">Changed</uui-tag>`}
                        </uui-table-cell>
                    </uui-table-row>
                    <uui-table-row>
                        <uui-table-cell><strong>File Size</strong></uui-table-cell>
                        <uui-table-cell>${this._formatSize(i.size)}</uui-table-cell>
                        <uui-table-cell>${this._formatSize(e.size)}</uui-table-cell>
                        <uui-table-cell>
                            <uui-tag look="secondary" color="${t === 0 ? "default" : t > 0 ? "warning" : "positive"}">
                                ${o}
                            </uui-tag>
                        </uui-table-cell>
                    </uui-table-row>
                    <uui-table-row>
                        <uui-table-cell><strong>Date</strong></uui-table-cell>
                        <uui-table-cell>${this._formatDate(i.date)}</uui-table-cell>
                        <uui-table-cell>${this._formatDate(e.lastModified)}</uui-table-cell>
                        <uui-table-cell></uui-table-cell>
                    </uui-table-row>
                    ${i.uploader ? s`
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
  /**
   * Renders a compact summary stats strip for this media item's snapshots
   */
  _renderStats() {
    if (this._versions.length === 0) return "";
    const e = this._versions.reduce((r, c) => r + (c.size || 0), 0), i = this._versions.map((r) => new Date(r.date).getTime()).filter((r) => !isNaN(r)), t = i.length > 0 ? new Date(Math.min(...i)) : null, o = i.length > 0 ? new Date(Math.max(...i)) : null, a = new Set(this._versions.map((r) => r.uploader).filter(Boolean));
    return s`
            <div class="stats-strip">
                <div class="stats-strip-item">
                    <uui-icon name="icon-documents"></uui-icon>
                    <span class="stats-strip-value">${this._versions.length}</span>
                    <span class="stats-strip-label">Snapshot${this._versions.length !== 1 ? "s" : ""}</span>
                </div>
                <div class="stats-strip-divider"></div>
                <div class="stats-strip-item">
                    <uui-icon name="icon-server"></uui-icon>
                    <span class="stats-strip-value">${this._formatSize(e)}</span>
                    <span class="stats-strip-label">Total Size</span>
                </div>
                <div class="stats-strip-divider"></div>
                <div class="stats-strip-item">
                    <uui-icon name="icon-calendar"></uui-icon>
                    <span class="stats-strip-value">${t ? this._formatDate(t.toISOString()) : "—"}</span>
                    <span class="stats-strip-label">Oldest</span>
                </div>
                <div class="stats-strip-divider"></div>
                <div class="stats-strip-item">
                    <uui-icon name="icon-calendar"></uui-icon>
                    <span class="stats-strip-value">${o ? this._formatDate(o.toISOString()) : "—"}</span>
                    <span class="stats-strip-label">Latest</span>
                </div>
                <div class="stats-strip-divider"></div>
                <div class="stats-strip-item">
                    <uui-icon name="icon-users"></uui-icon>
                    <span class="stats-strip-value">${a.size}</span>
                    <span class="stats-strip-label">Contributor${a.size !== 1 ? "s" : ""}</span>
                </div>
            </div>
        `;
  }
  render() {
    if (this._loading)
      return s`<div class="loader"><uui-loader></uui-loader> Fetching snapshots...</div>`;
    if (this._versions.length === 0)
      return s`
                <uui-box>
                    <div style="display: flex; align-items: center; gap: var(--uui-size-space-3);">
                        <uui-icon name="info" style="color: var(--uui-color-primary);"></uui-icon>
                        <span>No previous versions found in the snapshots container.</span>
                    </div>
                </uui-box>
            `;
    const e = this._versions.length === 1, i = this._pagedVersions, t = (this._currentPage - 1) * this._pageSize, o = this._selectedSnapshots.size > 0;
    return s`
            <div class="snapshot-container">

                <!-- Summary stats for this media item -->
                ${this._renderStats()}

                <!-- Bulk action toolbar -->
                ${o ? s`
                    <div class="bulk-toolbar">
                        <span class="bulk-toolbar-count">
                            <uui-icon name="icon-check"></uui-icon>
                            ${this._selectedSnapshots.size} snapshot${this._selectedSnapshots.size > 1 ? "s" : ""} selected
                        </span>
                        <div class="bulk-toolbar-actions">
                            <uui-button
                                look="secondary"
                                compact
                                @click="${this._clearSelection}">
                                Clear Selection
                            </uui-button>
                            <uui-button
                                look="primary"
                                color="danger"
                                compact
                                ?disabled="${this._isDeleting}"
                                @click="${this._bulkDeleteSnapshots}">
                                <uui-icon name="icon-trash"></uui-icon>
                                ${this._isDeleting ? "Deleting..." : `Delete ${this._selectedSnapshots.size} Snapshot${this._selectedSnapshots.size > 1 ? "s" : ""}`}
                            </uui-button>
                        </div>
                    </div>
                ` : ""}

                <uui-table>
                    <uui-table-head>
                        <uui-table-head-cell style="width: 40px;">
                            <input
                                type="checkbox"
                                .checked="${this._allPageSelected}"
                                @change="${this._toggleSelectAll}"
                                title="Select all on this page"
                                class="select-checkbox"
                            />
                        </uui-table-head-cell>
                        <uui-table-head-cell>Version Filename</uui-table-head-cell>
                        <uui-table-head-cell>Date Uploaded</uui-table-head-cell>
                        <uui-table-head-cell>Uploaded By</uui-table-head-cell>
                        <uui-table-head-cell>Status</uui-table-head-cell>
                        <uui-table-head-cell>Actions</uui-table-head-cell>
                    </uui-table-head>

                    ${i.map((a, r) => {
      const c = t + r, d = c === 0, h = this._selectedSnapshots.has(a.name);
      return s`
                            <uui-table-row class="${h ? "row-selected" : ""}">
                                <uui-table-cell style="width: 40px;">
                                    <input
                                        type="checkbox"
                                        .checked="${h}"
                                        ?disabled="${d}"
                                        @change="${() => this._toggleSelection(a.name)}"
                                        title="${d ? "Cannot select the latest version" : "Select this snapshot"}"
                                        class="select-checkbox"
                                    />
                                </uui-table-cell>
                                <uui-table-cell>
                                    ${this._isImage(a.name) ? s`
                                            <button 
                                                class="filename-link" 
                                                @click="${() => this._openImagePreview(a)}"
                                                title="Click to preview image">
                                                <uui-icon name="icon-picture"></uui-icon>
                                                ${a.name}
                                            </button>
                                        ` : s`<span>${a.name}</span>`}
                                </uui-table-cell>
                                <uui-table-cell>${this._formatDate(a.date)}</uui-table-cell>
                                <uui-table-cell>${a.uploader.replace(/_/g, " ")}</uui-table-cell>
                                <uui-table-cell>
                                    ${this._renderStatus(a, c)}
                                </uui-table-cell>
                                <uui-table-cell>
                                    <div style="display: flex; gap: 8px;">
                                        <uui-button
                                            look="secondary"
                                            compact
                                            ?disabled="${d}"
                                            title="${d ? "This is the latest version" : "Compare with current file"}"
                                            @click="${() => this._openComparison(a)}">
                                            <uui-icon name="icon-split"></uui-icon> Compare
                                        </uui-button>
                                        <uui-button 
                                            look="secondary" 
                                            compact 
                                            href="${a.url}" 
                                            target="_blank">
                                            <uui-icon name="icon-download-alt"></uui-icon> Download
                                        </uui-button>
                                        <uui-button 
                                            look="primary" 
                                            color="positive"
                                            compact
                                            ?disabled="${e || this._isRestoring || d}"
                                            title="${e ? "Cannot restore when only one version exists" : d ? "This is already the latest version" : "Restore this version"}"
                                            @click="${() => this._restoreVersion(a)}">
                                            <uui-icon name="icon-refresh"></uui-icon> ${this._isRestoring ? "Restoring..." : "Restore"}
                                        </uui-button>
                                        <uui-button
                                            look="secondary"
                                            color="danger"
                                            compact
                                            ?disabled="${d || this._isDeleting}"
                                            title="${d ? "Cannot delete the latest version" : "Delete this snapshot"}"
                                            @click="${() => this._deleteSnapshot(a)}">
                                            <uui-icon name="icon-trash"></uui-icon>
                                        </uui-button>
                                    </div>
                                </uui-table-cell>
                            </uui-table-row>
                        `;
    })}
                </uui-table>

                ${this._totalPages > 1 ? s`
                    <div class="pagination-container">
                        <uui-pagination
                            .current="${this._currentPage}"
                            .total="${this._totalPages}"
                            @change="${this._onPageChange}">
                        </uui-pagination>
                    </div>
                ` : ""}

                <!-- Image Preview Side Panel -->
                ${this._showPreview ? s`
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
                                ${this._previewImageUrl ? s`
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
                                    ` : s`<uui-loader></uui-loader>`}
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
n.styles = g`
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

        /* Selection checkbox */
        .select-checkbox {
            cursor: pointer;
            width: 16px;
            height: 16px;
            accent-color: var(--uui-color-interactive);
        }

        .select-checkbox:disabled {
            cursor: not-allowed;
            opacity: 0.3;
        }

        /* Selected row highlight */
        .row-selected {
            background-color: color-mix(in srgb, var(--uui-color-selected) 10%, transparent);
        }

        /* Bulk action toolbar */
        .bulk-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: var(--uui-size-space-3) var(--uui-size-space-4);
            margin-bottom: var(--uui-size-space-3);
            background: color-mix(in srgb, var(--uui-color-selected) 8%, var(--uui-color-surface));
            border: 1px solid var(--uui-color-selected);
            border-radius: var(--uui-border-radius);
            animation: fadeIn 0.2s ease-in;
        }

        .bulk-toolbar-count {
            display: flex;
            align-items: center;
            gap: var(--uui-size-space-2);
            font-weight: 600;
            color: var(--uui-color-selected);
        }

        .bulk-toolbar-actions {
            display: flex;
            gap: var(--uui-size-space-2);
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

        /* Stats strip */
        .stats-strip {
            display: flex;
            align-items: center;
            gap: var(--uui-size-space-4);
            padding: var(--uui-size-space-3) var(--uui-size-space-4);
            margin-bottom: var(--uui-size-space-4);
            background: var(--uui-color-surface-alt);
            border: 1px solid var(--uui-color-border);
            border-radius: var(--uui-border-radius);
            flex-wrap: wrap;
        }

        .stats-strip-item {
            display: flex;
            align-items: center;
            gap: var(--uui-size-space-2);
        }

        .stats-strip-item uui-icon {
            color: var(--uui-color-primary);
            font-size: 0.9rem;
        }

        .stats-strip-value {
            font-weight: 700;
            font-size: 0.9rem;
        }

        .stats-strip-label {
            font-size: 0.8rem;
            color: var(--uui-color-text-alt);
        }

        .stats-strip-divider {
            width: 1px;
            height: 20px;
            background: var(--uui-color-border);
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
            .bulk-toolbar {
                flex-direction: column;
                gap: var(--uui-size-space-3);
                text-align: center;
            }
        }
    `;
l([
  u()
], n.prototype, "_versions", 2);
l([
  u()
], n.prototype, "_loading", 2);
l([
  u()
], n.prototype, "_mediaKey", 2);
l([
  u()
], n.prototype, "_previewImageUrl", 2);
l([
  u()
], n.prototype, "_previewImageName", 2);
l([
  u()
], n.prototype, "_showPreview", 2);
l([
  u()
], n.prototype, "_isRestoring", 2);
l([
  u()
], n.prototype, "_currentPage", 2);
l([
  u()
], n.prototype, "_showComparison", 2);
l([
  u()
], n.prototype, "_comparisonSnapshot", 2);
l([
  u()
], n.prototype, "_comparisonCurrent", 2);
l([
  u()
], n.prototype, "_comparisonLoading", 2);
l([
  u()
], n.prototype, "_comparisonMode", 2);
l([
  u()
], n.prototype, "_sliderPosition", 2);
l([
  u()
], n.prototype, "_selectedSnapshots", 2);
l([
  u()
], n.prototype, "_isDeleting", 2);
n = l([
  b("snapshot-viewer")
], n);
export {
  n as SnapshotViewerElement
};
//# sourceMappingURL=umbraco-media-snapshot.js.map
