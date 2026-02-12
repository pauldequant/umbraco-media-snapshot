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

    // --- Comparison state ---
    @state()
    private _showComparison = false;

    @state()
    private _comparisonSnapshot: any = null;

    @state()
    private _comparisonCurrent: any = null;

    @state()
    private _comparisonLoading = false;

    @state()
    private _comparisonMode: 'side-by-side' | 'slider' = 'side-by-side';

    @state()
    private _sliderPosition = 50;

    // --- Delete / selection state ---
    @state()
    private _selectedSnapshots: Set<string> = new Set();

    @state()
    private _isDeleting = false;

    // --- Note editing state ---
    @state()
    private _editingNoteName: string | null = null;

    @state()
    private _editingNoteValue: string = '';

    @state()
    private _savingNote = false;

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
                // Clear selection when versions are refreshed
                this._selectedSnapshots = new Set();
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
     * Fetches the current (live) media file metadata and SAS URL
     */
    private async _fetchCurrentMedia(): Promise<any | null> {
        const token = await this._authContext?.getLatestToken();
        if (!token) return null;

        try {
            const url = `/umbraco/management/api/v1/snapshot/current/${this._mediaKey}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error("Failed to fetch current media:", error);
        }
        return null;
    }

    /**
     * Opens the comparison panel for a specific snapshot version
     */
    private async _openComparison(snapshotVersion: any) {
        this._comparisonLoading = true;
        this._comparisonSnapshot = snapshotVersion;
        this._showComparison = true;
        this._sliderPosition = 50;

        const currentMedia = await this._fetchCurrentMedia();
        this._comparisonCurrent = currentMedia;
        this._comparisonLoading = false;
    }

    /**
     * Closes the comparison panel
     */
    private _closeComparison() {
        this._showComparison = false;
        this._comparisonSnapshot = null;
        this._comparisonCurrent = null;
    }

    /**
     * Toggles the comparison mode between side-by-side and slider
     */
    private _toggleComparisonMode() {
        this._comparisonMode = this._comparisonMode === 'side-by-side' ? 'slider' : 'side-by-side';
    }

    /**
     * Handles the slider input for overlay comparison
     */
    private _onSliderInput(e: Event) {
        const input = e.target as HTMLInputElement;
        this._sliderPosition = parseInt(input.value, 10);
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

    // --- Selection helpers ---

    /**
     * Toggles a single snapshot's selection state
     */
    private _toggleSelection(name: string) {
        const updated = new Set(this._selectedSnapshots);
        if (updated.has(name)) {
            updated.delete(name);
        } else {
            updated.add(name);
        }
        this._selectedSnapshots = updated;
    }

    /**
     * Toggles select-all for the current page (excluding the latest version at index 0)
     */
    private _toggleSelectAll() {
        const pageOffset = (this._currentPage - 1) * this._pageSize;
        const selectableOnPage = this._pagedVersions
            .filter((_, i) => (pageOffset + i) !== 0)
            .map(v => v.name);

        const allSelected = selectableOnPage.every(name => this._selectedSnapshots.has(name));
        const updated = new Set(this._selectedSnapshots);

        if (allSelected) {
            // Deselect all on this page
            selectableOnPage.forEach(name => updated.delete(name));
        } else {
            // Select all on this page
            selectableOnPage.forEach(name => updated.add(name));
        }

        this._selectedSnapshots = updated;
    }

    /**
     * Whether all selectable items on the current page are selected
     */
    private get _allPageSelected(): boolean {
        const pageOffset = (this._currentPage - 1) * this._pageSize;
        const selectableOnPage = this._pagedVersions
            .filter((_, i) => (pageOffset + i) !== 0);
        return selectableOnPage.length > 0
            && selectableOnPage.every(v => this._selectedSnapshots.has(v.name));
    }

    /**
     * Clears all selections
     */
    private _clearSelection() {
        this._selectedSnapshots = new Set();
    }

    // --- Delete operations ---

    /**
     * Deletes a single snapshot after confirmation
     */
    private async _deleteSnapshot(version: any) {
        if (this._isDeleting) return;

        if (!this._modalManagerContext) {
            console.error("Modal manager context not available");
            return;
        }

        const modalHandler = this._modalManagerContext.open(this, UMB_CONFIRM_MODAL, {
            data: {
                headline: 'Delete Snapshot',
                content: html`
                    <p>Are you sure you want to permanently delete <strong>"${version.name}"</strong>?</p>
                    <uui-box>
                        <p style="margin: 0;">
                            <uui-icon name="icon-alert"></uui-icon>
                            <strong>Warning:</strong> This action cannot be undone. The snapshot will be permanently removed from storage.
                        </p>
                    </uui-box>
                `,
                color: 'danger',
                confirmLabel: 'Delete'
            }
        });

        try {
            await modalHandler.onSubmit();
        } catch {
            return;
        }

        this._isDeleting = true;

        const token = await this._authContext?.getLatestToken();
        if (!token) {
            this._notificationContext?.peek('danger', { 
                data: { headline: 'Authentication Error', message: 'No authentication token available.' } 
            });
            this._isDeleting = false;
            return;
        }

        try {
            const response = await fetch(`/umbraco/management/api/v1/snapshot/delete`, {
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
                this._notificationContext?.peek('positive', { 
                    data: { headline: 'Snapshot Deleted', message: result.message } 
                });
                await this._fetchVersions(this._mediaKey);
            } else if (response.status === 401) {
                this._notificationContext?.peek('danger', { 
                    data: { headline: 'Unauthorized', message: 'Your session may have expired. Please refresh the page.' } 
                });
            } else {
                const error = await response.json();
                this._notificationContext?.peek('danger', { 
                    data: { headline: 'Delete Failed', message: error.detail || 'Unknown error' } 
                });
            }
        } catch (error) {
            console.error("Failed to delete snapshot:", error);
            this._notificationContext?.peek('danger', { 
                data: { headline: 'Error', message: 'An error occurred while deleting the snapshot.' } 
            });
        } finally {
            this._isDeleting = false;
        }
    }

    /**
     * Deletes all selected snapshots after confirmation
     */
    private async _bulkDeleteSnapshots() {
        if (this._isDeleting || this._selectedSnapshots.size === 0) return;

        if (!this._modalManagerContext) {
            console.error("Modal manager context not available");
            return;
        }

        const count = this._selectedSnapshots.size;
        const modalHandler = this._modalManagerContext.open(this, UMB_CONFIRM_MODAL, {
            data: {
                headline: 'Delete Selected Snapshots',
                content: html`
                    <p>Are you sure you want to permanently delete <strong>${count} snapshot${count > 1 ? 's' : ''}</strong>?</p>
                    <uui-box>
                        <p style="margin: 0;">
                            <uui-icon name="icon-alert"></uui-icon>
                            <strong>Warning:</strong> This action cannot be undone. All selected snapshots will be permanently removed from storage.
                        </p>
                    </uui-box>
                `,
                color: 'danger',
                confirmLabel: `Delete ${count} Snapshot${count > 1 ? 's' : ''}`
            }
        });

        try {
            await modalHandler.onSubmit();
        } catch {
            return;
        }

        this._isDeleting = true;

        const token = await this._authContext?.getLatestToken();
        if (!token) {
            this._notificationContext?.peek('danger', { 
                data: { headline: 'Authentication Error', message: 'No authentication token available.' } 
            });
            this._isDeleting = false;
            return;
        }

        try {
            const response = await fetch(`/umbraco/management/api/v1/snapshot/delete-bulk`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    mediaKey: this._mediaKey,
                    snapshotNames: Array.from(this._selectedSnapshots)
                })
            });

            if (response.ok) {
                const result = await response.json();
                this._notificationContext?.peek('positive', { 
                    data: { headline: 'Snapshots Deleted', message: result.message } 
                });
                await this._fetchVersions(this._mediaKey);
            } else if (response.status === 401) {
                this._notificationContext?.peek('danger', { 
                    data: { headline: 'Unauthorized', message: 'Your session may have expired. Please refresh the page.' } 
                });
            } else {
                const error = await response.json();
                this._notificationContext?.peek('danger', { 
                    data: { headline: 'Bulk Delete Failed', message: error.detail || 'Unknown error' } 
                });
            }
        } catch (error) {
            console.error("Failed to bulk delete snapshots:", error);
            this._notificationContext?.peek('danger', { 
                data: { headline: 'Error', message: 'An error occurred while deleting snapshots.' } 
            });
        } finally {
            this._isDeleting = false;
        }
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
     * Formats a byte count into a human-readable size string
     */
    private _formatSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
    }

    /**
     * Renders a compact inline status badge for a snapshot version
     */
    private _renderStatus(version: any, index: number) {
        if (version.isRestored) {
            return html`<uui-tag class="status-badge" look="primary" color="positive">Restored</uui-tag>`;
        }
        if (index === 0) {
            return html`<uui-tag class="status-badge" look="primary" color="default">Latest</uui-tag>`;
        }
        return html``;
    }

    /**
     * Renders the comparison panel content
     */
    private _renderComparison() {
        if (!this._showComparison) return '';

        const snapshot = this._comparisonSnapshot;
        const current = this._comparisonCurrent;
        const bothAreImages = snapshot && current
            && this._isImage(snapshot.name) && this._isImage(current.name);

        return html`
            <div class="preview-overlay" @click="${this._closeComparison}"></div>
            <div class="comparison-panel">
                <div class="preview-header">
                    <h3>
                        <uui-icon name="icon-split"></uui-icon>
                        Compare Versions
                    </h3>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${bothAreImages ? html`
                            <uui-button
                                look="secondary"
                                compact
                                @click="${this._toggleComparisonMode}"
                                title="Toggle comparison mode">
                                <uui-icon name="${this._comparisonMode === 'side-by-side' ? 'icon-layers-alt' : 'icon-split'}"></uui-icon>
                                ${this._comparisonMode === 'side-by-side' ? 'Slider' : 'Side-by-Side'}
                            </uui-button>
                        ` : ''}
                        <uui-button
                            look="secondary"
                            compact
                            @click="${this._closeComparison}">
                            <uui-icon name="icon-delete"></uui-icon>
                        </uui-button>
                    </div>
                </div>
                <div class="comparison-content">
                    ${this._comparisonLoading
                        ? html`<div class="loader"><uui-loader></uui-loader> Loading current file...</div>`
                        : !current
                            ? html`<uui-box><p>Unable to load the current media file for comparison.</p></uui-box>`
                            : bothAreImages
                                ? this._renderImageComparison(current, snapshot)
                                : this._renderMetadataComparison(current, snapshot)
                    }
                </div>
            </div>
        `;
    }

    /**
     * Renders a side-by-side or slider image comparison
     */
    private _renderImageComparison(current: any, snapshot: any) {
        if (this._comparisonMode === 'slider') {
            return html`
                <div class="slider-comparison">
                    <div class="slider-container">
                        <img class="slider-img-under" src="${current.url}" alt="Current" />
                        <div class="slider-img-over" style="width: ${this._sliderPosition}%;">
                            <img src="${snapshot.url}" alt="Snapshot" />
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
                        <span><uui-tag look="primary" color="default">Snapshot</uui-tag> ${snapshot.name}</span>
                        <span><uui-tag look="primary" color="positive">Current</uui-tag> ${current.name}</span>
                    </div>
                </div>
                ${this._renderMetadataComparison(current, snapshot)}
            `;
        }

        return html`
            <div class="side-by-side">
                <div class="compare-column">
                    <div class="compare-label">
                        <uui-tag look="primary" color="default">Snapshot</uui-tag>
                        <span class="compare-filename">${snapshot.name}</span>
                    </div>
                    <div class="compare-image-container">
                        <img src="${snapshot.url}" alt="${snapshot.name}" />
                    </div>
                </div>
                <div class="compare-divider"></div>
                <div class="compare-column">
                    <div class="compare-label">
                        <uui-tag look="primary" color="positive">Current</uui-tag>
                        <span class="compare-filename">${current.name}</span>
                    </div>
                    <div class="compare-image-container">
                        <img src="${current.url}" alt="${current.name}" />
                    </div>
                </div>
            </div>
            ${this._renderMetadataComparison(current, snapshot)}
        `;
    }

    /**
     * Renders a metadata diff table comparing the snapshot and current file
     */
    private _renderMetadataComparison(current: any, snapshot: any) {
        const sizeDiff = current.size - snapshot.size;
        const sizeDiffLabel = sizeDiff > 0
            ? `+${this._formatSize(sizeDiff)}`
            : sizeDiff < 0
                ? `-${this._formatSize(Math.abs(sizeDiff))}`
                : 'No change';

        return html`
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
                        <uui-table-cell>${snapshot.name}</uui-table-cell>
                        <uui-table-cell>${current.name}</uui-table-cell>
                        <uui-table-cell>
                            ${snapshot.name === current.name
                                ? html`<uui-tag look="secondary" color="default">Same</uui-tag>`
                                : html`<uui-tag look="primary" color="warning">Changed</uui-tag>`
                            }
                        </uui-table-cell>
                    </uui-table-row>
                    <uui-table-row>
                        <uui-table-cell><strong>File Size</strong></uui-table-cell>
                        <uui-table-cell>${this._formatSize(snapshot.size)}</uui-table-cell>
                        <uui-table-cell>${this._formatSize(current.size)}</uui-table-cell>
                        <uui-table-cell>
                            <uui-tag look="secondary" color="${sizeDiff === 0 ? 'default' : sizeDiff > 0 ? 'warning' : 'positive'}">
                                ${sizeDiffLabel}
                            </uui-tag>
                        </uui-table-cell>
                    </uui-table-row>
                    <uui-table-row>
                        <uui-table-cell><strong>Date</strong></uui-table-cell>
                        <uui-table-cell>${this._formatDate(snapshot.date)}</uui-table-cell>
                        <uui-table-cell>${this._formatDate(current.lastModified)}</uui-table-cell>
                        <uui-table-cell></uui-table-cell>
                    </uui-table-row>
                    ${snapshot.uploader ? html`
                        <uui-table-row>
                            <uui-table-cell><strong>Uploaded By</strong></uui-table-cell>
                            <uui-table-cell>${snapshot.uploader.replace(/_/g, ' ')}</uui-table-cell>
                            <uui-table-cell>—</uui-table-cell>
                            <uui-table-cell></uui-table-cell>
                        </uui-table-row>
                    ` : ''}
                </uui-table>
            </div>
        `;
    }

    /**
     * Renders a compact summary stats strip for this media item's snapshots
     */
    private _renderStats() {
        if (this._versions.length === 0) return '';

        const totalSize = this._versions.reduce((sum, v) => sum + (v.size || 0), 0);
        const dates = this._versions.map(v => new Date(v.date).getTime()).filter(t => !isNaN(t));
        const oldestDate = dates.length > 0 ? new Date(Math.min(...dates)) : null;
        const newestDate = dates.length > 0 ? new Date(Math.max(...dates)) : null;
        const uniqueUploaders = new Set(this._versions.map(v => v.uploader).filter(Boolean));

        return html`
            <div class="stats-strip">
                <div class="stats-strip-item">
                    <uui-icon name="icon-documents"></uui-icon>
                    <span class="stats-strip-value">${this._versions.length}</span>
                    <span class="stats-strip-label">Snapshot${this._versions.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="stats-strip-divider"></div>
                <div class="stats-strip-item">
                    <uui-icon name="icon-server"></uui-icon>
                    <span class="stats-strip-value">${this._formatSize(totalSize)}</span>
                    <span class="stats-strip-label">Total Size</span>
                </div>
                <div class="stats-strip-divider"></div>
                <div class="stats-strip-item">
                    <uui-icon name="icon-calendar"></uui-icon>
                    <span class="stats-strip-value">${oldestDate ? this._formatDate(oldestDate.toISOString()) : '—'}</span>
                    <span class="stats-strip-label">Oldest</span>
                </div>
                <div class="stats-strip-divider"></div>
                <div class="stats-strip-item">
                    <uui-icon name="icon-calendar"></uui-icon>
                    <span class="stats-strip-value">${newestDate ? this._formatDate(newestDate.toISOString()) : '—'}</span>
                    <span class="stats-strip-label">Latest</span>
                </div>
                <div class="stats-strip-divider"></div>
                <div class="stats-strip-item">
                    <uui-icon name="icon-users"></uui-icon>
                    <span class="stats-strip-value">${uniqueUploaders.size}</span>
                    <span class="stats-strip-label">Contributor${uniqueUploaders.size !== 1 ? 's' : ''}</span>
                </div>
            </div>
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
        const hasSelection = this._selectedSnapshots.size > 0;

        return html`
            <div class="snapshot-container">

                <!-- Summary stats for this media item -->
                ${this._renderStats()}

                <!-- Bulk action toolbar -->
                ${hasSelection ? html`
                    <div class="bulk-toolbar">
                        <span class="bulk-toolbar-count">
                            <uui-icon name="icon-check"></uui-icon>
                            ${this._selectedSnapshots.size} snapshot${this._selectedSnapshots.size > 1 ? 's' : ''} selected
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
                                ${this._isDeleting ? 'Deleting...' : `Delete ${this._selectedSnapshots.size} Snapshot${this._selectedSnapshots.size > 1 ? 's' : ''}`}
                            </uui-button>
                        </div>
                    </div>
                ` : ''}

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

                    ${pagedVersions.map((v, i) => {
                        const globalIndex = pageOffset + i;
                        const isLatest = globalIndex === 0;
                        const isSelected = this._selectedSnapshots.has(v.name);

                        return html`
                            <uui-table-row class="${isSelected ? 'row-selected' : ''}">
                                <uui-table-cell style="width: 40px;">
                                    <input
                                        type="checkbox"
                                        .checked="${isSelected}"
                                        ?disabled="${isLatest}"
                                        @change="${() => this._toggleSelection(v.name)}"
                                        title="${isLatest ? 'Cannot select the latest version' : 'Select this snapshot'}"
                                        class="select-checkbox"
                                    />
                                </uui-table-cell>

                                <!-- Version: filename + status badge + note -->
                                <uui-table-cell>
                                    <div class="version-cell">
                                        <div class="version-cell-primary">
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
                                                : html`<span class="filename-text">${v.name}</span>`
                                            }
                                            ${this._renderStatus(v, globalIndex)}
                                        </div>
                                        <div class="version-cell-secondary">
                                            ${this._renderNoteCell(v)}
                                        </div>
                                    </div>
                                </uui-table-cell>

                                <!-- Uploaded: date + uploader stacked -->
                                <uui-table-cell>
                                    <div class="upload-cell">
                                        <span class="upload-date">${this._formatDate(v.date)}</span>
                                        <span class="upload-user">${v.uploader.replace(/_/g, ' ')}</span>
                                    </div>
                                </uui-table-cell>

                                <!-- Actions: icon-only buttons -->
                                <uui-table-cell>
                                    <div class="actions-cell">
                                        <uui-button
                                            look="secondary"
                                            compact
                                            ?disabled="${isLatest}"
                                            title="${isLatest ? 'This is the latest version' : 'Compare with current file'}"
                                            @click="${() => this._openComparison(v)}">
                                            <uui-icon name="icon-split"></uui-icon>
                                        </uui-button>
                                        <uui-button
                                            look="secondary"
                                            compact
                                            href="${v.url}"
                                            target="_blank"
                                            title="Download this version">
                                            <uui-icon name="icon-download-alt"></uui-icon>
                                        </uui-button>
                                        <uui-button
                                            look="primary"
                                            color="positive"
                                            compact
                                            ?disabled="${isSingleVersion || this._isRestoring || isLatest}"
                                            title="${isSingleVersion ? 'Cannot restore when only one version exists' : isLatest ? 'This is already the latest version' : 'Restore this version'}"
                                            @click="${() => this._restoreVersion(v)}">
                                            <uui-icon name="icon-refresh"></uui-icon>
                                        </uui-button>
                                        <uui-button
                                            look="secondary"
                                            color="danger"
                                            compact
                                            ?disabled="${isLatest || this._isDeleting}"
                                            title="${isLatest ? 'Cannot delete the latest version' : 'Delete this snapshot'}"
                                            @click="${() => this._deleteSnapshot(v)}">
                                            <uui-icon name="icon-trash"></uui-icon>
                                        </uui-button>
                                    </div>
                                </uui-table-cell>
                            </uui-table-row>
                        `;
                    })}
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

                <!-- Comparison Panel -->
                ${this._renderComparison()}
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

    // --- Note operations ---

    /**
     * Enters inline edit mode for a snapshot's note
     */
    private _startEditNote(version: any) {
        this._editingNoteName = version.name;
        this._editingNoteValue = version.note || '';
    }

    /**
     * Cancels note editing
     */
    private _cancelEditNote() {
        this._editingNoteName = null;
        this._editingNoteValue = '';
    }

    /**
     * Saves the note to the snapshot's blob metadata
     */
    private async _saveNote(version: any) {
        if (this._savingNote) return;

        this._savingNote = true;

        const token = await this._authContext?.getLatestToken();
        if (!token) {
            this._notificationContext?.peek('danger', {
                data: { headline: 'Authentication Error', message: 'No authentication token available.' }
            });
            this._savingNote = false;
            return;
        }

        try {
            const response = await fetch('/umbraco/management/api/v1/snapshot/update-note', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    mediaKey: this._mediaKey,
                    snapshotName: version.name,
                    note: this._editingNoteValue
                })
            });

            if (response.ok) {
                // Update the local version object so the UI reflects the change immediately
                version.note = this._editingNoteValue.trim() || null;
                this._editingNoteName = null;
                this._editingNoteValue = '';
                this.requestUpdate();
            } else {
                const error = await response.json();
                this._notificationContext?.peek('danger', {
                    data: { headline: 'Save Failed', message: error.detail || 'Failed to save note' }
                });
            }
        } catch (error) {
            console.error("Failed to save note:", error);
            this._notificationContext?.peek('danger', {
                data: { headline: 'Error', message: 'An error occurred while saving the note.' }
            });
        } finally {
            this._savingNote = false;
        }
    }

    /**
     * Handles keydown in the note input — Enter saves, Escape cancels
     */
    private _onNoteKeydown(e: KeyboardEvent, version: any) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this._saveNote(version);
        } else if (e.key === 'Escape') {
            this._cancelEditNote();
        }
    }

    /**
     * Renders the note cell for a snapshot row
     */
    private _renderNoteCell(version: any) {
        const isEditing = this._editingNoteName === version.name;

        if (isEditing) {
            return html`
                <div class="note-edit">
                    <input
                        type="text"
                        class="note-input"
                        maxlength="500"
                        placeholder="Add a note…"
                        .value="${this._editingNoteValue}"
                        @input="${(e: Event) => this._editingNoteValue = (e.target as HTMLInputElement).value}"
                        @keydown="${(e: KeyboardEvent) => this._onNoteKeydown(e, version)}"
                    />
                    <div class="note-edit-actions">
                        <uui-button
                            look="primary"
                            compact
                            ?disabled="${this._savingNote}"
                            @click="${() => this._saveNote(version)}">
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
            `;
        }

        if (version.note) {
            return html`
                <button class="note-display" @click="${() => this._startEditNote(version)}" title="Click to edit note">
                    <uui-icon name="icon-edit"></uui-icon>
                    <span class="note-text">${version.note}</span>
                </button>
            `;
        }

        return html`
            <button class="note-add" @click="${() => this._startEditNote(version)}" title="Add a note">
                <uui-icon name="icon-edit"></uui-icon> Add note
            </button>
        `;
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
}

// Global declaration for TS intellisense
declare global {
    interface HTMLElementTagNameMap {
        'snapshot-viewer': SnapshotViewerElement;
    }
}