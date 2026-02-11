import { LitElement, html, css, customElement, state } from '@umbraco-cms/backoffice/external/lit';
import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import { UMB_WORKSPACE_CONTEXT } from '@umbraco-cms/backoffice/workspace';
import { UMB_AUTH_CONTEXT } from '@umbraco-cms/backoffice/auth';
import { UMB_NOTIFICATION_CONTEXT } from '@umbraco-cms/backoffice/notification';
import { UMB_MODAL_MANAGER_CONTEXT } from '@umbraco-cms/backoffice/modal';
import { UMB_CONFIRM_MODAL } from '@umbraco-cms/backoffice/modal';
import type { UmbEntityWorkspaceContext } from '@umbraco-cms/backoffice/workspace';
import type { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import type { UmbModalManagerContext } from '@umbraco-cms/backoffice/modal';

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

    @state()
    private _previewImageUrl: string | null = null;

    @state()
    private _previewImageName: string = '';

    @state()
    private _showPreview = false;

    @state()
    private _isRestoring = false;

    @state()
    private _currentPage = 1;

    private _pageSize = 10;

    private _authContext?: typeof UMB_AUTH_CONTEXT.TYPE;
    private _notificationContext?: UmbNotificationContext;
    private _modalManagerContext?: UmbModalManagerContext;

    constructor() {
        super();

        // 1. Consume the Auth Context to manage tokens
        this.consumeContext(UMB_AUTH_CONTEXT, (instance) => {
            this._authContext = instance;
        });

        // Consume the Notification Context
        this.consumeContext(UMB_NOTIFICATION_CONTEXT, (instance) => {
            this._notificationContext = instance;
        });

        // Consume the Modal Manager Context
        this.consumeContext(UMB_MODAL_MANAGER_CONTEXT, (instance) => {
            this._modalManagerContext = instance;
        });

        this.consumeContext(UMB_WORKSPACE_CONTEXT, (workspaceContext) => {
            const entityWorkspace = workspaceContext as unknown as UmbEntityWorkspaceContext;
            if (entityWorkspace.unique) {
                this.observe(entityWorkspace.unique, (unique) => {
                    if (unique && unique !== this._mediaKey) {
                        this._mediaKey = unique.toString();
                        this._currentPage = 1;
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
            this._notificationContext?.peek('danger', { 
                data: { headline: 'Authentication Error', message: 'No authentication token available.' } 
            });
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
                this._notificationContext?.peek('danger', { 
                    data: { headline: 'Unauthorized', message: 'The session may have expired.' } 
                });
            }
        } catch (error) {
            console.error("Failed to fetch snapshots:", error);
            this._notificationContext?.peek('danger', { 
                data: { headline: 'Error', message: 'Failed to fetch snapshots.' } 
            });
        } finally {
            this._loading = false;
        }
    }

    /**
     * Returns the total number of pages based on versions count and page size
     */
    private get _totalPages(): number {
        return Math.max(1, Math.ceil(this._versions.length / this._pageSize));
    }

    /**
     * Returns the versions for the current page
     */
    private get _pagedVersions(): any[] {
        const start = (this._currentPage - 1) * this._pageSize;
        return this._versions.slice(start, start + this._pageSize);
    }

    /**
     * Handles page change from the pagination component
     */
    private _onPageChange(event: Event) {
        const target = event.target as HTMLElement & { current: number };
        this._currentPage = target.current;
    }

    /**
     * Checks if a filename is an image based on extension
     */
    private _isImage(filename: string): boolean {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
        const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
        return imageExtensions.includes(extension);
    }

    /**
     * Opens the image preview panel
     */
    private _openImagePreview(version: any) {
        if (!this._isImage(version.name)) return;
        
        this._previewImageUrl = version.url;
        this._previewImageName = version.name;
        this._showPreview = true;
    }

    /**
     * Closes the image preview panel
     */
    private _closePreview() {
        this._showPreview = false;
        this._previewImageUrl = null;
        this._previewImageName = '';
    }

    /**
     * Restores a specific snapshot version as the current file
     */
    private async _restoreVersion(version: any) {
        // Prevent multiple simultaneous restore operations
        if (this._isRestoring) {
            console.warn("Restore already in progress");
            return;
        }

        if (!this._modalManagerContext) {
            console.error("Modal manager context not available");
            return;
        }

        // Show Umbraco-styled confirmation modal
        const modalHandler = this._modalManagerContext.open(this, UMB_CONFIRM_MODAL, {
            data: {
                headline: 'Restore File Version',
                content: html`
                    <p>Are you sure you want to restore <strong>"${version.name}"</strong>?</p>
                    <p>This will replace the current file and create a new snapshot.</p>
                    <uui-box>
                        <p style="margin: 0;">
                            <uui-icon name="icon-alert"></uui-icon>
                            <strong>Warning:</strong> This action cannot be undone.
                        </p>
                    </uui-box>
                `,
                color: 'danger',
                confirmLabel: 'Restore'
            }
        });

        // Wait for user to confirm or cancel
        try {
            await modalHandler.onSubmit();
        } catch {
            // User cancelled the modal
            return;
        }

        // Set the restoring flag
        this._isRestoring = true;

        const token = await this._authContext?.getLatestToken();
        if (!token) {
            this._notificationContext?.peek('danger', { 
                data: { headline: 'Authentication Error', message: 'No authentication token available.' } 
            });
            this._isRestoring = false;
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
                
                // Use Umbraco notification instead of alert
                this._notificationContext?.peek('positive', { 
                    data: { 
                        headline: 'Snapshot Restored', 
                        message: result.message 
                    } 
                });
                
                // Refresh the version list
                await this._fetchVersions(this._mediaKey);
            } else if (response.status === 401) {
                this._notificationContext?.peek('danger', { 
                    data: { 
                        headline: 'Unauthorized', 
                        message: 'Your session may have expired. Please refresh the page.' 
                    } 
                });
            } else {
                const error = await response.json();
                this._notificationContext?.peek('danger', { 
                    data: { 
                        headline: 'Restore Failed', 
                        message: error.detail || 'Unknown error' 
                    } 
                });
            }
        } catch (error) {
            console.error("Failed to restore snapshot:", error);
            this._notificationContext?.peek('danger', { 
                data: { 
                    headline: 'Error', 
                    message: 'An error occurred while restoring the snapshot. Please try again.' 
                } 
            });
        } finally {
            // Always reset the restoring flag
            this._isRestoring = false;
        }
    }

    /**
     * Renders the status tag for a snapshot version based on its metadata
     */
    private _renderStatus(version: any, index: number) {
        if (version.isRestored) {
            return html`
                <uui-tag look="primary" color="positive">
                    <uui-icon name="icon-refresh"></uui-icon>
                    Restored ${version.restoredDate ? this._formatDate(version.restoredDate) : ''}
                </uui-tag>
            `;
        }

        // The first item (index 0) in the sorted-by-date-descending list is the latest version
        if (index === 0) {
            return html`
                <uui-tag look="primary" color="default">
                    <uui-icon name="icon-check"></uui-icon>
                    Latest
                </uui-tag>
            `;
        }

        return html`
            <uui-tag look="secondary" color="default">
                Original
            </uui-tag>
        `;
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

        const isSingleVersion = this._versions.length === 1;
        const pagedVersions = this._pagedVersions;
        const pageOffset = (this._currentPage - 1) * this._pageSize;

        return html`
            <div class="snapshot-container">
                <uui-table>
                    <uui-table-head>
                        <uui-table-head-cell>Version Filename</uui-table-head-cell>
                        <uui-table-head-cell>Date Uploaded</uui-table-head-cell>
                        <uui-table-head-cell>Uploaded By</uui-table-head-cell>
                        <uui-table-head-cell>Status</uui-table-head-cell>
                        <uui-table-head-cell>Actions</uui-table-head-cell>
                    </uui-table-head>

                    ${pagedVersions.map((v, i) => html`
                        <uui-table-row>
                            <uui-table-cell>
                                ${this._isImage(v.name) 
                                    ? html`
                                        <button 
                                            class="filename-link" 
                                            @click="${() => this._openImagePreview(v)}"
                                            title="Click to preview image">
                                            <uui-icon name="icon-picture"></uui-icon>
                                            ${v.name}
                                        </button>
                                    `
                                    : html`<span>${v.name}</span>`
                                }
                            </uui-table-cell>
                            <uui-table-cell>${this._formatDate(v.date)}</uui-table-cell>
                            <uui-table-cell>${v.uploader.replace(/_/g, ' ')}</uui-table-cell>
                            <uui-table-cell>
                                ${this._renderStatus(v, pageOffset + i)}
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
                                        ?disabled="${isSingleVersion || this._isRestoring || (pageOffset + i) === 0}"
                                        title="${isSingleVersion ? 'Cannot restore when only one version exists' : (pageOffset + i) === 0 ? 'This is already the latest version' : 'Restore this version'}"
                                        @click="${() => this._restoreVersion(v)}">
                                        <uui-icon name="icon-refresh"></uui-icon> ${this._isRestoring ? 'Restoring...' : 'Restore'}
                                    </uui-button>
                                </div>
                            </uui-table-cell>
                        </uui-table-row>
                    `)}
                </uui-table>

                ${this._totalPages > 1 ? html`
                    <div class="pagination-container">
                        <uui-pagination
                            .current="${this._currentPage}"
                            .total="${this._totalPages}"
                            @change="${this._onPageChange}">
                        </uui-pagination>
                    </div>
                ` : ''}

                <!-- Image Preview Side Panel -->
                ${this._showPreview ? html`
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
                                ${this._previewImageUrl 
                                    ? html`
                                        <img 
                                            src="${this._previewImageUrl}" 
                                            alt="${this._previewImageName}"
                                            @error="${() => {
                                                this._notificationContext?.peek('warning', { 
                                                    data: { 
                                                        headline: 'Preview Error', 
                                                        message: 'Unable to load image preview' 
                                                    } 
                                                });
                                            }}"
                                        />
                                    `
                                    : html`<uui-loader></uui-loader>`
                                }
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
                ` : ''}
            </div>
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
}

// Global declaration for TS intellisense
declare global {
    interface HTMLElementTagNameMap {
        'snapshot-viewer': SnapshotViewerElement;
    }
}