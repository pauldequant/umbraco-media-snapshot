# Umbraco Media Snapshot

[![NuGet](https://img.shields.io/nuget/v/UmbracoMediaSnapshot)](https://www.nuget.org/packages/UmbracoMediaSnapshot)
[![Umbraco Marketplace](https://img.shields.io/badge/Umbraco-Marketplace-blue)](https://marketplace.umbraco.com)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](LICENSE)

Umbraco Media Snapshot adds automatic file version history to Umbraco, backed by Azure Blob Storage. Every time an editor uploads a new file to a media item, the previous version is archived to a dedicated `umbraco-snapshots` container. Editors can browse, compare, restore, annotate, and download any previous version directly from the backoffice.

## Features

### Automatic Snapshotting
- **Copy-on-write archiving** — when a media file is replaced, the outgoing version is automatically copied to the `umbraco-snapshots` blob container before the new file is saved
- **First-upload capture** — the initial file upload is also snapshotted, so every version is preserved from day one
- **Duplicate detection** — if the file hasn't changed (same name + size), no redundant snapshot is created
- **Uploader tracking** — each snapshot records who uploaded it and when

### File Version History Editor
A **File Version History** property editor is automatically added to all supported media types. For each media item it provides:

- **Version table** — paginated list of all snapshots showing filename, upload date, uploader, status badges (Latest / Restored), and user notes
- **Inline summary stats** — snapshot count, total storage used, date range, and contributor count
- **One-click restore** — restores any previous version as the current file, with confirmation dialog and concurrency protection
- **File preview panel** — side panel with rich previews for images, video, audio, PDF, and SVG files
- **Visual comparison** — side-by-side or slider overlay comparison of any snapshot against the current file, with metadata diff table
- **Snapshot notes** — inline editable labels on each snapshot, stored as blob metadata
- **Bulk operations** — multi-select with bulk delete, select-all per page
- **Single delete** — remove individual snapshots with confirmation
- **Download** — direct download via time-limited SAS URLs

### Snapshot Storage Dashboard
A **Snapshot Storage** dashboard in the Media section provides a global overview:

- **Summary cards** — total snapshot count, total storage used, media items with snapshots, average snapshots per media
- **Top consumers table** — the 10 largest media folders ranked by storage, with clickable links to each media item in the backoffice
- **Orphan detection** — folders that no longer map to a media item are flagged as "Orphaned"
- **Active configuration** — displays current settings, tracked media types, and cleanup status

### Health Check
A built-in Umbraco Health Check (**Settings → Health Check → Media**) verifies:

- Azure Blob Storage connectivity
- Snapshot container existence and read permissions
- Media container accessibility
- SAS token generation capability
- Configuration validation (warns about unlimited retention, disabled cleanup, etc.)

### Automatic Cleanup
Configurable retention policies automatically delete old snapshots:

- **Max snapshots per media** — keeps the N most recent versions
- **Max snapshot age** — deletes versions older than X days
- **Background scheduling** — cleanup runs as a recurring background task on a configurable interval (default: every 60 minutes), keeping media saves fast and responsive

### Configurable Media Types
The 6 built-in Umbraco media types are tracked by default. Custom media types can be added via configuration, and the `fileVersionHistory` property is automatically added to them on application startup.

### Concurrency Protection
Server-side per-media-item locking prevents race conditions when two editors attempt to restore different snapshots for the same media item simultaneously.

## Requirements

- Umbraco CMS 17+
- .NET 10+
- Azure Blob Storage (used for both Umbraco media and snapshot storage)

## Installation

The package will automatically:

1. Create the **Media Snapshot** data type
2. Add the **File Version History** property to all supported media types
3. Register the snapshot notification handlers and storage dashboard

No manual configuration is required for default behaviour.

## Configuration

Add this section to `appsettings.json` to customize behaviour:

```json
{
  "UmbracoMediaSnapshot": {
    "MaxSnapshotsPerMedia": 10,
    "MaxSnapshotAgeDays": 365,
    "SasTokenExpirationHours": 1,
    "EnableAutomaticCleanup": true,
    "AdditionalMediaTypes": []
  }
}
```

### Settings Reference

| Setting | Default | Description |
|---------|---------|-------------|
| `MaxSnapshotsPerMedia` | `10` | Maximum versions to keep per media item. `0` = unlimited. |
| `MaxSnapshotAgeDays` | `365` | Delete snapshots older than this many days. `0` = never expire. |
| `SasTokenExpirationHours` | `1` | How long download/preview links remain valid. |
| `EnableAutomaticCleanup` | `true` | Automatically delete old snapshots based on the limits above. |
| `CleanupIntervalMinutes` | `60` | How often the background cleanup task runs (in minutes). Minimum: 1. |
| `AdditionalMediaTypes` | `[]` | Extra media type aliases to track (e.g. `["productImage", "brandAsset"]`). Built-in types are always included. |

### Built-in Media Types

These are always tracked regardless of configuration:

- `Image`
- `File`
- `umbracoMediaArticle`
- `umbracoMediaAudio`
- `umbracoMediaVectorGraphics`
- `umbracoMediaVideo`

## Azure Storage Prerequisite

This package requires Azure Blob Storage to be configured for Umbraco media. Ensure your `appsettings.json` includes:
```json
{
  "Umbraco": {
    "Storage": {
      "AzureBlob": {
        "Media": {
          "ConnectionString": "DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net",
          "ContainerName": "umbraco"
        }
      }
    }
  }
}
```

The package creates the `umbraco-snapshots` container automatically on first use.

> [!WARNING]
> **Azure Storage costs** — This package stores a full copy of each media file version in Azure Blob Storage. Snapshot storage will grow proportionally with the number and size of media files uploaded, and the retention limits configured. Sites with frequent media updates, large files (video, high-resolution images), or permissive retention settings (`MaxSnapshotsPerMedia: 0`, `MaxSnapshotAgeDays: 0`) can accumulate significant storage over time.
>
> **To manage costs, we recommend:**
> - Setting `EnableAutomaticCleanup` to `true` (the default)
> - Keeping `MaxSnapshotsPerMedia` at a reasonable limit (default: 10)
> - Setting `MaxSnapshotAgeDays` to match your organisation's retention requirements
> - Monitoring usage via the **Snapshot Storage** dashboard in the Media section
> - Considering [Azure Blob Storage lifecycle management policies](https://learn.microsoft.com/en-us/azure/storage/blobs/lifecycle-management-overview) to move older snapshots to Cool or Archive tiers automatically
>
> As a rough guide: a site with 500 media items averaging 2 MB each, retaining 10 snapshots per item, would use approximately **10 GB** of snapshot storage.

## File Preview Support

The preview panel renders different elements depending on file type:

| Type | Extensions | Preview |
|------|-----------|---------|
| Image | `.jpg` `.jpeg` `.png` `.gif` `.bmp` `.webp` | `<img>` with zoom |
| SVG | `.svg` | Native `<img>` rendering |
| Video | `.mp4` `.webm` `.ogg` `.mov` | `<video>` with playback controls |
| Audio | `.mp3` `.wav` `.ogg` `.aac` `.flac` `.m4a` | `<audio>` with playback controls |
| PDF | `.pdf` | `<iframe>` embedded viewer |
| Other | — | Download only |

