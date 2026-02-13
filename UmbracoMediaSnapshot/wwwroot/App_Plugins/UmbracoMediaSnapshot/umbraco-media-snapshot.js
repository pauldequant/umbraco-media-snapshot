import { LitElement as h, html as s, css as m, state as l, customElement as g } from "@umbraco-cms/backoffice/external/lit";
import { UmbElementMixin as v } from "@umbraco-cms/backoffice/element-api";
import { UMB_WORKSPACE_CONTEXT as f } from "@umbraco-cms/backoffice/workspace";
import { UMB_AUTH_CONTEXT as _ } from "@umbraco-cms/backoffice/auth";
import { UMB_NOTIFICATION_CONTEXT as b } from "@umbraco-cms/backoffice/notification";
import { UMB_MODAL_MANAGER_CONTEXT as w, UMB_CONFIRM_MODAL as d } from "@umbraco-cms/backoffice/modal";
var y = Object.defineProperty, x = Object.getOwnPropertyDescriptor, r = (e, i, a, t) => {
  for (var o = t > 1 ? void 0 : t ? x(i, a) : i, u = e.length - 1, c; u >= 0; u--)
    (c = e[u]) && (o = (t ? c(i, a, o) : c(o)) || o);
  return t && o && y(i, a, o), o;
};
let n = class extends v(h) {
  constructor() {
    super(), this._versions = [], this._loading = !0, this._mediaKey = "", this._previewImageUrl = null, this._previewImageName = "", this._showPreview = !1, this._isRestoring = !1, this._currentPage = 1, this._showComparison = !1, this._comparisonSnapshot = null, this._comparisonCurrent = null, this._comparisonLoading = !1, this._comparisonMode = "side-by-side", this._sliderPosition = 50, this._selectedSnapshots = /* @__PURE__ */ new Set(), this._isDeleting = !1, this._editingNoteName = null, this._editingNoteValue = "", this._savingNote = !1, this._totalCount = 0, this._totalPages = 1, this._totalSizeBytes = 0, this._oldestDate = null, this._newestDate = null, this._uniqueUploaderCount = 0, this._togglingPin = null, this._pageSize = 10, this.consumeContext(_, (e) => {
      this._authContext = e;
    }), this.consumeContext(b, (e) => {
      this._notificationContext = e;
    }), this.consumeContext(w, (e) => {
      this._modalManagerContext = e;
    }), this.consumeContext(f, (e) => {
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
      const a = `/umbraco/management/api/v1/snapshot/versions/${e}?page=${this._currentPage}&pageSize=${this._pageSize}`, t = await fetch(a, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${i}`,
          "Content-Type": "application/json"
        }
      });
      if (t.ok) {
        const o = await t.json();
        this._versions = o.items, this._totalCount = o.totalCount, this._totalPages = o.totalPages, this._totalSizeBytes = o.totalSizeBytes, this._oldestDate = o.oldestDate, this._newestDate = o.newestDate, this._uniqueUploaderCount = o.uniqueUploaderCount, this._selectedSnapshots = /* @__PURE__ */ new Set();
      } else t.status === 401 && (console.error("Unauthorized: The session may have expired."), this._notificationContext?.peek("danger", {
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
   * Handles page change from the pagination component
   */
  _onPageChange(e) {
    const i = e.target;
    this._currentPage = i.current, this._fetchVersions(this._mediaKey);
  }
  /**
   * Determines the previewable file type from a filename
   */
  _getFileType(e) {
    const i = e.substring(e.lastIndexOf(".")).toLowerCase();
    return [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"].includes(i) ? "image" : i === ".svg" ? "svg" : i === ".pdf" ? "pdf" : [".mp4", ".webm", ".ogg", ".mov"].includes(i) ? "video" : [".mp3", ".wav", ".ogg", ".aac", ".flac", ".m4a"].includes(i) ? "audio" : null;
  }
  /**
   * Checks if a filename is an image (including SVG) for comparison support
   */
  _isImage(e) {
    const i = this._getFileType(e);
    return i === "image" || i === "svg";
  }
  /**
   * Whether a file can be previewed in the side panel
   */
  _isPreviewable(e) {
    return this._getFileType(e) !== null;
  }
  /**
   * Returns the appropriate icon name for a file type
   */
  _getFileIcon(e) {
    switch (this._getFileType(e)) {
      case "image":
      case "svg":
        return "icon-picture";
      case "video":
        return "icon-video";
      case "audio":
        return "icon-sound-waves";
      case "pdf":
        return "icon-document";
      default:
        return "icon-document";
    }
  }
  /**
   * Opens the preview panel for any supported file type
   */
  _openPreview(e) {
    this._isPreviewable(e.name) && (this._previewImageUrl = e.url, this._previewImageName = e.name, this._showPreview = !0);
  }
  /**
   * Closes the preview panel
   */
  _closePreview() {
    this._showPreview = !1, this._previewImageUrl = null, this._previewImageName = "";
  }
  /**
   * Returns the panel header title based on the current preview file type
   */
  _getPreviewTitle() {
    switch (this._getFileType(this._previewImageName)) {
      case "image":
      case "svg":
        return "Image Preview";
      case "video":
        return "Video Preview";
      case "audio":
        return "Audio Preview";
      case "pdf":
        return "PDF Preview";
      default:
        return "File Preview";
    }
  }
  /**
   * Renders the appropriate preview element based on file type
   */
  _renderPreviewContent() {
    if (!this._previewImageUrl)
      return s`<uui-loader></uui-loader>`;
    switch (this._getFileType(this._previewImageName)) {
      case "image":
      case "svg":
        return s`
                    <img
                        src="${this._previewImageUrl}"
                        alt="${this._previewImageName}"
                        @error="${() => {
          this._notificationContext?.peek("warning", {
            data: { headline: "Preview Error", message: "Unable to load image preview" }
          });
        }}"
                    />
                `;
      case "video":
        return s`
                    <video
                        controls
                        preload="metadata"
                        class="preview-video"
                        @error="${() => {
          this._notificationContext?.peek("warning", {
            data: { headline: "Preview Error", message: "Unable to load video preview" }
          });
        }}">
                        <source src="${this._previewImageUrl}" />
                        Your browser does not support video playback.
                    </video>
                `;
      case "audio":
        return s`
                    <div class="preview-audio-wrapper">
                        <uui-icon name="icon-sound-waves" class="preview-audio-icon"></uui-icon>
                        <audio
                            controls
                            preload="metadata"
                            class="preview-audio"
                            @error="${() => {
          this._notificationContext?.peek("warning", {
            data: { headline: "Preview Error", message: "Unable to load audio preview" }
          });
        }}">
                            <source src="${this._previewImageUrl}" />
                            Your browser does not support audio playback.
                        </audio>
                    </div>
                `;
      case "pdf":
        return s`
                    <iframe
                        src="${this._previewImageUrl}"
                        class="preview-pdf"
                        title="PDF Preview: ${this._previewImageName}"
                        @error="${() => {
          this._notificationContext?.peek("warning", {
            data: { headline: "Preview Error", message: "Unable to load PDF preview" }
          });
        }}">
                    </iframe>
                `;
      default:
        return s`
                    <div class="preview-unsupported">
                        <uui-icon name="icon-document"></uui-icon>
                        <p>Preview not available for this file type.</p>
                    </div>
                `;
    }
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
    const e = (this._currentPage - 1) * this._pageSize, i = this._versions.filter((o, u) => e + u !== 0).map((o) => o.name), a = i.every((o) => this._selectedSnapshots.has(o)), t = new Set(this._selectedSnapshots);
    a ? i.forEach((o) => t.delete(o)) : i.forEach((o) => t.add(o)), this._selectedSnapshots = t;
  }
  /**
   * Whether all selectable items on the current page are selected
   */
  get _allPageSelected() {
    const e = (this._currentPage - 1) * this._pageSize, i = this._versions.filter((a, t) => e + t !== 0);
    return i.length > 0 && i.every((a) => this._selectedSnapshots.has(a.name));
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
    const i = this._modalManagerContext.open(this, d, {
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
    const a = await this._authContext?.getLatestToken();
    if (!a) {
      this._notificationContext?.peek("danger", {
        data: { headline: "Authentication Error", message: "No authentication token available." }
      }), this._isDeleting = !1;
      return;
    }
    try {
      const t = await fetch("/umbraco/management/api/v1/snapshot/delete", {
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
      if (t.ok) {
        const o = await t.json();
        this._notificationContext?.peek("positive", {
          data: { headline: "Snapshot Deleted", message: o.message }
        }), await this._fetchVersions(this._mediaKey);
      } else if (t.status === 401)
        this._notificationContext?.peek("danger", {
          data: { headline: "Unauthorized", message: "Your session may have expired. Please refresh the page." }
        });
      else {
        const o = await t.json();
        this._notificationContext?.peek("danger", {
          data: { headline: "Delete Failed", message: o.detail || "Unknown error" }
        });
      }
    } catch (t) {
      console.error("Failed to delete snapshot:", t), this._notificationContext?.peek("danger", {
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
    const e = this._selectedSnapshots.size, i = this._modalManagerContext.open(this, d, {
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
    const a = await this._authContext?.getLatestToken();
    if (!a) {
      this._notificationContext?.peek("danger", {
        data: { headline: "Authentication Error", message: "No authentication token available." }
      }), this._isDeleting = !1;
      return;
    }
    try {
      const t = await fetch("/umbraco/management/api/v1/snapshot/delete-bulk", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${a}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mediaKey: this._mediaKey,
          snapshotNames: Array.from(this._selectedSnapshots)
        })
      });
      if (t.ok) {
        const o = await t.json();
        this._notificationContext?.peek("positive", {
          data: { headline: "Snapshots Deleted", message: o.message }
        }), await this._fetchVersions(this._mediaKey);
      } else if (t.status === 401)
        this._notificationContext?.peek("danger", {
          data: { headline: "Unauthorized", message: "Your session may have expired. Please refresh the page." }
        });
      else {
        const o = await t.json();
        this._notificationContext?.peek("danger", {
          data: { headline: "Bulk Delete Failed", message: o.detail || "Unknown error" }
        });
      }
    } catch (t) {
      console.error("Failed to bulk delete snapshots:", t), this._notificationContext?.peek("danger", {
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
    const i = this._modalManagerContext.open(this, d, {
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
    const a = await this._authContext?.getLatestToken();
    if (!a) {
      this._notificationContext?.peek("danger", {
        data: { headline: "Authentication Error", message: "No authentication token available." }
      }), this._isRestoring = !1;
      return;
    }
    try {
      const o = await fetch("/umbraco/management/api/v1/snapshot/restore", {
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
      if (o.ok) {
        const u = await o.json();
        this._notificationContext?.peek("positive", {
          data: {
            headline: "Snapshot Restored",
            message: u.message
          }
        }), await this._fetchVersions(this._mediaKey);
      } else if (o.status === 409)
        this._notificationContext?.peek("warning", {
          data: {
            headline: "Restore in Progress",
            message: "Another restore is already running for this media item. Please wait and try again."
          }
        });
      else if (o.status === 401)
        this._notificationContext?.peek("danger", {
          data: {
            headline: "Unauthorized",
            message: "Your session may have expired. Please refresh the page."
          }
        });
      else {
        const u = await o.json();
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
   * Renders a compact inline status badge for a snapshot version
   */
  _renderStatus(e, i) {
    const a = [];
    return e.isPinned && a.push(s`<uui-tag class="status-badge" look="primary" color="warning">Pinned</uui-tag>`), e.isRestored && a.push(s`<uui-tag class="status-badge" look="primary" color="positive">Restored</uui-tag>`), i === 0 && a.push(s`<uui-tag class="status-badge" look="primary" color="default">Latest</uui-tag>`), a;
  }
  /**
   * Renders the comparison panel content
   */
  _renderComparison() {
    if (!this._showComparison) return "";
    const e = this._comparisonSnapshot, i = this._comparisonCurrent, a = e && i && this._isImage(e.name) && this._isImage(i.name);
    return s`
            <div class="preview-overlay" @click="${this._closeComparison}"></div>
            <div class="comparison-panel">
                <div class="preview-header">
                    <h3>
                        <uui-icon name="icon-split"></uui-icon>
                        Compare Versions
                    </h3>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${a ? s`
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
                    ${this._comparisonLoading ? s`<div class="loader"><uui-loader></uui-loader> Loading current file...</div>` : i ? a ? this._renderImageComparison(i, e) : this._renderMetadataComparison(i, e) : s`<uui-box><p>Unable to load the current media file for comparison.</p></uui-box>`}
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
    const a = e.size - i.size, t = a > 0 ? `+${this._formatSize(a)}` : a < 0 ? `-${this._formatSize(Math.abs(a))}` : "No change";
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
    return this._totalCount === 0 ? "" : s`
            <div class="stats-strip">
                <div class="stats-strip-item">
                    <uui-icon name="icon-documents"></uui-icon>
                    <span class="stats-strip-value">${this._totalCount}</span>
                    <span class="stats-strip-label">Snapshot${this._totalCount !== 1 ? "s" : ""}</span>
                </div>
                <div class="stats-strip-divider"></div>
                <div class="stats-strip-item">
                    <uui-icon name="icon-server"></uui-icon>
                    <span class="stats-strip-value">${this._formatSize(this._totalSizeBytes)}</span>
                    <span class="stats-strip-label">Total Size</span>
                </div>
                <div class="stats-strip-divider"></div>
                <div class="stats-strip-item">
                    <uui-icon name="icon-calendar"></uui-icon>
                    <span class="stats-strip-value">${this._oldestDate ? this._formatDate(this._oldestDate) : "—"}</span>
                    <span class="stats-strip-label">Oldest</span>
                </div>
                <div class="stats-strip-divider"></div>
                <div class="stats-strip-item">
                    <uui-icon name="icon-calendar"></uui-icon>
                    <span class="stats-strip-value">${this._newestDate ? this._formatDate(this._newestDate) : "—"}</span>
                    <span class="stats-strip-label">Latest</span>
                </div>
                <div class="stats-strip-divider"></div>
                <div class="stats-strip-item">
                    <uui-icon name="icon-users"></uui-icon>
                    <span class="stats-strip-value">${this._uniqueUploaderCount}</span>
                    <span class="stats-strip-label">Contributor${this._uniqueUploaderCount !== 1 ? "s" : ""}</span>
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
    const e = this._versions.length === 1 && this._totalCount === 1, i = (this._currentPage - 1) * this._pageSize, a = this._selectedSnapshots.size > 0;
    return s`
            <div class="snapshot-container">

                <!-- Summary stats for this media item -->
                ${this._renderStats()}

                <!-- Bulk action toolbar -->
                ${a ? s`
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

                    ${this._versions.map((t, o) => {
      const u = i + o, c = u === 0, p = this._selectedSnapshots.has(t.name);
      return s`
                            <uui-table-row class="${p ? "row-selected" : ""}">
                                <uui-table-cell style="width: 40px;">
                                    <input
                                        type="checkbox"
                                        .checked="${p}"
                                        ?disabled="${c}"
                                        @change="${() => this._toggleSelection(t.name)}"
                                        title="${c ? "Cannot select the latest version" : "Select this snapshot"}"
                                        class="select-checkbox"
                                    />
                                </uui-table-cell>

                                <!-- Version: filename + status badge + note -->
                                <uui-table-cell>
                                    <div class="version-cell">
                                        <div class="version-cell-primary">
                                            ${this._isPreviewable(t.name) ? s`
                                                    <button
                                                        class="filename-link"
                                                        @click="${() => this._openPreview(t)}"
                                                        title="Click to preview">
                                                        <uui-icon name="${this._getFileIcon(t.name)}"></uui-icon>
                                                        ${t.name}
                                                    </button>
                                                ` : s`<span class="filename-text"><uui-icon name="icon-document"></uui-icon> ${t.name}</span>`}
                                            ${this._renderStatus(t, u)}
                                        </div>
                                        <div class="version-cell-secondary">
                                            ${this._renderNoteCell(t)}
                                        </div>
                                    </div>
                                </uui-table-cell>

                                <!-- Uploaded: date + uploader stacked -->
                                <uui-table-cell>
                                    <div class="upload-cell">
                                        <span class="upload-date">${this._formatDate(t.date)}</span>
                                        <span class="upload-user">${t.uploader.replace(/_/g, " ")}</span>
                                    </div>
                                </uui-table-cell>

                                <!-- Actions: icon-only buttons -->
                                <uui-table-cell>
                                    <div class="actions-cell">
                                        <uui-button
                                            look="secondary"
                                            compact
                                            ?disabled="${c}"
                                            title="${c ? "This is the latest version" : "Compare with current file"}"
                                            @click="${() => this._openComparison(t)}">
                                            <uui-icon name="icon-split"></uui-icon>
                                        </uui-button>
                                        <uui-button
                                            look="secondary"
                                            compact
                                            href="${t.url}"
                                            target="_blank"
                                            title="Download this version">
                                            <uui-icon name="icon-download-alt"></uui-icon>
                                        </uui-button>
                                        <uui-button
                                            look="${t.isPinned ? "primary" : "secondary"}"
                                            color="${t.isPinned ? "warning" : "default"}"
                                            compact
                                            ?disabled="${this._togglingPin === t.name}"
                                            title="${t.isPinned ? "Unpin — allow automatic cleanup" : "Pin — protect from automatic cleanup"}"
                                            @click="${() => this._togglePin(t)}">
                                            <uui-icon name="icon-pin-location"></uui-icon>
                                        </uui-button>
                                        <uui-button
                                            look="primary"
                                            color="positive"
                                            compact
                                            ?disabled="${e || this._isRestoring || c}"
                                            title="${e ? "Cannot restore when only one version exists" : c ? "This is already the latest version" : "Restore this version"}"
                                            @click="${() => this._restoreVersion(t)}">
                                            <uui-icon name="icon-refresh"></uui-icon>
                                        </uui-button>
                                        <uui-button
                                            look="secondary"
                                            color="danger"
                                            compact
                                            ?disabled="${c || this._isDeleting || t.isPinned}"
                                            title="${t.isPinned ? "Unpin before deleting" : c ? "Cannot delete the latest version" : "Delete this snapshot"}"
                                            @click="${() => this._deleteSnapshot(t)}">
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

                <!-- File Preview Side Panel -->
                ${this._showPreview ? s`
                    <div class="preview-overlay" @click="${this._closePreview}"></div>
                    <div class="preview-panel">
                        <div class="preview-header">
                            <h3>
                                <uui-icon name="${this._getFileIcon(this._previewImageName)}"></uui-icon>
                                ${this._getPreviewTitle()}
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
                            <div class="preview-media-container">
                                ${this._renderPreviewContent()}
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
    const i = await this._authContext?.getLatestToken();
    if (!i) {
      this._notificationContext?.peek("danger", {
        data: { headline: "Authentication Error", message: "No authentication token available." }
      }), this._savingNote = !1;
      return;
    }
    try {
      const a = await fetch("/umbraco/management/api/v1/snapshot/update-note", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${i}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mediaKey: this._mediaKey,
          snapshotName: e.name,
          note: this._editingNoteValue
        })
      });
      if (a.ok)
        e.note = this._editingNoteValue.trim() || null, this._editingNoteName = null, this._editingNoteValue = "", this.requestUpdate();
      else {
        const t = await a.json();
        this._notificationContext?.peek("danger", {
          data: { headline: "Save Failed", message: t.detail || "Failed to save note" }
        });
      }
    } catch (a) {
      console.error("Failed to save note:", a), this._notificationContext?.peek("danger", {
        data: { headline: "Error", message: "An error occurred while saving the note." }
      });
    } finally {
      this._savingNote = !1;
    }
  }
  /**
   * Handles keydown in the note input — Enter saves, Escape cancels
   */
  _onNoteKeydown(e, i) {
    e.key === "Enter" ? (e.preventDefault(), this._saveNote(i)) : e.key === "Escape" && this._cancelEditNote();
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
                        @input="${(a) => this._editingNoteValue = a.target.value}"
                        @keydown="${(a) => this._onNoteKeydown(a, e)}"
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
  // --- Pin operations ---
  /**
   * Toggles the pinned state of a snapshot
   */
  async _togglePin(e) {
    if (this._togglingPin) return;
    this._togglingPin = e.name;
    const i = await this._authContext?.getLatestToken();
    if (!i) {
      this._notificationContext?.peek("danger", {
        data: { headline: "Authentication Error", message: "No authentication token available." }
      }), this._togglingPin = null;
      return;
    }
    try {
      const a = await fetch("/umbraco/management/api/v1/snapshot/toggle-pin", {
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
        const t = await a.json();
        e.isPinned = t.isPinned, this.requestUpdate(), this._notificationContext?.peek("positive", {
          data: { headline: t.isPinned ? "Snapshot Pinned" : "Snapshot Unpinned", message: t.message }
        });
      } else {
        const t = await a.json();
        this._notificationContext?.peek("danger", {
          data: { headline: "Pin Failed", message: t.detail || "Failed to update pin state" }
        });
      }
    } catch (a) {
      console.error("Failed to toggle pin:", a), this._notificationContext?.peek("danger", {
        data: { headline: "Error", message: "An error occurred while updating the pin state." }
      });
    } finally {
      this._togglingPin = null;
    }
  }
};
n.styles = m`
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

        /* Preview media container — shared wrapper for all file types */
        .preview-media-container {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--uui-color-surface-alt);
            border-radius: var(--uui-border-radius);
            padding: var(--uui-size-space-4);
            min-height: 200px;
            overflow: hidden;
        }

        .preview-media-container img {
            max-width: 100%;
            max-height: 60vh;
            object-fit: contain;
            border-radius: var(--uui-border-radius);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        /* Video preview */
        .preview-video {
            max-width: 100%;
            max-height: 60vh;
            border-radius: var(--uui-border-radius);
            background: #000;
        }

        /* Audio preview */
        .preview-audio-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: var(--uui-size-space-5);
            padding: var(--uui-size-space-6);
            width: 100%;
        }

        .preview-audio-icon {
            font-size: 4rem;
            color: var(--uui-color-primary);
            opacity: 0.6;
        }

        .preview-audio {
            width: 100%;
            max-width: 400px;
        }

        /* PDF preview */
        .preview-pdf {
            width: 100%;
            height: 60vh;
            border: none;
            border-radius: var(--uui-border-radius);
        }

        /* Unsupported file type */
        .preview-unsupported {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: var(--uui-size-space-3);
            padding: var(--uui-size-space-6);
            color: var(--uui-color-text-alt);
        }

        .preview-unsupported uui-icon {
            font-size: 3rem;
            opacity: 0.4;
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
  l()
], n.prototype, "_versions", 2);
r([
  l()
], n.prototype, "_loading", 2);
r([
  l()
], n.prototype, "_mediaKey", 2);
r([
  l()
], n.prototype, "_previewImageUrl", 2);
r([
  l()
], n.prototype, "_previewImageName", 2);
r([
  l()
], n.prototype, "_showPreview", 2);
r([
  l()
], n.prototype, "_isRestoring", 2);
r([
  l()
], n.prototype, "_currentPage", 2);
r([
  l()
], n.prototype, "_showComparison", 2);
r([
  l()
], n.prototype, "_comparisonSnapshot", 2);
r([
  l()
], n.prototype, "_comparisonCurrent", 2);
r([
  l()
], n.prototype, "_comparisonLoading", 2);
r([
  l()
], n.prototype, "_comparisonMode", 2);
r([
  l()
], n.prototype, "_sliderPosition", 2);
r([
  l()
], n.prototype, "_selectedSnapshots", 2);
r([
  l()
], n.prototype, "_isDeleting", 2);
r([
  l()
], n.prototype, "_editingNoteName", 2);
r([
  l()
], n.prototype, "_editingNoteValue", 2);
r([
  l()
], n.prototype, "_savingNote", 2);
r([
  l()
], n.prototype, "_totalCount", 2);
r([
  l()
], n.prototype, "_totalPages", 2);
r([
  l()
], n.prototype, "_totalSizeBytes", 2);
r([
  l()
], n.prototype, "_oldestDate", 2);
r([
  l()
], n.prototype, "_newestDate", 2);
r([
  l()
], n.prototype, "_uniqueUploaderCount", 2);
r([
  l()
], n.prototype, "_togglingPin", 2);
n = r([
  g("snapshot-viewer")
], n);
export {
  n as SnapshotViewerElement
};
//# sourceMappingURL=umbraco-media-snapshot.js.map
