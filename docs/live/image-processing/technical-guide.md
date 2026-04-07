# FileUploader Image Processing — Technical Guide

**Last Updated**: 2026-04-06

## Overview

Extends Frappe's FileUploader with two opt-in image processing features:
1. **Remove Background** — server-side AI background removal with live preview toggle
2. **Watermark Overlay** — configurable logo overlay with two modes:
   - **Corner** — single logo at a configurable position with drag/resize
   - **Tiled** — repeated logo grid across the entire image with rotation and spacing

Both features are generic framework extensions — the actual processing logic (rembg API, watermark settings) is provided by the calling app (pps190/next).

## Architecture

### Component hierarchy

```
FileUploader (index.js)
  |-- Dialog footer toggles (add_footer_toggle)
  |   |-- Remove Background toggle
  |   +-- Watermark toggle (disabled with config link when no settings)
  |
  +-- FileUploader.vue
        |-- Props: show_remove_bg, remove_bg_default, show_watermark, watermark_settings
        |-- Data: remove_bg_checked, wm_enabled
        |
        |-- FilePreview.vue
        |     +-- Watches file.file_obj -> re-reads thumbnail
        |
        +-- ImageCropper.vue
              |-- Mode switcher: [Crop] [Watermark] segmented tabs
              |-- Crop mode: CropperJS handles all interactions
              |-- Watermark mode: canvas overlay intercepts events
              |     |-- Corner/Tiled mode selector in control panel
              |     |-- Corner: drag to move, scroll to resize single logo
              |     +-- Tiled: rotated grid of logos across entire image
              |-- Remove BG: upload temp -> call API -> swap file
              |-- Watermark canvas: pointer-events toggled by mode
              |-- Control panel:
              |     |-- Corner: Opacity slider + Size slider + numeric inputs
              |     |-- Tiled: Opacity + Tile Size + Rotation + Spacing sliders + numeric inputs
              |     +-- Save as Default / Reset buttons
              +-- Crop composites watermark onto final canvas
```

### Mode switcher

The `[Crop | Watermark]` segmented control above the image determines which tool handles pointer events:

| Mode | CropperJS | Watermark Canvas | User Action |
|------|-----------|-----------------|-------------|
| Crop | `setDragMode("crop")` | `pointer-events: none` | Drag/resize crop area |
| Watermark | `setDragMode("none")` | `pointer-events: auto` | Interact with watermark |

The Watermark tab is disabled (grayed out, not clickable) when the Watermark toggle is off. Turning off the Watermark toggle auto-switches to Crop mode.

### Watermark mode — Corner/Tiled selector

Within Watermark mode, the control panel includes a Corner/Tiled mode selector:

| Watermark Mode | Canvas Behavior | User Action |
|----------------|----------------|-------------|
| Corner | Single logo drawn at position | Drag to move, scroll to resize |
| Tiled | Rotated grid of logos across image | Adjust via sliders only (no drag) |

### Coordinate system

Watermark position percentages are relative to the **image display area** within the CropperJS container, obtained via `cropper.getCanvasData()`:

**Corner mode:**
- **Preview draw**: `x = cd.left + (pos_x/100) * cd.width - wm_w/2`
- **Hit test**: same coordinate space
- **Drag update**: `pos_x = ((mx - offset - cd.left) / cd.width) * 100`
- **Crop composite**: convert from `(pos_x/100) * naturalWidth` pixel space, subtract crop box offset, scale to output canvas

**Tiled mode:**
- **Preview draw**: `wm_draw_tiled()` rotates canvas by `tile_rotation`, draws logo grid with spacing
- **Crop composite**: applies same rotation and grid calculation in pixel space, mapping each tile through crop box offset and scale

This ensures the watermark appears in exactly the same position in preview and final output regardless of image scaling or crop box position.

### Tiled rendering

The `wm_draw_tiled()` method:

1. Saves canvas state
2. Translates to image center (from `getCanvasData()`)
3. Rotates by `tile_rotation` degrees
4. Calculates tile dimensions: `tile_w = (tile_size/100) * cd.width`
5. Calculates spacing: `gap = (tile_spacing/100) * tile_w`
6. Draws logos in a grid covering the rotated bounding box
7. Restores canvas state

For the crop composite, `crop_image` performs the same calculation in natural pixel coordinates, iterating over the grid and drawing each tile onto the output canvas.

### Collapsible control panel

When watermark is enabled, a `<transition name="wm-panel">` panel slides down between the image and the action buttons. The panel content changes based on the watermark mode:

**Corner mode:**
- **2-column grid**: Position X, Position Y, Size, Opacity numeric inputs
- **Sliders**: Opacity slider and Size slider
- **Action buttons**: Reset, Save as Default

**Tiled mode:**
- **2-column grid**: Tile Size, Tile Opacity, Rotation, Spacing numeric inputs
- **Sliders**: Opacity, Tile Size, Rotation, Spacing sliders
- **Action buttons**: Reset, Save as Default

**Mobile**: single column at <=576px, full-width buttons

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

## Key data properties and methods

### Data properties (ImageCropper)

| Property | Type | Description |
|----------|------|-------------|
| `wm_mode` | String | Current watermark mode: `"corner"` or `"tiled"` |
| `wm_pos_x`, `wm_pos_y` | Number | Corner mode position (0-100%) |
| `wm_size` | Number | Corner mode logo size (5-100%) |
| `wm_opacity` | Number | Corner mode opacity (5-100%) |
| `wm_tile_size` | Number | Tiled mode tile size (5-100%) |
| `wm_tile_opacity` | Number | Tiled mode opacity (5-100%, default 12%) |
| `wm_tile_rotation` | Number | Tiled mode rotation (-180 to +180 degrees) |
| `wm_tile_spacing` | Number | Tiled mode spacing (0-100%) |

### Methods (ImageCropper)

| Method | Description |
|--------|-------------|
| `wm_set_mode(mode)` | Switch between `"corner"` and `"tiled"`, redraws canvas |
| `wm_draw()` | Dispatches to `wm_draw_corner()` or `wm_draw_tiled()` based on `wm_mode` |
| `wm_draw_corner()` | Draws single logo at position with opacity |
| `wm_draw_tiled()` | Draws rotated grid of logos across image |
| `wm_set_tile_size(val)` | Update tile size and redraw |
| `wm_set_tile_opacity(val)` | Update tile opacity and redraw |
| `wm_set_tile_rotation(val)` | Update rotation angle and redraw |
| `wm_set_tile_spacing(val)` | Update spacing and redraw |
| `wm_save_defaults()` | Persist mode + all params via `frappe.client.set_value` |
| `wm_reset_defaults()` | Restore from `watermark_settings` prop |

### Save/Reset

**Save as Default** persists all parameters to Watermark Settings:
- `mode` (Corner/Tiled)
- Corner: `position_x`, `position_y`, `size`, `opacity`
- Tiled: `tile_size`, `tile_opacity`, `tile_rotation`, `tile_spacing`

**Reset** restores all parameters from the `watermark_settings` prop passed at initialization.

Both operations also update `frappe._watermark_settings_cache` for the current session.

## Key files

| File | Changes |
|------|---------|
| `frappe/.../file_uploader/index.js` | Constructor params, `add_footer_toggle()`, disabled state with config link |
| `frappe/.../file_uploader/FileUploader.vue` | Props, `wm_enabled` data, `remove_bg_checked` file-swap watcher, footer toggle CSS |
| `frappe/.../file_uploader/ImageCropper.vue` | Mode switcher, Corner/Tiled selector, watermark canvas, control panel with mode-specific sliders, coordinate conversion, tiled grid rendering, Remove BG, Save/Reset defaults |
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
        mode: "Tiled",
        // Corner params
        position_x: 80, position_y: 90,
        size: 20, opacity: 50,
        // Tiled params
        tile_size: 20, tile_opacity: 12,
        tile_rotation: 0, tile_spacing: 50,
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
| `.wm-mode-selector` | Corner/Tiled selector | Mode toggle within control panel |
| `.toggle-pill` / `.toggle-pill.active` | Cropper toggles | Remove BG and Watermark pills |
| `.footer-toggle` / `.footer-toggle-pill` | Footer toggles | Dialog footer toggle pills |
| `.footer-toggle-pill.disabled` | Disabled state | Dashed border, reduced opacity |
