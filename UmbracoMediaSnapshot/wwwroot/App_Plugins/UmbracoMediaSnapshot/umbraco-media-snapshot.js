import { LitElement as h, html as n, css as d, state as c, customElement as p } from "@umbraco-cms/backoffice/external/lit";
import { UmbElementMixin as m } from "@umbraco-cms/backoffice/element-api";
import { UMB_WORKSPACE_CONTEXT as b } from "@umbraco-cms/backoffice/workspace";
import { UMB_AUTH_CONTEXT as f } from "@umbraco-cms/backoffice/auth";
var y = Object.defineProperty, _ = Object.getOwnPropertyDescriptor, l = (e, o, t, a) => {
  for (var i = a > 1 ? void 0 : a ? _(o, t) : o, r = e.length - 1, u; r >= 0; r--)
    (u = e[r]) && (i = (a ? u(o, t, i) : u(i)) || i);
  return a && i && y(o, t, i), i;
};
let s = class extends m(h) {
  constructor() {
    super(), this._versions = [], this._loading = !0, this._mediaKey = "", this.consumeContext(f, (e) => {
      this._authContext = e;
    }), this.consumeContext(b, (e) => {
      const o = e;
      o.unique && this.observe(o.unique, (t) => {
        t && t !== this._mediaKey && (this._mediaKey = t.toString(), this._fetchVersions(this._mediaKey));
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
    const o = await this._authContext?.getLatestToken();
    if (!o) {
      console.error("No authentication token available."), this._loading = !1;
      return;
    }
    try {
      const t = `/umbraco/management/api/v1/snapshot/versions/${e}`, a = await fetch(t, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${o}`,
          "Content-Type": "application/json"
        }
      });
      a.ok ? this._versions = await a.json() : a.status === 401 && console.error("Unauthorized: The session may have expired.");
    } catch (t) {
      console.error("Failed to fetch snapshots:", t);
    } finally {
      this._loading = !1;
    }
  }
  /**
   * Restores a specific snapshot version as the current file
   */
  async _restoreVersion(e) {
    if (!confirm(
      `Are you sure you want to restore "${e.name}"?

This will replace the current file and create a new snapshot. This action cannot be undone.`
    )) return;
    const t = await this._authContext?.getLatestToken();
    if (!t) {
      console.error("No authentication token available.");
      return;
    }
    try {
      const i = await fetch("/umbraco/management/api/v1/snapshot/restore", {
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
      if (i.ok) {
        const r = await i.json();
        alert(`✓ ${r.message}`), await this._fetchVersions(this._mediaKey);
      } else if (i.status === 401)
        alert("Unauthorized: Your session may have expired. Please refresh the page.");
      else {
        const r = await i.json();
        alert(`Failed to restore: ${r.detail || "Unknown error"}`);
      }
    } catch (a) {
      console.error("Failed to restore snapshot:", a), alert("An error occurred while restoring the snapshot. Please try again.");
    }
  }
  render() {
    return this._loading ? n`<div class="loader"><uui-loader></uui-loader> Fetching snapshots...</div>` : this._versions.length === 0 ? n`
                <uui-box>
                    <div style="display: flex; align-items: center; gap: var(--uui-size-space-3);">
                        <uui-icon name="info" style="color: var(--uui-color-primary);"></uui-icon>
                        <span>No previous versions found in the snapshots container.</span>
                    </div>
                </uui-box>
            ` : n`
            <uui-table>
                <uui-table-head>
                    <uui-table-head-cell>Version Filename</uui-table-head-cell>
                    <uui-table-head-cell>Date Uploaded</uui-table-head-cell>
                    <uui-table-cell>Uploaded By</uui-table-cell>
                    <uui-table-head-cell>Status</uui-table-head-cell>
                    <uui-table-head-cell>Actions</uui-table-head-cell>
                </uui-table-head>

                ${this._versions.map((e) => n`
                    <uui-table-row>
                        <uui-table-cell>${e.name}</uui-table-cell>
                        <uui-table-cell>${this._formatDate(e.date)}</uui-table-cell>
                        <uui-table-cell>${e.uploader.replace(/_/g, " ")}</uui-table-cell>
                        <uui-table-cell>
                            ${e.isRestored ? n`
                                <uui-tag look="primary" color="positive">
                                    <uui-icon name="refresh"></uui-icon>
                                    Restored ${e.restoredDate ? this._formatDate(e.restoredDate) : ""}
                                </uui-tag>
                            ` : ""}
                        </uui-table-cell>
                        <uui-table-cell>
                            <div style="display: flex; gap: 8px;">
                                <uui-button 
                                    look="secondary" 
                                    compact 
                                    href="${e.url}" 
                                    target="_blank">
                                    <uui-icon name="icon-download-alt"></uui-icon> Download
                                </uui-button>
                                <uui-button 
                                    look="primary" 
                                    color="positive"
                                    compact 
                                    @click="${() => this._restoreVersion(e)}">
                                    <uui-icon name="icon-refresh"></uui-icon> Restore
                                </uui-button>
                            </div>
                        </uui-table-cell>
                    </uui-table-row>
                `)}
            </uui-table>
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
s.styles = d`
        :host {
            display: block;
            margin-bottom: 20px;
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
    `;
l([
  c()
], s.prototype, "_versions", 2);
l([
  c()
], s.prototype, "_loading", 2);
l([
  c()
], s.prototype, "_mediaKey", 2);
s = l([
  p("snapshot-viewer")
], s);
export {
  s as SnapshotViewerElement
};
//# sourceMappingURL=umbraco-media-snapshot.js.map
