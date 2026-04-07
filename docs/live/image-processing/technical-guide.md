# FileUploader Image Processing — Technical Guide

**Last Updated**: 2026-04-07

## Overview

Extends Frappe's FileUploader with two opt-in image processing features:
1. **Remove Background** — server-side AI background removal with live preview toggle
2. **Watermark Overlay** — configurable logo overlay with drag/resize in a dedicated mode

Both features are generic framework extensions — the actual processing logic (rembg API, watermark settings) is provided by the calling app (pps190/next).

## Architecture

### Component hierarchy

```
FileUploader (index.js)
  ├── Dialog footer toggles (add_footer_toggle)
  │   ├── Remove Background toggle
  │   └── Watermark toggle (disabled with config link when no settings)
  │
  └── FileUploader.vue
        ├── Props: show_remove_bg, remove_bg_default, show_watermark, watermark_settings
        ├── Data: remove_bg_checked, wm_enabled
        │
        ├── FilePreview.vue
        │     └── Watches file.file_obj → re-reads thumbnail
        │
        └── ImageCropper.vue
              ├── Mode switcher: [Crop] [Watermark] segmented tabs
              ├── Crop mode: CropperJS handles all interactions
              ├── Watermark mode: canvas overlay intercepts events
              ├── Remove BG: upload temp → call API → swap file
              ├── Watermark canvas: pointer-events toggled by mode
              ├── Control panel: Position X/Y, Size, Opacity + Save/Reset
              └── Crop composites watermark onto final canvas
```

### Mode switcher

The `[Crop | Watermark]` segmented control above the image determines which tool handles pointer events:

| Mode | CropperJS | Watermark Canvas | User Action |
|------|-----------|-----------------|-------------|
| Crop | `setDragMode("crop")` | `pointer-events: none` | Drag/resize crop area |
| Watermark | `setDragMode("none")` | `pointer-events: auto` | Drag watermark, scroll to resize |

The Watermark tab is disabled (grayed out, not clickable) when the Watermark toggle is off. Turning off the Watermark toggle auto-switches to Crop mode.

### Coordinate system

Watermark position percentages are relative to the **image display area** within the CropperJS container, obtained via `cropper.getCanvasData()`:

- **Preview draw**: `x = cd.left + (pos_x/100) * cd.width - wm_w/2`
- **Hit test**: same coordinate space
- **Drag update**: `pos_x = ((mx - offset - cd.left) / cd.width) * 100`
- **Crop composite**: convert from `(pos_x/100) * naturalWidth` pixel space, subtract crop box offset, scale to output canvas

This ensures the watermark appears in exactly the same position in preview and final output regardless of image scaling or crop box position.

### Collapsible control panel

When watermark is enabled, a `<transition name="wm-panel">` panel slides down between the image and the action buttons:

- **2-column grid**: Position X, Position Y, Size, Opacity numeric inputs
- **Full-width slider**: Opacity range input
- **Action buttons**: Reset (restore saved defaults), Save as Default (persist via `frappe.client.set_value`)
- **Mobile**: single column at ≤576px, full-width buttons

### Footer toggles

`add_footer_toggle(key, label, uploader_field, initial_active, disabled_hint, disabled_link)` is a generic method on the FileUploader class:

- Creates a pill-shaped toggle in the dialog footer
- Syncs with Vue data via `$watch`
- Supports disabled state with hint text and click-to-open link
- Used for both Remove Background and Watermark toggles

### File caching

The `file` object carries cached versions for instant toggle switching:

| Property | Description |
|----------|-------------|
| `file._original_file` | Original uploaded file |
| `file._nobg_file` | Background-removed PNG |
| `file.file_obj` | Current active file (swapped by Vue `$set`) |
| `file.cropper_file` | File for CropperJS (swapped on toggle) |

## Key files

| File | Changes |
|------|---------|
| `frappe/.../file_uploader/index.js` | Constructor params, `add_footer_toggle()`, disabled state with config link |
| `frappe/.../file_uploader/FileUploader.vue` | Props, `wm_enabled` data, `remove_bg_checked` file-swap watcher, footer toggle CSS |
| `frappe/.../file_uploader/ImageCropper.vue` | Mode switcher, watermark canvas, control panel, coordinate conversion, Remove BG, Save/Reset defaults |
| `frappe/.../file_uploader/FilePreview.vue` | `file.file_obj` watcher for reactive thumbnail |

## Integration guide

To enable image processing features in a custom app's upload dialog:

```javascript
const image_field = frm.fields_dict.image;
const orig = image_field.set_upload_options.bind(image_field);
image_field.set_upload_options = function () {
    orig();
    // Remove Background
    image_field.upload_options.show_remove_bg = true;
    image_field.upload_options.remove_bg_default = true;
    // Watermark (fetch settings from your app)
    image_field.upload_options.show_watermark = true;
    image_field.upload_options.watermark_settings = {
        enabled: true,
        watermark_image: "/files/logo.png",
        position_x: 80, position_y: 90,
        size: 20, opacity: 50,
    };
};
```

## CSS classes

| Class | Element | Description |
|-------|---------|-------------|
| `.mode-switcher` | Tab container | Flex container with pill background |
| `.mode-btn` / `.mode-btn.active` | Tab buttons | Segmented control with active highlight |
| `.wm-controls-panel` | Control panel | Collapsible panel with transition |
| `.wm-controls-grid` | Input grid | 2-column on desktop, 1-column on mobile |
| `.wm-input-group` | Input wrapper | Styled number input with % suffix |
| `.toggle-pill` / `.toggle-pill.active` | Cropper toggles | Remove BG and Watermark pills |
| `.footer-toggle` / `.footer-toggle-pill` | Footer toggles | Dialog footer toggle pills |
| `.footer-toggle-pill.disabled` | Disabled state | Dashed border, reduced opacity |
