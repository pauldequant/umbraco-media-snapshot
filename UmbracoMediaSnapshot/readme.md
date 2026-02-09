# Umbraco Media Snapshot

Umbraco Media Snapshot is an Umbraco package that adds lightweight version-history support to common media types, making it easier to track and review changes to uploaded files over time.

## What it does

On installation (or upgrade), the package runs an automated migration that:

- Creates (or reuses) a custom data type named **Media Snapshot**
- Adds a new property, `fileVersionHistory` (shown as **File Version History**), to selected built-in/media-related types:
  - `Image`
  - `File`
  - `umbracoMediaArticle`
  - `umbracoMediaAudio`
  - `umbracoMediaVectorGraphics`
  - `umbracoMediaVideo`
- Automatically places the property into the most appropriate tab/group for each media type (for example, `Image` items get it under the **Image** group)

This provides a consistent place to store and display historical metadata for media files without requiring manual document type changes. The migration is safe to re-run (it skips types where the property already exists).

## Requirements

- Umbraco CMS version 17 or higher
- .NET 10 or higher
- Azure Blob Storage