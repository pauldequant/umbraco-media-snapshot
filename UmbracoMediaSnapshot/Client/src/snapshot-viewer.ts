import { LitElement, html, css, customElement, state } from '@umbraco-cms/backoffice/external/lit';
import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import { UMB_WORKSPACE_CONTEXT } from '@umbraco-cms/backoffice/workspace';
import { UMB_AUTH_CONTEXT } from '@umbraco-cms/backoffice/auth'; // Import Auth Context
import type { UmbEntityWorkspaceContext } from '@umbraco-cms/backoffice/workspace';

/**
 * Snapshot Viewer Property Editor
 * Displays a list of file versions from the umbraco-snapshots Azure container
 */
@customElement('snapshot-viewer')
export class SnapshotViewerElement extends UmbElementMixin(LitElement) {

    @state()
    private _versions: any[] = [];

    @state()
    private _loading = true;

    @state()
    private _mediaKey = '';

    private _authContext?: typeof UMB_AUTH_CONTEXT.TYPE;

    constructor() {
        super();

        // 1. Consume the Auth Context to manage tokens
        this.consumeContext(UMB_AUTH_CONTEXT, (instance) => {
            this._authContext = instance;
        });

        this.consumeContext(UMB_WORKSPACE_CONTEXT, (workspaceContext) => {
            const entityWorkspace = workspaceContext as unknown as UmbEntityWorkspaceContext;
            if (entityWorkspace.unique) {
                this.observe(entityWorkspace.unique, (unique) => {
                    if (unique && unique !== this._mediaKey) {
                        this._mediaKey = unique.toString();
                        this._fetchVersions(this._mediaKey);
                    }
                });
            }
        });
    }

    /**
     * Calls the C# Management API to get the list of blobs
     * Umbraco 17 automatically injects Auth Bearer tokens into fetch 
     * requests starting with /umbraco/management/api/
     */
    private async _fetchVersions(mediaKey: string) {
        this._loading = true;

        // 2. Get the latest token from the auth context
        const token = await this._authContext?.getLatestToken();

        if (!token) {
            console.error("No authentication token available.");
            this._loading = false;
            return;
        }

        try {
            const url = `/umbraco/management/api/v1/snapshot/versions/${mediaKey}`;

            // 3. Manually add the Authorization header
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this._versions = await response.json();
            } else if (response.status === 401) {
                console.error("Unauthorized: The session may have expired.");
            }
        } catch (error) {
            console.error("Failed to fetch snapshots:", error);
        } finally {
            this._loading = false;
        }
    }

    /**
     * Restores a specific snapshot version as the current file
     */
    private async _restoreVersion(version: any) {
        const confirmed = confirm(
            `Are you sure you want to restore "${version.name}"?\n\n` +
            `This will replace the current file and create a new snapshot. This action cannot be undone.`
        );

        if (!confirmed) return;

        const token = await this._authContext?.getLatestToken();
        if (!token) {
            console.error("No authentication token available.");
            return;
        }

        try {
            const url = `/umbraco/management/api/v1/snapshot/restore`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    mediaKey: this._mediaKey,
                    snapshotName: version.name
                })
            });

            if (response.ok) {
                const result = await response.json();
                alert(`✓ ${result.message}`);
                
                // Refresh the version list
                await this._fetchVersions(this._mediaKey);
            } else if (response.status === 401) {
                alert("Unauthorized: Your session may have expired. Please refresh the page.");
            } else {
                const error = await response.json();
                alert(`Failed to restore: ${error.detail || 'Unknown error'}`);
            }
        } catch (error) {
            console.error("Failed to restore snapshot:", error);
            alert("An error occurred while restoring the snapshot. Please try again.");
        }
    }

    render() {
        if (this._loading) {
            return html`<div class="loader"><uui-loader></uui-loader> Fetching snapshots...</div>`;
        }

        if (this._versions.length === 0) {
            return html`
                <uui-box>
                    <div style="display: flex; align-items: center; gap: var(--uui-size-space-3);">
                        <uui-icon name="info" style="color: var(--uui-color-primary);"></uui-icon>
                        <span>No previous versions found in the snapshots container.</span>
                    </div>
                </uui-box>
            `;
        }

        return html`
            <uui-table>
                <uui-table-head>
                    <uui-table-head-cell>Version Filename</uui-table-head-cell>
                    <uui-table-head-cell>Date Uploaded</uui-table-head-cell>
                    <uui-table-cell>Uploaded By</uui-table-cell>
                    <uui-table-head-cell>Status</uui-table-head-cell>
                    <uui-table-head-cell>Actions</uui-table-head-cell>
                </uui-table-head>

                ${this._versions.map(v => html`
                    <uui-table-row>
                        <uui-table-cell>${v.name}</uui-table-cell>
                        <uui-table-cell>${this._formatDate(v.date)}</uui-table-cell>
                        <uui-table-cell>${v.uploader.replace(/_/g, ' ')}</uui-table-cell>
                        <uui-table-cell>
                            ${v.isRestored ? html`
                                <uui-tag look="primary" color="positive">
                                    <uui-icon name="refresh"></uui-icon>
                                    Restored ${v.restoredDate ? this._formatDate(v.restoredDate) : ''}
                                </uui-tag>
                            ` : ''}
                        </uui-table-cell>
                        <uui-table-cell>
                            <div style="display: flex; gap: 8px;">
                                <uui-button 
                                    look="secondary" 
                                    compact 
                                    href="${v.url}" 
                                    target="_blank">
                                    <uui-icon name="icon-download-alt"></uui-icon> Download
                                </uui-button>
                                <uui-button 
                                    look="primary" 
                                    color="positive"
                                    compact 
                                    @click="${() => this._restoreVersion(v)}">
                                    <uui-icon name="icon-refresh"></uui-icon> Restore
                                </uui-button>
                            </div>
                        </uui-table-cell>
                    </uui-table-row>
                `)}
            </uui-table>
        `;
    }

    private _formatDate(dateString: string) {
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    static styles = css`
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
}

// Global declaration for TS intellisense
declare global {
    interface HTMLElementTagNameMap {
        'snapshot-viewer': SnapshotViewerElement;
    }
}