import { LitElement as d, html as r, css as p, state as l, customElement as h } from "@umbraco-cms/backoffice/external/lit";
import { UmbElementMixin as g } from "@umbraco-cms/backoffice/element-api";
import { UMB_WORKSPACE_CONTEXT as m } from "@umbraco-cms/backoffice/workspace";
import { UMB_AUTH_CONTEXT as v } from "@umbraco-cms/backoffice/auth";
import { UMB_NOTIFICATION_CONTEXT as _ } from "@umbraco-cms/backoffice/notification";
import { UMB_MODAL_MANAGER_CONTEXT as f, UMB_CONFIRM_MODAL as b } from "@umbraco-cms/backoffice/modal";
var w = Object.defineProperty, x = Object.getOwnPropertyDescriptor, s = (e, i, a, t) => {
  for (var o = t > 1 ? void 0 : t ? x(i, a) : i, u = e.length - 1, c; u >= 0; u--)
    (c = e[u]) && (o = (t ? c(i, a, o) : c(o)) || o);
  return t && o && w(i, a, o), o;
};
let n = class extends g(d) {
  constructor() {
    super(), this._versions = [], this._loading = !0, this._mediaKey = "", this._previewImageUrl = null, this._previewImageName = "", this._showPreview = !1, this._isRestoring = !1, this._currentPage = 1, this._pageSize = 10, this.consumeContext(v, (e) => {
      this._authContext = e;
    }), this.consumeContext(_, (e) => {
      this._notificationContext = e;
    }), this.consumeContext(f, (e) => {
      this._modalManagerContext = e;
    }), this.consumeContext(m, (e) => {
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
    const i = this._modalManagerContext.open(this, b, {
      data: {
        headline: "Restore File Version",
        content: r`
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
      } else if (o.status === 401)
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
   * Renders the status tag for a snapshot version based on its metadata
   */
  _renderStatus(e, i) {
    return e.isRestored ? r`
                <uui-tag look="primary" color="positive">
                    <uui-icon name="icon-refresh"></uui-icon>
                    Restored ${e.restoredDate ? this._formatDate(e.restoredDate) : ""}
                </uui-tag>
            ` : i === 0 ? r`
                <uui-tag look="primary" color="default">
                    <uui-icon name="icon-check"></uui-icon>
                    Latest
                </uui-tag>
            ` : r`
            <uui-tag look="secondary" color="default">
                Original
            </uui-tag>
        `;
  }
  render() {
    if (this._loading)
      return r`<div class="loader"><uui-loader></uui-loader> Fetching snapshots...</div>`;
    if (this._versions.length === 0)
      return r`
                <uui-box>
                    <div style="display: flex; align-items: center; gap: var(--uui-size-space-3);">
                        <uui-icon name="info" style="color: var(--uui-color-primary);"></uui-icon>
                        <span>No previous versions found in the snapshots container.</span>
                    </div>
                </uui-box>
            `;
    const e = this._versions.length === 1, i = this._pagedVersions, a = (this._currentPage - 1) * this._pageSize;
    return r`
            <div class="snapshot-container">
                <uui-table>
                    <uui-table-head>
                        <uui-table-head-cell>Version Filename</uui-table-head-cell>
                        <uui-table-head-cell>Date Uploaded</uui-table-head-cell>
                        <uui-table-head-cell>Uploaded By</uui-table-head-cell>
                        <uui-table-head-cell>Status</uui-table-head-cell>
                        <uui-table-head-cell>Actions</uui-table-head-cell>
                    </uui-table-head>

                    ${i.map((t, o) => r`
                        <uui-table-row>
                            <uui-table-cell>
                                ${this._isImage(t.name) ? r`
                                        <button 
                                            class="filename-link" 
                                            @click="${() => this._openImagePreview(t)}"
                                            title="Click to preview image">
                                            <uui-icon name="icon-picture"></uui-icon>
                                            ${t.name}
                                        </button>
                                    ` : r`<span>${t.name}</span>`}
                            </uui-table-cell>
                            <uui-table-cell>${this._formatDate(t.date)}</uui-table-cell>
                            <uui-table-cell>${t.uploader.replace(/_/g, " ")}</uui-table-cell>
                            <uui-table-cell>
                                ${this._renderStatus(t, a + o)}
                            </uui-table-cell>
                            <uui-table-cell>
                                <div style="display: flex; gap: 8px;">
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
                                        ?disabled="${e || this._isRestoring || a + o === 0}"
                                        title="${e ? "Cannot restore when only one version exists" : a + o === 0 ? "This is already the latest version" : "Restore this version"}"
                                        @click="${() => this._restoreVersion(t)}">
                                        <uui-icon name="icon-refresh"></uui-icon> ${this._isRestoring ? "Restoring..." : "Restore"}
                                    </uui-button>
                                </div>
                            </uui-table-cell>
                        </uui-table-row>
                    `)}
                </uui-table>

                ${this._totalPages > 1 ? r`
                    <div class="pagination-container">
                        <uui-pagination
                            .current="${this._currentPage}"
                            .total="${this._totalPages}"
                            @change="${this._onPageChange}">
                        </uui-pagination>
                    </div>
                ` : ""}

                <!-- Image Preview Side Panel -->
                ${this._showPreview ? r`
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
                                ${this._previewImageUrl ? r`
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
                                    ` : r`<uui-loader></uui-loader>`}
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
n.styles = p`
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

        @media (max-width: 768px) {
            .preview-panel {
                width: 100vw;
                max-width: 100vw;
            }
        }
    `;
s([
  l()
], n.prototype, "_versions", 2);
s([
  l()
], n.prototype, "_loading", 2);
s([
  l()
], n.prototype, "_mediaKey", 2);
s([
  l()
], n.prototype, "_previewImageUrl", 2);
s([
  l()
], n.prototype, "_previewImageName", 2);
s([
  l()
], n.prototype, "_showPreview", 2);
s([
  l()
], n.prototype, "_isRestoring", 2);
s([
  l()
], n.prototype, "_currentPage", 2);
n = s([
  h("snapshot-viewer")
], n);
export {
  n as SnapshotViewerElement
};
//# sourceMappingURL=umbraco-media-snapshot.js.map
