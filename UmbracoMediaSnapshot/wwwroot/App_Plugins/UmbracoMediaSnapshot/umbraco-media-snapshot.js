import { LitElement as m, html as s, css as g, state as u, customElement as v } from "@umbraco-cms/backoffice/external/lit";
import { UmbElementMixin as b } from "@umbraco-cms/backoffice/element-api";
import { UMB_WORKSPACE_CONTEXT as f } from "@umbraco-cms/backoffice/workspace";
import { UMB_AUTH_CONTEXT as _ } from "@umbraco-cms/backoffice/auth";
import { UMB_NOTIFICATION_CONTEXT as x } from "@umbraco-cms/backoffice/notification";
import { UMB_MODAL_MANAGER_CONTEXT as y, UMB_CONFIRM_MODAL as p } from "@umbraco-cms/backoffice/modal";
var w = Object.defineProperty, k = Object.getOwnPropertyDescriptor, r = (e, t, i, o) => {
  for (var a = o > 1 ? void 0 : o ? k(t, i) : t, l = e.length - 1, c; l >= 0; l--)
    (c = e[l]) && (a = (o ? c(t, i, a) : c(a)) || a);
  return o && a && w(t, i, a), a;
};
let n = class extends b(m) {
  constructor() {
    super(), this._versions = [], this._loading = !0, this._mediaKey = "", this._previewImageUrl = null, this._previewImageName = "", this._showPreview = !1, this._isRestoring = !1, this._currentPage = 1, this._showComparison = !1, this._comparisonSnapshot = null, this._comparisonCurrent = null, this._comparisonLoading = !1, this._comparisonMode = "side-by-side", this._sliderPosition = 50, this._selectedSnapshots = /* @__PURE__ */ new Set(), this._isDeleting = !1, this._editingNoteName = null, this._editingNoteValue = "", this._savingNote = !1, this._pageSize = 10, this.consumeContext(_, (e) => {
      this._authContext = e;
    }), this.consumeContext(x, (e) => {
      this._notificationContext = e;
    }), this.consumeContext(y, (e) => {
      this._modalManagerContext = e;
    }), this.consumeContext(f, (e) => {
      const t = e;
      t.unique && this.observe(t.unique, (i) => {
        i && i !== this._mediaKey && (this._mediaKey = i.toString(), this._currentPage = 1, this._fetchVersions(this._mediaKey));
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
    const t = await this._authContext?.getLatestToken();
    if (!t) {
      console.error("No authentication token available."), this._notificationContext?.peek("danger", {
        data: { headline: "Authentication Error", message: "No authentication token available." }
      }), this._loading = !1;
      return;
    }
    try {
      const i = `/umbraco/management/api/v1/snapshot/versions/${e}`, o = await fetch(i, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json"
        }
      });
      o.ok ? (this._versions = await o.json(), this._selectedSnapshots = /* @__PURE__ */ new Set()) : o.status === 401 && (console.error("Unauthorized: The session may have expired."), this._notificationContext?.peek("danger", {
        data: { headline: "Unauthorized", message: "The session may have expired." }
      }));
    } catch (i) {
      console.error("Failed to fetch snapshots:", i), this._notificationContext?.peek("danger", {
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
      const t = `/umbraco/management/api/v1/snapshot/current/${this._mediaKey}`, i = await fetch(t, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${e}`,
          "Content-Type": "application/json"
        }
      });
      if (i.ok)
        return await i.json();
    } catch (t) {
      console.error("Failed to fetch current media:", t);
    }
    return null;
  }
  /**
   * Opens the comparison panel for a specific snapshot version
   */
  async _openComparison(e) {
    this._comparisonLoading = !0, this._comparisonSnapshot = e, this._showComparison = !0, this._sliderPosition = 50;
    const t = await this._fetchCurrentMedia();
    this._comparisonCurrent = t, this._comparisonLoading = !1;
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
    const t = e.target;
    this._sliderPosition = parseInt(t.value, 10);
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
    const t = e.target;
    this._currentPage = t.current;
  }
  /**
   * Checks if a filename is an image based on extension
   */
  _isImage(e) {
    const t = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"], i = e.substring(e.lastIndexOf(".")).toLowerCase();
    return t.includes(i);
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
    const t = new Set(this._selectedSnapshots);
    t.has(e) ? t.delete(e) : t.add(e), this._selectedSnapshots = t;
  }
  /**
   * Toggles select-all for the current page (excluding the latest version at index 0)
   */
  _toggleSelectAll() {
    const e = (this._currentPage - 1) * this._pageSize, t = this._pagedVersions.filter((a, l) => e + l !== 0).map((a) => a.name), i = t.every((a) => this._selectedSnapshots.has(a)), o = new Set(this._selectedSnapshots);
    i ? t.forEach((a) => o.delete(a)) : t.forEach((a) => o.add(a)), this._selectedSnapshots = o;
  }
  /**
   * Whether all selectable items on the current page are selected
   */
  get _allPageSelected() {
    const e = (this._currentPage - 1) * this._pageSize, t = this._pagedVersions.filter((i, o) => e + o !== 0);
    return t.length > 0 && t.every((i) => this._selectedSnapshots.has(i.name));
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
    const t = this._modalManagerContext.open(this, p, {
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
      await t.onSubmit();
    } catch {
      return;
    }
    this._isDeleting = !0;
    const i = await this._authContext?.getLatestToken();
    if (!i) {
      this._notificationContext?.peek("danger", {
        data: { headline: "Authentication Error", message: "No authentication token available." }
      }), this._isDeleting = !1;
      return;
    }
    try {
      const o = await fetch("/umbraco/management/api/v1/snapshot/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${i}`,
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
    const e = this._selectedSnapshots.size, t = this._modalManagerContext.open(this, p, {
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
      await t.onSubmit();
    } catch {
      return;
    }
    this._isDeleting = !0;
    const i = await this._authContext?.getLatestToken();
    if (!i) {
      this._notificationContext?.peek("danger", {
        data: { headline: "Authentication Error", message: "No authentication token available." }
      }), this._isDeleting = !1;
      return;
    }
    try {
      const o = await fetch("/umbraco/management/api/v1/snapshot/delete-bulk", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${i}`,
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
    const t = this._modalManagerContext.open(this, p, {
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
      await t.onSubmit();
    } catch {
      return;
    }
    this._isRestoring = !0;
    const i = await this._authContext?.getLatestToken();
    if (!i) {
      this._notificationContext?.peek("danger", {
        data: { headline: "Authentication Error", message: "No authentication token available." }
      }), this._isRestoring = !1;
      return;
    }
    try {
      const a = await fetch("/umbraco/management/api/v1/snapshot/restore", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${i}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mediaKey: this._mediaKey,
          snapshotName: e.name
        })
      });
      if (a.ok) {
        const l = await a.json();
        this._notificationContext?.peek("positive", {
          data: {
            headline: "Snapshot Restored",
            message: l.message
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
        const l = await a.json();
        this._notificationContext?.peek("danger", {
          data: {
            headline: "Restore Failed",
            message: l.detail || "Unknown error"
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
    const t = ["B", "KB", "MB", "GB"], i = Math.floor(Math.log(e) / Math.log(1024));
    return (e / Math.pow(1024, i)).toFixed(1) + " " + t[i];
  }
  /**
   * Renders a compact inline status badge for a snapshot version
   */
  _renderStatus(e, t) {
    return e.isRestored ? s`<uui-tag class="status-badge" look="primary" color="positive">Restored</uui-tag>` : t === 0 ? s`<uui-tag class="status-badge" look="primary" color="default">Latest</uui-tag>` : s``;
  }
  /**
   * Renders the comparison panel content
   */
  _renderComparison() {
    if (!this._showComparison) return "";
    const e = this._comparisonSnapshot, t = this._comparisonCurrent, i = e && t && this._isImage(e.name) && this._isImage(t.name);
    return s`
            <div class="preview-overlay" @click="${this._closeComparison}"></div>
            <div class="comparison-panel">
                <div class="preview-header">
                    <h3>
                        <uui-icon name="icon-split"></uui-icon>
                        Compare Versions
                    </h3>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${i ? s`
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
                    ${this._comparisonLoading ? s`<div class="loader"><uui-loader></uui-loader> Loading current file...</div>` : t ? i ? this._renderImageComparison(t, e) : this._renderMetadataComparison(t, e) : s`<uui-box><p>Unable to load the current media file for comparison.</p></uui-box>`}
                </div>
            </div>
        `;
  }
  /**
   * Renders a side-by-side or slider image comparison
   */
  _renderImageComparison(e, t) {
    return this._comparisonMode === "slider" ? s`
                <div class="slider-comparison">
                    <div class="slider-container">
                        <img class="slider-img-under" src="${e.url}" alt="Current" />
                        <div class="slider-img-over" style="width: ${this._sliderPosition}%;">
                            <img src="${t.url}" alt="Snapshot" />
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
                        <span><uui-tag look="primary" color="default">Snapshot</uui-tag> ${t.name}</span>
                        <span><uui-tag look="primary" color="positive">Current</uui-tag> ${e.name}</span>
                    </div>
                </div>
                ${this._renderMetadataComparison(e, t)}
            ` : s`
            <div class="side-by-side">
                <div class="compare-column">
                    <div class="compare-label">
                        <uui-tag look="primary" color="default">Snapshot</uui-tag>
                        <span class="compare-filename">${t.name}</span>
                    </div>
                    <div class="compare-image-container">
                        <img src="${t.url}" alt="${t.name}" />
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
            ${this._renderMetadataComparison(e, t)}
        `;
  }
  /**
   * Renders a metadata diff table comparing the snapshot and current file
   */
  _renderMetadataComparison(e, t) {
    const i = e.size - t.size, o = i > 0 ? `+${this._formatSize(i)}` : i < 0 ? `-${this._formatSize(Math.abs(i))}` : "No change";
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
                        <uui-table-cell>${t.name}</uui-table-cell>
                        <uui-table-cell>${e.name}</uui-table-cell>
                        <uui-table-cell>
                            ${t.name === e.name ? s`<uui-tag look="secondary" color="default">Same</uui-tag>` : s`<uui-tag look="primary" color="warning">Changed</uui-tag>`}
                        </uui-table-cell>
                    </uui-table-row>
                    <uui-table-row>
                        <uui-table-cell><strong>File Size</strong></uui-table-cell>
                        <uui-table-cell>${this._formatSize(t.size)}</uui-table-cell>
                        <uui-table-cell>${this._formatSize(e.size)}</uui-table-cell>
                        <uui-table-cell>
                            <uui-tag look="secondary" color="${i === 0 ? "default" : i > 0 ? "warning" : "positive"}">
                                ${o}
                            </uui-tag>
                        </uui-table-cell>
                    </uui-table-row>
                    <uui-table-row>
                        <uui-table-cell><strong>Date</strong></uui-table-cell>
                        <uui-table-cell>${this._formatDate(t.date)}</uui-table-cell>
                        <uui-table-cell>${this._formatDate(e.lastModified)}</uui-table-cell>
                        <uui-table-cell></uui-table-cell>
                    </uui-table-row>
                    ${t.uploader ? s`
                        <uui-table-row>
                            <uui-table-cell><strong>Uploaded By</strong></uui-table-cell>
                            <uui-table-cell>${t.uploader.replace(/_/g, " ")}</uui-table-cell>
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
    const e = this._versions.reduce((l, c) => l + (c.size || 0), 0), t = this._versions.map((l) => new Date(l.date).getTime()).filter((l) => !isNaN(l)), i = t.length > 0 ? new Date(Math.min(...t)) : null, o = t.length > 0 ? new Date(Math.max(...t)) : null, a = new Set(this._versions.map((l) => l.uploader).filter(Boolean));
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
                    <span class="stats-strip-value">${i ? this._formatDate(i.toISOString()) : "—"}</span>
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
    const e = this._versions.length === 1, t = this._pagedVersions, i = (this._currentPage - 1) * this._pageSize, o = this._selectedSnapshots.size > 0;
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
                        <uui-table-head-cell>Version</uui-table-head-cell>
                        <uui-table-head-cell>Uploaded</uui-table-head-cell>
                        <uui-table-head-cell style="text-align: right;">Actions</uui-table-head-cell>
                    </uui-table-head>

                    ${t.map((a, l) => {
      const c = i + l, d = c === 0, h = this._selectedSnapshots.has(a.name);
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

                                <!-- Version: filename + status badge + note -->
                                <uui-table-cell>
                                    <div class="version-cell">
                                        <div class="version-cell-primary">
                                            ${this._isImage(a.name) ? s`
                                                    <button
                                                        class="filename-link"
                                                        @click="${() => this._openImagePreview(a)}"
                                                        title="Click to preview image">
                                                        <uui-icon name="icon-picture"></uui-icon>
                                                        ${a.name}
                                                    </button>
                                                ` : s`<span class="filename-text">${a.name}</span>`}
                                            ${this._renderStatus(a, c)}
                                        </div>
                                        <div class="version-cell-secondary">
                                            ${this._renderNoteCell(a)}
                                        </div>
                                    </div>
                                </uui-table-cell>

                                <!-- Uploaded: date + uploader stacked -->
                                <uui-table-cell>
                                    <div class="upload-cell">
                                        <span class="upload-date">${this._formatDate(a.date)}</span>
                                        <span class="upload-user">${a.uploader.replace(/_/g, " ")}</span>
                                    </div>
                                </uui-table-cell>

                                <!-- Actions: icon-only buttons -->
                                <uui-table-cell>
                                    <div class="actions-cell">
                                        <uui-button
                                            look="secondary"
                                            compact
                                            ?disabled="${d}"
                                            title="${d ? "This is the latest version" : "Compare with current file"}"
                                            @click="${() => this._openComparison(a)}">
                                            <uui-icon name="icon-split"></uui-icon>
                                        </uui-button>
                                        <uui-button
                                            look="secondary"
                                            compact
                                            href="${a.url}"
                                            target="_blank"
                                            title="Download this version">
                                            <uui-icon name="icon-download-alt"></uui-icon>
                                        </uui-button>
                                        <uui-button
                                            look="primary"
                                            color="positive"
                                            compact
                                            ?disabled="${e || this._isRestoring || d}"
                                            title="${e ? "Cannot restore when only one version exists" : d ? "This is already the latest version" : "Restore this version"}"
                                            @click="${() => this._restoreVersion(a)}">
                                            <uui-icon name="icon-refresh"></uui-icon>
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
  // --- Note operations ---
  /**
   * Enters inline edit mode for a snapshot's note
   */
  _startEditNote(e) {
    this._editingNoteName = e.name, this._editingNoteValue = e.note || "";
  }
  /**
   * Cancels note editing
   */
  _cancelEditNote() {
    this._editingNoteName = null, this._editingNoteValue = "";
  }
  /**
   * Saves the note to the snapshot's blob metadata
   */
  async _saveNote(e) {
    if (this._savingNote) return;
    this._savingNote = !0;
    const t = await this._authContext?.getLatestToken();
    if (!t) {
      this._notificationContext?.peek("danger", {
        data: { headline: "Authentication Error", message: "No authentication token available." }
      }), this._savingNote = !1;
      return;
    }
    try {
      const i = await fetch("/umbraco/management/api/v1/snapshot/update-note", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mediaKey: this._mediaKey,
          snapshotName: e.name,
          note: this._editingNoteValue
        })
      });
      if (i.ok)
        e.note = this._editingNoteValue.trim() || null, this._editingNoteName = null, this._editingNoteValue = "", this.requestUpdate();
      else {
        const o = await i.json();
        this._notificationContext?.peek("danger", {
          data: { headline: "Save Failed", message: o.detail || "Failed to save note" }
        });
      }
    } catch (i) {
      console.error("Failed to save note:", i), this._notificationContext?.peek("danger", {
        data: { headline: "Error", message: "An error occurred while saving the note." }
      });
    } finally {
      this._savingNote = !1;
    }
  }
  /**
   * Handles keydown in the note input — Enter saves, Escape cancels
   */
  _onNoteKeydown(e, t) {
    e.key === "Enter" ? (e.preventDefault(), this._saveNote(t)) : e.key === "Escape" && this._cancelEditNote();
  }
  /**
   * Renders the note cell for a snapshot row
   */
  _renderNoteCell(e) {
    return this._editingNoteName === e.name ? s`
                <div class="note-edit">
                    <input
                        type="text"
                        class="note-input"
                        maxlength="500"
                        placeholder="Add a note…"
                        .value="${this._editingNoteValue}"
                        @input="${(i) => this._editingNoteValue = i.target.value}"
                        @keydown="${(i) => this._onNoteKeydown(i, e)}"
                    />
                    <div class="note-edit-actions">
                        <uui-button
                            look="primary"
                            compact
                            ?disabled="${this._savingNote}"
                            @click="${() => this._saveNote(e)}">
                            <uui-icon name="icon-check"></uui-icon>
                        </uui-button>
                        <uui-button
                            look="secondary"
                            compact
                            @click="${this._cancelEditNote}">
                            <uui-icon name="icon-delete"></uui-icon>
                        </uui-button>
                    </div>
                </div>
            ` : e.note ? s`
                <button class="note-display" @click="${() => this._startEditNote(e)}" title="Click to edit note">
                    <uui-icon name="icon-edit"></uui-icon>
                    <span class="note-text">${e.note}</span>
                </button>
            ` : s`
            <button class="note-add" @click="${() => this._startEditNote(e)}" title="Add a note">
                <uui-icon name="icon-edit"></uui-icon> Add note
            </button>
        `;
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

        /* Note cell */
        .note-edit {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .note-input {
            flex: 1;
            padding: 4px 8px;
            border: 1px solid var(--uui-color-border);
            border-radius: var(--uui-border-radius);
            font: inherit;
            font-size: 0.85rem;
            min-width: 120px;
            background: var(--uui-color-surface);
            color: var(--uui-color-text);
        }

        .note-input:focus {
            outline: none;
            border-color: var(--uui-color-interactive);
            box-shadow: 0 0 0 1px var(--uui-color-interactive);
        }

        .note-edit-actions {
            display: flex;
            gap: 2px;
            flex-shrink: 0;
        }

        .note-display {
            background: none;
            border: none;
            cursor: pointer;
            padding: 2px 4px;
            font: inherit;
            font-size: 0.85rem;
            display: flex;
            align-items: center;
            gap: 4px;
            color: var(--uui-color-text);
            border-radius: var(--uui-border-radius);
            transition: background 0.2s;
            max-width: 200px;
        }

        .note-display:hover {
            background: var(--uui-color-surface-alt);
        }

        .note-display uui-icon {
            color: var(--uui-color-text-alt);
            font-size: 0.75rem;
            flex-shrink: 0;
            opacity: 0;
            transition: opacity 0.2s;
        }

        .note-display:hover uui-icon {
            opacity: 1;
        }

        .note-text {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .note-add {
            background: none;
            border: none;
            cursor: pointer;
            padding: 2px 4px;
            font: inherit;
            font-size: 0.8rem;
            color: var(--uui-color-text-alt);
            display: flex;
            align-items: center;
            gap: 4px;
            opacity: 0.5;
            transition: opacity 0.2s;
        }

        .note-add:hover {
            opacity: 1;
            color: var(--uui-color-interactive);
        }

        /* Version cell: stacked filename + note */
        .version-cell {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .version-cell-primary {
            display: flex;
            align-items: center;
            gap: var(--uui-size-space-2);
        }

        .version-cell-secondary {
            padding-left: 0;
        }

        .filename-text {
            font-weight: 500;
        }

        .status-badge {
            flex-shrink: 0;
            font-size: 0.7rem;
        }

        /* Upload cell: date + user stacked */
        .upload-cell {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .upload-date {
            font-size: 0.85rem;
        }

        .upload-user {
            font-size: 0.8rem;
            color: var(--uui-color-text-alt);
        }

        /* Actions cell: right-aligned icon buttons */
        .actions-cell {
            display: flex;
            gap: 4px;
            justify-content: flex-end;
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
r([
  u()
], n.prototype, "_versions", 2);
r([
  u()
], n.prototype, "_loading", 2);
r([
  u()
], n.prototype, "_mediaKey", 2);
r([
  u()
], n.prototype, "_previewImageUrl", 2);
r([
  u()
], n.prototype, "_previewImageName", 2);
r([
  u()
], n.prototype, "_showPreview", 2);
r([
  u()
], n.prototype, "_isRestoring", 2);
r([
  u()
], n.prototype, "_currentPage", 2);
r([
  u()
], n.prototype, "_showComparison", 2);
r([
  u()
], n.prototype, "_comparisonSnapshot", 2);
r([
  u()
], n.prototype, "_comparisonCurrent", 2);
r([
  u()
], n.prototype, "_comparisonLoading", 2);
r([
  u()
], n.prototype, "_comparisonMode", 2);
r([
  u()
], n.prototype, "_sliderPosition", 2);
r([
  u()
], n.prototype, "_selectedSnapshots", 2);
r([
  u()
], n.prototype, "_isDeleting", 2);
r([
  u()
], n.prototype, "_editingNoteName", 2);
r([
  u()
], n.prototype, "_editingNoteValue", 2);
r([
  u()
], n.prototype, "_savingNote", 2);
n = r([
  v("snapshot-viewer")
], n);
export {
  n as SnapshotViewerElement
};
//# sourceMappingURL=umbraco-media-snapshot.js.map
