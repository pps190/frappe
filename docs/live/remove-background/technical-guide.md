# FileUploader Remove Background Support — Technical Guide

**Last Updated**: 2026-04-06

## Overview

Extends Frappe's FileUploader component to support an optional background removal step during image upload. This is a generic framework feature — the actual background removal logic is provided by the calling app (e.g., pps190/next).

### Key design decisions

- **Opt-in via props** — no behavior change for existing callers. The toggle only appears when `show_remove_bg: true` is passed
- **Processing in ImageCropper** — background removal runs inside the crop interface where the user can preview and toggle the result before committing
- **Cached toggle** — once processed, switching between original and bg-removed versions is instant (no re-processing)
- **Reactive thumbnails** — FilePreview watches `file.file_obj` changes to update thumbnails when toggling

## Architecture

### Component hierarchy

```
FileUploader (index.js)
  ├── Creates dialog with footer toggle pill
  ├── Watches remove_bg_checked for footer sync
  │
  └── FileUploader.vue
        ├── Props: show_remove_bg, remove_bg_default
        ├── Data: remove_bg_checked
        ├── Watcher: remove_bg_checked → swaps file.file_obj via $set
        │
        ├── FilePreview.vue
        │     └── Watcher: file.file_obj → re-reads thumbnail
        │
        └── ImageCropper.vue
              ├── Props: show_remove_bg, remove_bg_checked
              ├── Toggle pill in cropper actions bar
              ├── Loading overlay during processing
              ├── do_remove_bg(): upload temp → call API → fetch result
              ├── Caches _original_file and _nobg_file on file object
              └── Emits remove_bg_changed → parent syncs state
```

### New props on FileUploader

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `show_remove_bg` | Boolean | `false` | Show the Remove Background toggle |
| `remove_bg_default` | Boolean | `true` | Initial checked state of the toggle |

These are passed through `index.js` constructor → Vue component props.

### Footer toggle (index.js)

When `show_remove_bg` is true, `add_remove_bg_toggle()` prepends a pill-shaped toggle to the dialog footer. It stays visible across all dialog states (file selection, preview, crop). Clicking it toggles `uploader.remove_bg_checked` and updates pill styling.

A `$watch` on `remove_bg_checked` keeps the footer toggle in sync when the ImageCropper changes the state.

### ImageCropper changes

The cropper now accepts `show_remove_bg` and `remove_bg_checked` props. On mount:

1. Caches the original file as `file._original_file`
2. Checks for a previously cached `file._nobg_file`
3. If `remove_bg_checked` and no cached result, calls `do_remove_bg()`

`do_remove_bg()` flow:
1. Shows loading overlay (spinner + text) over the image
2. Uploads original file to `/api/method/upload_file` (temporary)
3. Calls the background removal API (configured by the calling app — e.g., `next.utils.remove_bg.remove_background`)
4. Fetches the processed image as a blob
5. Creates a new File object, caches it as `file._nobg_file`
6. Updates `file.file_obj` and `file.cropper_file`
7. Reloads the CropperJS instance with the new image

The Crop button is disabled (`bg_processing`) while removal is in progress.

### FilePreview changes

Added a watcher on `file.file_obj` that re-reads the thumbnail via FileReader when the file object changes. This ensures the preview thumbnail updates when toggling between original and bg-removed versions from the footer toggle.

### FileUploader.vue changes

Added a watcher on `remove_bg_checked` that iterates over `this.files` and swaps `file.file_obj` and `file.cropper_file` between `_original_file` and `_nobg_file` using `this.$set()` for Vue 2 reactivity.

## Key files

| File | Changes |
|------|---------|
| `frappe/public/js/frappe/file_uploader/index.js` | New constructor params, `add_remove_bg_toggle()`, `update_remove_bg_toggle()`, `$watch` sync |
| `frappe/public/js/frappe/file_uploader/FileUploader.vue` | New props, `remove_bg_checked` data, watcher for file swapping, CSS for toggle pill |
| `frappe/public/js/frappe/file_uploader/ImageCropper.vue` | New props, toggle UI, loading overlay, `do_remove_bg()`, file caching, `crop_image()` updates for PNG output |
| `frappe/public/js/frappe/file_uploader/FilePreview.vue` | `file.file_obj` watcher, extracted `read_thumbnail()` method |

## Integration guide

To enable Remove Background in a custom app's upload dialog:

```javascript
// In your doctype's form script
const image_field = frm.fields_dict.image;
const original_set_upload = image_field.set_upload_options.bind(image_field);
image_field.set_upload_options = function () {
    original_set_upload();
    image_field.upload_options.show_remove_bg = true;
    image_field.upload_options.remove_bg_default = true;
};
```

The calling app must provide the server-side API endpoint. The ImageCropper calls `next.utils.remove_bg.remove_background` — to use a different endpoint, modify the `do_remove_bg()` method or make the endpoint configurable via a prop.

## CSS classes

| Class | Element | Description |
|-------|---------|-------------|
| `.remove-bg-footer-toggle` | Footer wrapper | `margin-right: auto` pushes it to the left |
| `.remove-bg-pill` | Clickable pill | Border, padding, transition. `.active` state adds primary color |
| `.remove-bg-track` / `.remove-bg-thumb` | Toggle switch | 28x16px track with 12px sliding thumb |
| `.cropper-loading-overlay` | Processing overlay | Semi-transparent white overlay with centered spinner |
| `.cropper-spinner` | Spinner | 36px border-based CSS spinner animation |
