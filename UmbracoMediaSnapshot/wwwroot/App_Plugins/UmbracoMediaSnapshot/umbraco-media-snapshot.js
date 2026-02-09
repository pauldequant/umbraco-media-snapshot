import { LitElement as d, html as l, css as h, state as c, customElement as p } from "@umbraco-cms/backoffice/external/lit";
import { UmbElementMixin as b } from "@umbraco-cms/backoffice/element-api";
import { UMB_WORKSPACE_CONTEXT as m } from "@umbraco-cms/backoffice/workspace";
import { UMB_AUTH_CONTEXT as _ } from "@umbraco-cms/backoffice/auth";
var f = Object.defineProperty, g = Object.getOwnPropertyDescriptor, u = (e, t, i, o) => {
  for (var a = o > 1 ? void 0 : o ? g(t, i) : t, s = e.length - 1, n; s >= 0; s--)
    (n = e[s]) && (a = (o ? n(t, i, a) : n(a)) || a);
  return o && a && f(t, i, a), a;
};
let r = class extends b(d) {
  constructor() {
    super(), this._versions = [], this._loading = !0, this._mediaKey = "", this.consumeContext(_, (e) => {
      this._authContext = e;
    }), this.consumeContext(m, (e) => {
      const t = e;
      t.unique && this.observe(t.unique, (i) => {
        i && i !== this._mediaKey && (this._mediaKey = i.toString(), this._fetchVersions(this._mediaKey));
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
      console.error("No authentication token available."), this._loading = !1;
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
      o.ok ? this._versions = await o.json() : o.status === 401 && console.error("Unauthorized: The session may have expired.");
    } catch (i) {
      console.error("Failed to fetch snapshots:", i);
    } finally {
      this._loading = !1;
    }
  }
  render() {
    return this._loading ? l`<div class="loader"><uui-loader></uui-loader> Fetching snapshots...</div>` : this._versions.length === 0 ? l`
                <uui-box>
                    <uui-tag look="placeholder">No previous versions found in the snapshots container.</uui-tag>
                </uui-box>
            ` : l`
                <uui-table>
                    <uui-table-head>
                        <uui-table-head-cell>Version Filename</uui-table-head-cell>
                        <uui-table-head-cell>Date Uploaded</uui-table-head-cell>
                        <uui-table-cell>Uploaded By</uui-table-cell>
                        <uui-table-head-cell>Action</uui-table-head-cell>
                    </uui-table-head>

                    ${this._versions.map((e) => l`
                        <uui-table-row>
                            <uui-table-cell>${e.name}</uui-table-cell>
                            <uui-table-cell>${this._formatDate(e.date)}</uui-table-cell>
                            <uui-table-cell>${e.uploader.replace(/_/g, " ")}</uui-table-cell>
                            <uui-table-cell>
                                <uui-button 
                                    look="secondary" 
                                    compact 
                                    href="${e.url}" 
                                    target="_blank">
                                    <uui-icon name="download"></uui-icon> Download
                                </uui-button>
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
r.styles = h`
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
u([
  c()
], r.prototype, "_versions", 2);
u([
  c()
], r.prototype, "_loading", 2);
u([
  c()
], r.prototype, "_mediaKey", 2);
r = u([
  p("snapshot-viewer")
], r);
export {
  r as SnapshotViewerElement
};
//# sourceMappingURL=umbraco-media-snapshot.js.map
