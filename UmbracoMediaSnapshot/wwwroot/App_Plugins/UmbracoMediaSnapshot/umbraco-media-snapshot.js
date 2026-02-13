import { LitElement as x, html as l, css as w, state as d, customElement as y } from "@umbraco-cms/backoffice/external/lit";
import { UmbElementMixin as $ } from "@umbraco-cms/backoffice/element-api";
import { UmbLocalizationController as k } from "@umbraco-cms/backoffice/localization-api";
import { UMB_WORKSPACE_CONTEXT as z } from "@umbraco-cms/backoffice/workspace";
import { UMB_AUTH_CONTEXT as C } from "@umbraco-cms/backoffice/auth";
import { UMB_NOTIFICATION_CONTEXT as S } from "@umbraco-cms/backoffice/notification";
import { UMB_MODAL_MANAGER_CONTEXT as P, UMB_CONFIRM_MODAL as g } from "@umbraco-cms/backoffice/modal";
var N = Object.defineProperty, T = Object.getOwnPropertyDescriptor, b = (a) => {
  throw TypeError(a);
}, u = (a, s, o, r) => {
  for (var n = r > 1 ? void 0 : r ? T(s, o) : s, h = a.length - 1, p; h >= 0; h--)
    (p = a[h]) && (n = (r ? p(s, o, n) : p(n)) || n);
  return r && n && N(s, o, n), n;
}, _ = (a, s, o) => s.has(a) || b("Cannot " + o), D = (a, s, o) => (_(a, s, "read from private field"), o ? o.call(a) : s.get(a)), f = (a, s, o) => s.has(a) ? b("Cannot add the same private member more than once") : s instanceof WeakSet ? s.add(a) : s.set(a, o), t = (a, s, o) => (_(a, s, "access private method"), o), m, e, i;
let c = class extends $(x) {
  constructor() {
    super(), f(this, e), f(this, m, new k(this)), this._versions = [], this._loading = !0, this._mediaKey = "", this._previewImageUrl = null, this._previewImageName = "", this._showPreview = !1, this._isRestoring = !1, this._currentPage = 1, this._showComparison = !1, this._comparisonSnapshot = null, this._comparisonCurrent = null, this._comparisonLoading = !1, this._comparisonMode = "side-by-side", this._sliderPosition = 50, this._selectedSnapshots = /* @__PURE__ */ new Set(), this._isDeleting = !1, this._editingNoteName = null, this._editingNoteValue = "", this._savingNote = !1, this._totalCount = 0, this._totalPages = 1, this._totalSizeBytes = 0, this._oldestDate = null, this._newestDate = null, this._uniqueUploaderCount = 0, this._togglingPin = null, this._pageSize = 10, this.consumeContext(C, (a) => {
      this._authContext = a;
    }), this.consumeContext(S, (a) => {
      this._notificationContext = a;
    }), this.consumeContext(P, (a) => {
      this._modalManagerContext = a;
    }), this.consumeContext(z, (a) => {
      const s = a;
      s.unique && this.observe(s.unique, (o) => {
        o && o !== this._mediaKey && (this._mediaKey = o.toString(), this._currentPage = 1, this._fetchVersions(this._mediaKey));
      });
    });
  }
  /**
   * Calls the C# Management API to get the list of blobs
   * Umbraco 17 automatically injects Auth Bearer tokens into fetch 
   * requests starting with /umbraco/management/api/
   */
  async _fetchVersions(a) {
    this._loading = !0;
    const s = await this._authContext?.getLatestToken();
    if (!s) {
      console.error("No authentication token available."), this._notificationContext?.peek("danger", {
        data: { headline: t(this, e, i).call(this, "authError"), message: t(this, e, i).call(this, "noAuthToken") }
      }), this._loading = !1;
      return;
    }
    try {
      const o = `/umbraco/management/api/v1/snapshot/versions/${a}?page=${this._currentPage}&pageSize=${this._pageSize}`, r = await fetch(o, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${s}`,
          "Content-Type": "application/json"
        }
      });
      if (r.ok) {
        const n = await r.json();
        this._versions = n.items, this._totalCount = n.totalCount, this._totalPages = n.totalPages, this._totalSizeBytes = n.totalSizeBytes, this._oldestDate = n.oldestDate, this._newestDate = n.newestDate, this._uniqueUploaderCount = n.uniqueUploaderCount, this._selectedSnapshots = /* @__PURE__ */ new Set();
      } else r.status === 401 && (console.error("Unauthorized: The session may have expired."), this._notificationContext?.peek("danger", {
        data: { headline: t(this, e, i).call(this, "unauthorized"), message: t(this, e, i).call(this, "sessionExpired") }
      }));
    } catch (o) {
      console.error("Failed to fetch snapshots:", o), this._notificationContext?.peek("danger", {
        data: { headline: t(this, e, i).call(this, "error"), message: t(this, e, i).call(this, "failedToFetchSnapshots") }
      });
    } finally {
      this._loading = !1;
    }
  }
  /**
   * Fetches the current (live) media file metadata and SAS URL
   */
  async _fetchCurrentMedia() {
    const a = await this._authContext?.getLatestToken();
    if (!a) return null;
    try {
      const s = `/umbraco/management/api/v1/snapshot/current/${this._mediaKey}`, o = await fetch(s, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${a}`,
          "Content-Type": "application/json"
        }
      });
      if (o.ok)
        return await o.json();
    } catch (s) {
      console.error("Failed to fetch current media:", s);
    }
    return null;
  }
  /**
   * Opens the comparison panel for a specific snapshot version
   */
  async _openComparison(a) {
    this._comparisonLoading = !0, this._comparisonSnapshot = a, this._showComparison = !0, this._sliderPosition = 50;
    const s = await this._fetchCurrentMedia();
    this._comparisonCurrent = s, this._comparisonLoading = !1;
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
  _onSliderInput(a) {
    const s = a.target;
    this._sliderPosition = parseInt(s.value, 10);
  }
  /**
   * Handles page change from the pagination component
   */
  _onPageChange(a) {
    const s = a.target;
    this._currentPage = s.current, this._fetchVersions(this._mediaKey);
  }
  /**
   * Determines the previewable file type from a filename
   */
  _getFileType(a) {
    const s = a.substring(a.lastIndexOf(".")).toLowerCase();
    return [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"].includes(s) ? "image" : s === ".svg" ? "svg" : s === ".pdf" ? "pdf" : [".mp4", ".webm", ".ogg", ".mov"].includes(s) ? "video" : [".mp3", ".wav", ".ogg", ".aac", ".flac", ".m4a"].includes(s) ? "audio" : null;
  }
  /**
   * Checks if a filename is an image (including SVG) for comparison support
   */
  _isImage(a) {
    const s = this._getFileType(a);
    return s === "image" || s === "svg";
  }
  /**
   * Whether a file can be previewed in the side panel
   */
  _isPreviewable(a) {
    return this._getFileType(a) !== null;
  }
  /**
   * Returns the appropriate icon name for a file type
   */
  _getFileIcon(a) {
    switch (this._getFileType(a)) {
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
  _openPreview(a) {
    this._isPreviewable(a.name) && (this._previewImageUrl = a.url, this._previewImageName = a.name, this._showPreview = !0);
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
        return t(this, e, i).call(this, "imagePreview");
      case "video":
        return t(this, e, i).call(this, "videoPreview");
      case "audio":
        return t(this, e, i).call(this, "audioPreview");
      case "pdf":
        return t(this, e, i).call(this, "pdfPreview");
      default:
        return t(this, e, i).call(this, "filePreview");
    }
  }
  /**
   * Renders the appropriate preview element based on file type
   */
  _renderPreviewContent() {
    if (!this._previewImageUrl)
      return l`<uui-loader></uui-loader>`;
    switch (this._getFileType(this._previewImageName)) {
      case "image":
      case "svg":
        return l`
                    <img
                        src="${this._previewImageUrl}"
                        alt="${this._previewImageName}"
                        @error="${() => {
          this._notificationContext?.peek("warning", {
            data: { headline: t(this, e, i).call(this, "previewError"), message: t(this, e, i).call(this, "unableToLoadImagePreview") }
          });
        }}"
                    />
                `;
      case "video":
        return l`
                    <video
                        controls
                        preload="metadata"
                        class="preview-video"
                        @error="${() => {
          this._notificationContext?.peek("warning", {
            data: { headline: t(this, e, i).call(this, "previewError"), message: t(this, e, i).call(this, "unableToLoadVideoPreview") }
          });
        }}">
                        <source src="${this._previewImageUrl}" />
                        ${t(this, e, i).call(this, "videoNotSupported")}
                    </video>
                `;
      case "audio":
        return l`
                    <div class="preview-audio-wrapper">
                        <uui-icon name="icon-sound-waves" class="preview-audio-icon"></uui-icon>
                        <audio
                            controls
                            preload="metadata"
                            class="preview-audio"
                            @error="${() => {
          this._notificationContext?.peek("warning", {
            data: { headline: t(this, e, i).call(this, "previewError"), message: t(this, e, i).call(this, "unableToLoadAudioPreview") }
          });
        }}">
                            <source src="${this._previewImageUrl}" />
                            ${t(this, e, i).call(this, "audioNotSupported")}
                        </audio>
                    </div>
                `;
      case "pdf":
        return l`
                    <iframe
                        src="${this._previewImageUrl}"
                        class="preview-pdf"
                        title="${t(this, e, i).call(this, "pdfPreview")}: ${this._previewImageName}"
                        @error="${() => {
          this._notificationContext?.peek("warning", {
            data: { headline: t(this, e, i).call(this, "previewError"), message: t(this, e, i).call(this, "unableToLoadPdfPreview") }
          });
        }}">
                    </iframe>
                `;
      default:
        return l`
                    <div class="preview-unsupported">
                        <uui-icon name="icon-document"></uui-icon>
                        <p>${t(this, e, i).call(this, "previewNotAvailable")}</p>
                    </div>
                `;
    }
  }
  // --- Selection helpers ---
  /**
   * Toggles a single snapshot's selection state
   */
  _toggleSelection(a) {
    const s = new Set(this._selectedSnapshots);
    s.has(a) ? s.delete(a) : s.add(a), this._selectedSnapshots = s;
  }
  /**
   * Toggles select-all for the current page (excluding the latest version at index 0)
   */
  _toggleSelectAll() {
    const a = (this._currentPage - 1) * this._pageSize, s = this._versions.filter((n, h) => a + h !== 0).map((n) => n.name), o = s.every((n) => this._selectedSnapshots.has(n)), r = new Set(this._selectedSnapshots);
    o ? s.forEach((n) => r.delete(n)) : s.forEach((n) => r.add(n)), this._selectedSnapshots = r;
  }
  /**
   * Whether all selectable items on the current page are selected
   */
  get _allPageSelected() {
    const a = (this._currentPage - 1) * this._pageSize, s = this._versions.filter((o, r) => a + r !== 0);
    return s.length > 0 && s.every((o) => this._selectedSnapshots.has(o.name));
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
  async _deleteSnapshot(a) {
    if (this._isDeleting) return;
    if (!this._modalManagerContext) {
      console.error("Modal manager context not available");
      return;
    }
    const s = this._modalManagerContext.open(this, g, {
      data: {
        headline: t(this, e, i).call(this, "deleteSnapshotHeadline"),
        content: l`
                    <p>${t(this, e, i).call(this, "areYouSureDelete")} <strong>"${a.name}"</strong>?</p>
                    <uui-box>
                        <p style="margin: 0;">
                            <uui-icon name="icon-alert"></uui-icon>
                            <strong>${t(this, e, i).call(this, "warning")}:</strong> ${t(this, e, i).call(this, "deleteWarning")}
                        </p>
                    </uui-box>
                `,
        color: "danger",
        confirmLabel: t(this, e, i).call(this, "delete")
      }
    });
    try {
      await s.onSubmit();
    } catch {
      return;
    }
    this._isDeleting = !0;
    const o = await this._authContext?.getLatestToken();
    if (!o) {
      this._notificationContext?.peek("danger", {
        data: { headline: t(this, e, i).call(this, "authError"), message: t(this, e, i).call(this, "noAuthToken") }
      }), this._isDeleting = !1;
      return;
    }
    try {
      const r = await fetch("/umbraco/management/api/v1/snapshot/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${o}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mediaKey: this._mediaKey,
          snapshotName: a.name
        })
      });
      if (r.ok) {
        const n = await r.json();
        this._notificationContext?.peek("positive", {
          data: { headline: t(this, e, i).call(this, "snapshotDeleted"), message: n.message }
        }), await this._fetchVersions(this._mediaKey);
      } else if (r.status === 401)
        this._notificationContext?.peek("danger", {
          data: { headline: t(this, e, i).call(this, "unauthorized"), message: t(this, e, i).call(this, "sessionExpired") }
        });
      else {
        const n = await r.json();
        this._notificationContext?.peek("danger", {
          data: { headline: t(this, e, i).call(this, "deleteFailed"), message: n.detail || t(this, e, i).call(this, "unknownError") }
        });
      }
    } catch (r) {
      console.error("Failed to delete snapshot:", r), this._notificationContext?.peek("danger", {
        data: { headline: t(this, e, i).call(this, "error"), message: t(this, e, i).call(this, "errorDeletingSnapshot") }
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
    const a = this._selectedSnapshots.size, s = this._modalManagerContext.open(this, g, {
      data: {
        headline: t(this, e, i).call(this, "deleteSelectedHeadline"),
        content: l`
                    <p>${t(this, e, i).call(this, "areYouSureDelete")} <strong>${a} ${a > 1 ? t(this, e, i).call(this, "snapshots") : t(this, e, i).call(this, "snapshot")}</strong>?</p>
                    <uui-box>
                        <p style="margin: 0;">
                            <uui-icon name="icon-alert"></uui-icon>
                            <strong>${t(this, e, i).call(this, "warning")}:</strong> ${t(this, e, i).call(this, "deleteSelectedWarning")}
                        </p>
                    </uui-box>
                `,
        color: "danger",
        confirmLabel: `${t(this, e, i).call(this, "delete")} ${a} ${a > 1 ? t(this, e, i).call(this, "snapshots") : t(this, e, i).call(this, "snapshot")}`
      }
    });
    try {
      await s.onSubmit();
    } catch {
      return;
    }
    this._isDeleting = !0;
    const o = await this._authContext?.getLatestToken();
    if (!o) {
      this._notificationContext?.peek("danger", {
        data: { headline: t(this, e, i).call(this, "authError"), message: t(this, e, i).call(this, "noAuthToken") }
      }), this._isDeleting = !1;
      return;
    }
    try {
      const r = await fetch("/umbraco/management/api/v1/snapshot/delete-bulk", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${o}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mediaKey: this._mediaKey,
          snapshotNames: Array.from(this._selectedSnapshots)
        })
      });
      if (r.ok) {
        const n = await r.json();
        this._notificationContext?.peek("positive", {
          data: { headline: t(this, e, i).call(this, "snapshotsDeleted"), message: n.message }
        }), await this._fetchVersions(this._mediaKey);
      } else if (r.status === 401)
        this._notificationContext?.peek("danger", {
          data: { headline: t(this, e, i).call(this, "unauthorized"), message: t(this, e, i).call(this, "sessionExpired") }
        });
      else {
        const n = await r.json();
        this._notificationContext?.peek("danger", {
          data: { headline: t(this, e, i).call(this, "bulkDeleteFailed"), message: n.detail || t(this, e, i).call(this, "unknownError") }
        });
      }
    } catch (r) {
      console.error("Failed to bulk delete snapshots:", r), this._notificationContext?.peek("danger", {
        data: { headline: t(this, e, i).call(this, "error"), message: t(this, e, i).call(this, "errorDeletingSnapshots") }
      });
    } finally {
      this._isDeleting = !1;
    }
  }
  /**
   * Restores a specific snapshot version as the current file
   */
  async _restoreVersion(a) {
    if (this._isRestoring) {
      console.warn("Restore already in progress");
      return;
    }
    if (!this._modalManagerContext) {
      console.error("Modal manager context not available");
      return;
    }
    const s = this._modalManagerContext.open(this, g, {
      data: {
        headline: t(this, e, i).call(this, "restoreHeadline"),
        content: l`
                        <p>${t(this, e, i).call(this, "areYouSureRestore")} <strong>"${a.name}"</strong>?</p>
                        <p>${t(this, e, i).call(this, "restoreDescription")}</p>
                        <uui-box>
                            <p style="margin: 0;">
                                <uui-icon name="icon-alert"></uui-icon>
                                <strong>${t(this, e, i).call(this, "warning")}:</strong> ${t(this, e, i).call(this, "restoreWarning")}
                            </p>
                        </uui-box>
                    `,
        color: "danger",
        confirmLabel: t(this, e, i).call(this, "restore")
      }
    });
    try {
      await s.onSubmit();
    } catch {
      return;
    }
    this._isRestoring = !0;
    const o = await this._authContext?.getLatestToken();
    if (!o) {
      this._notificationContext?.peek("danger", {
        data: { headline: t(this, e, i).call(this, "authError"), message: t(this, e, i).call(this, "noAuthToken") }
      }), this._isRestoring = !1;
      return;
    }
    try {
      const n = await fetch("/umbraco/management/api/v1/snapshot/restore", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${o}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mediaKey: this._mediaKey,
          snapshotName: a.name
        })
      });
      if (n.ok) {
        const h = await n.json();
        this._notificationContext?.peek("positive", {
          data: {
            headline: t(this, e, i).call(this, "snapshotRestored"),
            message: h.message
          }
        }), await this._fetchVersions(this._mediaKey);
      } else if (n.status === 409)
        this._notificationContext?.peek("warning", {
          data: {
            headline: t(this, e, i).call(this, "restoreInProgress"),
            message: t(this, e, i).call(this, "restoreInProgressMessage")
          }
        });
      else if (n.status === 401)
        this._notificationContext?.peek("danger", {
          data: {
            headline: t(this, e, i).call(this, "unauthorized"),
            message: t(this, e, i).call(this, "sessionExpired")
          }
        });
      else {
        const h = await n.json();
        this._notificationContext?.peek("danger", {
          data: {
            headline: t(this, e, i).call(this, "restoreFailed"),
            message: h.detail || t(this, e, i).call(this, "unknownError")
          }
        });
      }
    } catch (r) {
      console.error("Failed to restore snapshot:", r), this._notificationContext?.peek("danger", {
        data: {
          headline: t(this, e, i).call(this, "error"),
          message: t(this, e, i).call(this, "errorRestoringSnapshot")
        }
      });
    } finally {
      this._isRestoring = !1;
    }
  }
  /**
   * Formats a byte count into a human-readable size string
   */
  _formatSize(a) {
    if (a === 0) return "0 B";
    const s = ["B", "KB", "MB", "GB"], o = Math.floor(Math.log(a) / Math.log(1024));
    return (a / Math.pow(1024, o)).toFixed(1) + " " + s[o];
  }
  /**
   * Renders a compact inline status badge for a snapshot version
   */
  _renderStatus(a, s) {
    const o = [];
    return a.isPinned && o.push(l`<uui-tag class="status-badge" look="primary" color="warning">${t(this, e, i).call(this, "pinned")}</uui-tag>`), a.isRestored && o.push(l`<uui-tag class="status-badge" look="primary" color="positive">${t(this, e, i).call(this, "restored")}</uui-tag>`), s === 0 && o.push(l`<uui-tag class="status-badge" look="primary" color="default">${t(this, e, i).call(this, "latest")}</uui-tag>`), o;
  }
  /**
   * Renders the comparison panel content
   */
  _renderComparison() {
    if (!this._showComparison) return "";
    const a = this._comparisonSnapshot, s = this._comparisonCurrent, o = a && s && this._isImage(a.name) && this._isImage(s.name);
    return l`
            <div class="preview-overlay" @click="${this._closeComparison}"></div>
            <div class="comparison-panel">
                <div class="preview-header">
                    <h3>
                        <uui-icon name="icon-split"></uui-icon>
                        ${t(this, e, i).call(this, "compareVersions")}
                    </h3>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${o ? l`
                            <uui-button
                                look="secondary"
                                compact
                                @click="${this._toggleComparisonMode}"
                                title="${t(this, e, i).call(this, "toggleComparisonMode")}">
                                <uui-icon name="${this._comparisonMode === "side-by-side" ? "icon-layers-alt" : "icon-split"}"></uui-icon>
                                ${this._comparisonMode === "side-by-side" ? t(this, e, i).call(this, "slider") : t(this, e, i).call(this, "sideBySide")}
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
                    ${this._comparisonLoading ? l`<div class="loader"><uui-loader></uui-loader> ${t(this, e, i).call(this, "loadingCurrentFile")}</div>` : s ? o ? this._renderImageComparison(s, a) : this._renderMetadataComparison(s, a) : l`<uui-box><p>${t(this, e, i).call(this, "unableToLoadCurrent")}</p></uui-box>`}
                </div>
            </div>
        `;
  }
  /**
   * Renders a side-by-side or slider image comparison
   */
  _renderImageComparison(a, s) {
    return this._comparisonMode === "slider" ? l`
                <div class="slider-comparison">
                    <div class="slider-container">
                        <img class="slider-img-under" src="${a.url}" alt="${t(this, e, i).call(this, "current")}" />
                        <div class="slider-img-over" style="width: ${this._sliderPosition}%;">
                            <img src="${s.url}" alt="${t(this, e, i).call(this, "snapshot")}" />
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
                        <span><uui-tag look="primary" color="default">${t(this, e, i).call(this, "snapshot")}</uui-tag> ${s.name}</span>
                        <span><uui-tag look="primary" color="positive">${t(this, e, i).call(this, "current")}</uui-tag> ${a.name}</span>
                    </div>
                </div>
                ${this._renderMetadataComparison(a, s)}
            ` : l`
            <div class="side-by-side">
                <div class="compare-column">
                    <div class="compare-label">
                        <uui-tag look="primary" color="default">${t(this, e, i).call(this, "snapshot")}</uui-tag>
                        <span class="compare-filename">${s.name}</span>
                    </div>
                    <div class="compare-image-container">
                        <img src="${s.url}" alt="${s.name}" />
                    </div>
                </div>
                <div class="compare-divider"></div>
                <div class="compare-column">
                    <div class="compare-label">
                        <uui-tag look="primary" color="positive">${t(this, e, i).call(this, "current")}</uui-tag>
                        <span class="compare-filename">${a.name}</span>
                    </div>
                    <div class="compare-image-container">
                        <img src="${a.url}" alt="${a.name}" />
                    </div>
                </div>
            </div>
            ${this._renderMetadataComparison(a, s)}
        `;
  }
  /**
   * Renders a metadata diff table comparing the snapshot and current file
   */
  _renderMetadataComparison(a, s) {
    const o = a.size - s.size, r = o > 0 ? `+${this._formatSize(o)}` : o < 0 ? `-${this._formatSize(Math.abs(o))}` : t(this, e, i).call(this, "noChange");
    return l`
            <div class="metadata-comparison">
                <h4>${t(this, e, i).call(this, "fileDetails")}</h4>
                <uui-table>
                    <uui-table-head>
                        <uui-table-head-cell>${t(this, e, i).call(this, "property")}</uui-table-head-cell>
                        <uui-table-head-cell>${t(this, e, i).call(this, "snapshot")}</uui-table-head-cell>
                        <uui-table-head-cell>${t(this, e, i).call(this, "current")}</uui-table-head-cell>
                        <uui-table-head-cell>${t(this, e, i).call(this, "difference")}</uui-table-head-cell>
                    </uui-table-head>
                    <uui-table-row>
                        <uui-table-cell><strong>${t(this, e, i).call(this, "filename")}</strong></uui-table-cell>
                        <uui-table-cell>${s.name}</uui-table-cell>
                        <uui-table-cell>${a.name}</uui-table-cell>
                        <uui-table-cell>
                            ${s.name === a.name ? l`<uui-tag look="secondary" color="default">${t(this, e, i).call(this, "same")}</uui-tag>` : l`<uui-tag look="primary" color="warning">${t(this, e, i).call(this, "changed")}</uui-tag>`}
                        </uui-table-cell>
                    </uui-table-row>
                    <uui-table-row>
                        <uui-table-cell><strong>${t(this, e, i).call(this, "fileSize")}</strong></uui-table-cell>
                        <uui-table-cell>${this._formatSize(s.size)}</uui-table-cell>
                        <uui-table-cell>${this._formatSize(a.size)}</uui-table-cell>
                        <uui-table-cell>
                            <uui-tag look="secondary" color="${o === 0 ? "default" : o > 0 ? "warning" : "positive"}">
                                ${r}
                            </uui-tag>
                        </uui-table-cell>
                    </uui-table-row>
                    <uui-table-row>
                        <uui-table-cell><strong>${t(this, e, i).call(this, "date")}</strong></uui-table-cell>
                        <uui-table-cell>${this._formatDate(s.date)}</uui-table-cell>
                        <uui-table-cell>${this._formatDate(a.lastModified)}</uui-table-cell>
                        <uui-table-cell></uui-table-cell>
                    </uui-table-row>
                    ${s.uploader ? l`
                        <uui-table-row>
                            <uui-table-cell><strong>${t(this, e, i).call(this, "uploadedBy")}</strong></uui-table-cell>
                            <uui-table-cell>${s.uploader.replace(/_/g, " ")}</uui-table-cell>
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
    return this._totalCount === 0 ? "" : l`
            <div class="stats-strip">
                <div class="stats-strip-item">
                    <uui-icon name="icon-documents"></uui-icon>
                    <span class="stats-strip-value">${this._totalCount}</span>
                    <span class="stats-strip-label">${this._totalCount !== 1 ? t(this, e, i).call(this, "snapshots") : t(this, e, i).call(this, "snapshot")}</span>
                </div>
                <div class="stats-strip-divider"></div>
                <div class="stats-strip-item">
                    <uui-icon name="icon-server"></uui-icon>
                    <span class="stats-strip-value">${this._formatSize(this._totalSizeBytes)}</span>
                    <span class="stats-strip-label">${t(this, e, i).call(this, "totalSize")}</span>
                </div>
                <div class="stats-strip-divider"></div>
                <div class="stats-strip-item">
                    <uui-icon name="icon-calendar"></uui-icon>
                    <span class="stats-strip-value">${this._oldestDate ? this._formatDate(this._oldestDate) : "—"}</span>
                    <span class="stats-strip-label">${t(this, e, i).call(this, "oldest")}</span>
                </div>
                <div class="stats-strip-divider"></div>
                <div class="stats-strip-item">
                    <uui-icon name="icon-calendar"></uui-icon>
                    <span class="stats-strip-value">${this._newestDate ? this._formatDate(this._newestDate) : "—"}</span>
                    <span class="stats-strip-label">${t(this, e, i).call(this, "latest")}</span>
                </div>
                <div class="stats-strip-divider"></div>
                <div class="stats-strip-item">
                    <uui-icon name="icon-users"></uui-icon>
                    <span class="stats-strip-value">${this._uniqueUploaderCount}</span>
                    <span class="stats-strip-label">${this._uniqueUploaderCount !== 1 ? t(this, e, i).call(this, "contributors") : t(this, e, i).call(this, "contributor")}</span>
                </div>
            </div>
        `;
  }
  render() {
    if (this._loading)
      return l`<div class="loader"><uui-loader></uui-loader> ${t(this, e, i).call(this, "fetchingSnapshots")}</div>`;
    if (this._versions.length === 0)
      return l`
                <uui-box>
                    <div style="display: flex; align-items: center; gap: var(--uui-size-space-3);">
                        <uui-icon name="info" style="color: var(--uui-color-primary);"></uui-icon>
                        <span>${t(this, e, i).call(this, "noVersionsFound")}</span>
                    </div>
                </uui-box>
            `;
    const a = this._versions.length === 1 && this._totalCount === 1, s = (this._currentPage - 1) * this._pageSize, o = this._selectedSnapshots.size > 0;
    return l`
            <div class="snapshot-container">

                <!-- Summary stats for this media item -->
                ${this._renderStats()}

                <!-- Bulk action toolbar -->
                ${o ? l`
                    <div class="bulk-toolbar">
                        <span class="bulk-toolbar-count">
                            <uui-icon name="icon-check"></uui-icon>
                            ${this._selectedSnapshots.size} ${this._selectedSnapshots.size > 1 ? t(this, e, i).call(this, "snapshots") : t(this, e, i).call(this, "snapshot")} ${t(this, e, i).call(this, "selected")}
                        </span>
                        <div class="bulk-toolbar-actions">
                            <uui-button
                                look="secondary"
                                compact
                                @click="${this._clearSelection}">
                                ${t(this, e, i).call(this, "clearSelection")}
                            </uui-button>
                            <uui-button
                                look="primary"
                                color="danger"
                                compact
                                ?disabled="${this._isDeleting}"
                                @click="${this._bulkDeleteSnapshots}">
                                <uui-icon name="icon-trash"></uui-icon>
                                ${this._isDeleting ? t(this, e, i).call(this, "deleting") : `${t(this, e, i).call(this, "delete")} ${this._selectedSnapshots.size} ${this._selectedSnapshots.size > 1 ? t(this, e, i).call(this, "snapshots") : t(this, e, i).call(this, "snapshot")}`}
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
                                title="${t(this, e, i).call(this, "selectAllOnPage")}"
                                class="select-checkbox"
                            />
                        </uui-table-head-cell>
                        <uui-table-head-cell>${t(this, e, i).call(this, "version")}</uui-table-head-cell>
                        <uui-table-head-cell>${t(this, e, i).call(this, "uploaded")}</uui-table-head-cell>
                        <uui-table-head-cell style="text-align: right;">${t(this, e, i).call(this, "actions")}</uui-table-head-cell>
                    </uui-table-head>

                    ${this._versions.map((r, n) => {
      const h = s + n, p = h === 0, v = this._selectedSnapshots.has(r.name);
      return l`
                            <uui-table-row class="${v ? "row-selected" : ""}">
                                <uui-table-cell style="width: 40px;">
                                    <input
                                        type="checkbox"
                                        .checked="${v}"
                                        ?disabled="${p}"
                                        @change="${() => this._toggleSelection(r.name)}"
                                        title="${p ? t(this, e, i).call(this, "cannotSelectLatest") : t(this, e, i).call(this, "selectThisSnapshot")}"
                                        class="select-checkbox"
                                    />
                                </uui-table-cell>

                                <!-- Version: filename + status badge + note -->
                                <uui-table-cell>
                                    <div class="version-cell">
                                        <div class="version-cell-primary">
                                            ${this._isPreviewable(r.name) ? l`
                                                    <button
                                                        class="filename-link"
                                                        @click="${() => this._openPreview(r)}"
                                                        title="${t(this, e, i).call(this, "clickToPreview")}">
                                                        <uui-icon name="${this._getFileIcon(r.name)}"></uui-icon>
                                                        ${r.name}
                                                    </button>
                                                ` : l`<span class="filename-text"><uui-icon name="icon-document"></uui-icon> ${r.name}</span>`}
                                            ${this._renderStatus(r, h)}
                                        </div>
                                        <div class="version-cell-secondary">
                                            ${this._renderNoteCell(r)}
                                        </div>
                                    </div>
                                </uui-table-cell>

                                <!-- Uploaded: date + uploader stacked -->
                                <uui-table-cell>
                                    <div class="upload-cell">
                                        <span class="upload-date">${this._formatDate(r.date)}</span>
                                        <span class="upload-user">${r.uploader.replace(/_/g, " ")}</span>
                                    </div>
                                </uui-table-cell>

                                <!-- Actions: icon-only buttons -->
                                <uui-table-cell>
                                    <div class="actions-cell">
                                        <uui-button
                                            look="secondary"
                                            compact
                                            ?disabled="${p}"
                                            title="${p ? t(this, e, i).call(this, "thisIsLatest") : t(this, e, i).call(this, "compareWithCurrent")}"
                                            @click="${() => this._openComparison(r)}">
                                            <uui-icon name="icon-split"></uui-icon>
                                        </uui-button>
                                        <uui-button
                                            look="secondary"
                                            compact
                                            href="${r.url}"
                                            target="_blank"
                                            title="${t(this, e, i).call(this, "downloadThisVersion")}">
                                            <uui-icon name="icon-download-alt"></uui-icon>
                                        </uui-button>
                                        <uui-button
                                            look="${r.isPinned ? "primary" : "secondary"}"
                                            color="${r.isPinned ? "warning" : "default"}"
                                            compact
                                            ?disabled="${this._togglingPin === r.name}"
                                            title="${r.isPinned ? t(this, e, i).call(this, "unpinAllow") : t(this, e, i).call(this, "pinProtect")}"
                                            @click="${() => this._togglePin(r)}">
                                            <uui-icon name="icon-pin-location"></uui-icon>
                                        </uui-button>
                                        <uui-button
                                            look="primary"
                                            color="positive"
                                            compact
                                            ?disabled="${a || this._isRestoring || p}"
                                            title="${a ? t(this, e, i).call(this, "cannotRestoreSingleVersion") : p ? t(this, e, i).call(this, "alreadyLatest") : t(this, e, i).call(this, "restoreThisVersion")}"
                                            @click="${() => this._restoreVersion(r)}">
                                            <uui-icon name="icon-refresh"></uui-icon>
                                        </uui-button>
                                        <uui-button
                                            look="secondary"
                                            color="danger"
                                            compact
                                            ?disabled="${p || this._isDeleting || r.isPinned}"
                                            title="${r.isPinned ? t(this, e, i).call(this, "unpinBeforeDeleting") : p ? t(this, e, i).call(this, "cannotDeleteLatest") : t(this, e, i).call(this, "deleteThisSnapshot")}"
                                            @click="${() => this._deleteSnapshot(r)}">
                                            <uui-icon name="icon-trash"></uui-icon>
                                        </uui-button>
                                    </div>
                                </uui-table-cell>
                            </uui-table-row>
                        `;
    })}
                </uui-table>

                ${this._totalPages > 1 ? l`
                    <div class="pagination-container">
                        <uui-pagination
                            .current="${this._currentPage}"
                            .total="${this._totalPages}"
                            @change="${this._onPageChange}">
                        </uui-pagination>
                    </div>
                ` : ""}

                <!-- File Preview Side Panel -->
                ${this._showPreview ? l`
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
                                <strong>${t(this, e, i).call(this, "filename")}:</strong> <br/>${this._previewImageName}
                            </div>
                            <div class="preview-media-container">
                                ${this._renderPreviewContent()}
                            </div>
                            <div class="preview-actions">
                                <uui-button
                                    look="primary"
                                    href="${this._previewImageUrl}"
                                    target="_blank">
                                    <uui-icon name="icon-out"></uui-icon> ${t(this, e, i).call(this, "openInNewTab")}
                                </uui-button>
                                <uui-button
                                    look="secondary"
                                    href="${this._previewImageUrl}"
                                    download="${this._previewImageName}">
                                    <uui-icon name="icon-download-alt"></uui-icon> ${t(this, e, i).call(this, "download")}
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
  _formatDate(a) {
    return new Date(a).toLocaleDateString(void 0, {
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
  _startEditNote(a) {
    this._editingNoteName = a.name, this._editingNoteValue = a.note || "";
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
  async _saveNote(a) {
    if (this._savingNote) return;
    this._savingNote = !0;
    const s = await this._authContext?.getLatestToken();
    if (!s) {
      this._notificationContext?.peek("danger", {
        data: { headline: t(this, e, i).call(this, "authError"), message: t(this, e, i).call(this, "noAuthToken") }
      }), this._savingNote = !1;
      return;
    }
    try {
      const o = await fetch("/umbraco/management/api/v1/snapshot/update-note", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${s}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mediaKey: this._mediaKey,
          snapshotName: a.name,
          note: this._editingNoteValue
        })
      });
      if (o.ok)
        a.note = this._editingNoteValue.trim() || null, this._editingNoteName = null, this._editingNoteValue = "", this.requestUpdate();
      else {
        const r = await o.json();
        this._notificationContext?.peek("danger", {
          data: { headline: t(this, e, i).call(this, "saveFailed"), message: r.detail || t(this, e, i).call(this, "failedToSaveNote") }
        });
      }
    } catch (o) {
      console.error("Failed to save note:", o), this._notificationContext?.peek("danger", {
        data: { headline: t(this, e, i).call(this, "error"), message: t(this, e, i).call(this, "errorSavingNote") }
      });
    } finally {
      this._savingNote = !1;
    }
  }
  /**
   * Handles keydown in the note input — Enter saves, Escape cancels
   */
  _onNoteKeydown(a, s) {
    a.key === "Enter" ? (a.preventDefault(), this._saveNote(s)) : a.key === "Escape" && this._cancelEditNote();
  }
  /**
   * Renders the note cell for a snapshot row
   */
  _renderNoteCell(a) {
    return this._editingNoteName === a.name ? l`
                <div class="note-edit">
                    <input
                        type="text"
                        class="note-input"
                        maxlength="500"
                        placeholder="${t(this, e, i).call(this, "addNotePlaceholder")}"
                        .value="${this._editingNoteValue}"
                        @input="${(o) => this._editingNoteValue = o.target.value}"
                        @keydown="${(o) => this._onNoteKeydown(o, a)}"
                    />
                    <div class="note-edit-actions">
                        <uui-button
                            look="primary"
                            compact
                            ?disabled="${this._savingNote}"
                            @click="${() => this._saveNote(a)}">
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
            ` : a.note ? l`
                <button class="note-display" @click="${() => this._startEditNote(a)}" title="${t(this, e, i).call(this, "clickToEditNote")}">
                    <uui-icon name="icon-edit"></uui-icon>
                    <span class="note-text">${a.note}</span>
                </button>
            ` : l`
            <button class="note-add" @click="${() => this._startEditNote(a)}" title="${t(this, e, i).call(this, "addNoteTitle")}">
                <uui-icon name="icon-edit"></uui-icon> ${t(this, e, i).call(this, "addNote")}
            </button>
        `;
  }
  // --- Pin operations ---
  /**
   * Toggles the pinned state of a snapshot
   */
  async _togglePin(a) {
    if (this._togglingPin) return;
    this._togglingPin = a.name;
    const s = await this._authContext?.getLatestToken();
    if (!s) {
      this._notificationContext?.peek("danger", {
        data: { headline: t(this, e, i).call(this, "authError"), message: t(this, e, i).call(this, "noAuthToken") }
      }), this._togglingPin = null;
      return;
    }
    try {
      const o = await fetch("/umbraco/management/api/v1/snapshot/toggle-pin", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${s}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mediaKey: this._mediaKey,
          snapshotName: a.name
        })
      });
      if (o.ok) {
        const r = await o.json();
        a.isPinned = r.isPinned, this.requestUpdate(), this._notificationContext?.peek("positive", {
          data: { headline: r.isPinned ? t(this, e, i).call(this, "snapshotPinned") : t(this, e, i).call(this, "snapshotUnpinned"), message: r.message }
        });
      } else {
        const r = await o.json();
        this._notificationContext?.peek("danger", {
          data: { headline: t(this, e, i).call(this, "pinFailed"), message: r.detail || t(this, e, i).call(this, "errorTogglingPin") }
        });
      }
    } catch (o) {
      console.error("Failed to toggle pin:", o), this._notificationContext?.peek("danger", {
        data: { headline: t(this, e, i).call(this, "error"), message: t(this, e, i).call(this, "errorTogglingPin") }
      });
    } finally {
      this._togglingPin = null;
    }
  }
};
m = /* @__PURE__ */ new WeakMap();
e = /* @__PURE__ */ new WeakSet();
i = function(a) {
  return D(this, m).term(`umbracoMediaSnapshot_${a}`);
};
c.styles = w`
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

        /* Uploaded date and user */
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

        /* -- Comparison specific styles -- */
        .comparison-panel {
            position: fixed;
            top: 0;
            right: 0;
            bottom: 0;
            width: 80%;
            max-width: 1000px;
            background: var(--uui-color-surface);
            box-shadow: -2px 0 10px rgba(0, 0, 0, 0.3);
            z-index: 1100;
            display: flex;
            flex-direction: column;
            animation: slideIn 0.3s ease-out;
        }

        .comparison-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: var(--uui-size-space-5);
            border-bottom: 1px solid var(--uui-color-border);
            background: var(--uui-color-surface-alt);
        }

        .comparison-header h3 {
            margin: 0;
            font-size: 1.2rem;
            display: flex;
            align-items: center;
            gap: var(--uui-size-space-2);
        }

        .comparison-content {
            flex: 1;
            overflow-y: auto;
            padding: var(--uui-size-space-5);
            display: flex;
            flex-direction: column;
            gap: var(--uui-size-space-5);
        }

        .slider-comparison {
            position: relative;
            height: 400px;
            display: flex;
            flex-direction: column;
            gap: 16px;
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
            max-height: 400px;
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
            max-height: 400px;
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

        /* Uploaded date and user */
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
u([
  d()
], c.prototype, "_versions", 2);
u([
  d()
], c.prototype, "_loading", 2);
u([
  d()
], c.prototype, "_mediaKey", 2);
u([
  d()
], c.prototype, "_previewImageUrl", 2);
u([
  d()
], c.prototype, "_previewImageName", 2);
u([
  d()
], c.prototype, "_showPreview", 2);
u([
  d()
], c.prototype, "_isRestoring", 2);
u([
  d()
], c.prototype, "_currentPage", 2);
u([
  d()
], c.prototype, "_showComparison", 2);
u([
  d()
], c.prototype, "_comparisonSnapshot", 2);
u([
  d()
], c.prototype, "_comparisonCurrent", 2);
u([
  d()
], c.prototype, "_comparisonLoading", 2);
u([
  d()
], c.prototype, "_comparisonMode", 2);
u([
  d()
], c.prototype, "_sliderPosition", 2);
u([
  d()
], c.prototype, "_selectedSnapshots", 2);
u([
  d()
], c.prototype, "_isDeleting", 2);
u([
  d()
], c.prototype, "_editingNoteName", 2);
u([
  d()
], c.prototype, "_editingNoteValue", 2);
u([
  d()
], c.prototype, "_savingNote", 2);
u([
  d()
], c.prototype, "_totalCount", 2);
u([
  d()
], c.prototype, "_totalPages", 2);
u([
  d()
], c.prototype, "_totalSizeBytes", 2);
u([
  d()
], c.prototype, "_oldestDate", 2);
u([
  d()
], c.prototype, "_newestDate", 2);
u([
  d()
], c.prototype, "_uniqueUploaderCount", 2);
u([
  d()
], c.prototype, "_togglingPin", 2);
c = u([
  y("snapshot-viewer")
], c);
export {
  c as SnapshotViewerElement
};
//# sourceMappingURL=umbraco-media-snapshot.js.map
