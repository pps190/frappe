<template>
	<div>
		<!-- Interaction-mode switcher: Corner mode only (Tiled has no drag target). -->
		<div
			v-if="show_watermark && wm_enabled && wm_loaded && wm_mode === 'Corner'"
			class="interaction-switcher"
		>
			<span class="interaction-switcher-label">{{ __("Drag on image") }}</span>
			<div class="segmented-tabs" role="tablist">
				<button
					class="segmented-tab"
					:class="{ active: interaction_mode === 'crop' }"
					role="tab"
					:aria-selected="interaction_mode === 'crop'"
					:title="__('Drag to resize/move the crop box')"
					@click="set_mode('crop')"
				>
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2v14a2 2 0 002 2h14"/><path d="M18 22V8a2 2 0 00-2-2H2"/></svg>
					{{ __("Crop box") }}
				</button>
				<button
					class="segmented-tab"
					:class="{ active: interaction_mode === 'watermark' }"
					role="tab"
					:aria-selected="interaction_mode === 'watermark'"
					:title="__('Drag to move the watermark logo')"
					@click="set_mode('watermark')"
				>
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
					{{ __("Watermark") }}
				</button>
			</div>
		</div>

		<div
			class="cropper-image-wrapper"
			ref="wrapper"
			:class="{
				'wm-mode': interaction_mode === 'watermark' && wm_mode === 'Corner',
				'bg-processing': bg_processing,
			}"
			@mousedown="on_wrapper_mousedown"
			@wheel.prevent="on_wrapper_wheel"
			@touchstart="on_wrapper_touchstart"
		>
			<img ref="image" :src="src" :alt="file.name" />
			<canvas
				v-if="wm_enabled && wm_loaded"
				ref="wm_canvas"
				class="watermark-overlay-canvas"
				:style="{ pointerEvents: (interaction_mode === 'watermark' && wm_mode === 'Corner') ? 'auto' : 'none' }"
			></canvas>
			<div v-if="bg_processing" class="cropper-loading-overlay">
				<div class="cropper-spinner"></div>
				<div class="cropper-loading-text">{{ __("Removing background...") }}</div>
			</div>
		</div>

		<!-- ─── Unified Image Adjustments panel ───
		     Both Remove BG auto-crop padding and Watermark knobs share a single
		     panel so the dialog stays compact. The top toggles (Remove BG /
		     Watermark) live in the sticky dialog footer; this panel only hosts
		     the parameters for whichever features are currently on. -->
		<div
			v-if="(show_remove_bg && bg_removed && nobg_bbox) || (show_watermark && wm_enabled)"
			class="adjustments-panel"
		>
			<!-- Auto-crop padding (Remove BG) — only shown when Remove BG is on
			     AND a bbox is available. -->
			<div
				v-if="show_remove_bg && bg_removed && nobg_bbox"
				class="adjustments-row"
			>
				<label class="adjustments-field-label">
					{{ __("Auto-crop padding") }}
				</label>
				<div class="padding-input-row">
					<input
						type="range"
						class="wm-slider"
						min="-20" max="40" step="1"
						:value="effective_padding_pct"
						@input="set_padding_pct(parseInt($event.target.value))"
					/>
					<div class="wm-input-group padding-input-group">
						<input
							type="number"
							class="wm-input"
							min="-20" max="40" step="1"
							:value="effective_padding_pct"
							@input="set_padding_pct(parseInt($event.target.value))"
						/>
						<span class="wm-input-suffix">%</span>
					</div>
				</div>
				<div class="wm-panel-actions">
					<button class="btn btn-xs btn-default" @click="reset_padding_pct">
						{{ __("Reset") }}
					</button>
					<button class="btn btn-xs btn-primary-light" @click="save_padding_default">
						{{ __("Save as Default") }}
					</button>
				</div>
			</div>
			<div
				v-else-if="show_remove_bg && bg_removed && !nobg_bbox"
				class="adjustments-row adjustments-warn"
			>
				{{ __("Auto-crop not available — microservice did not return a bounding box.") }}
			</div>

			<!-- Watermark controls — only shown when Watermark is on. -->
			<div v-if="show_watermark && wm_enabled" class="adjustments-row adjustments-row-wm">
				<!-- Segmented tab control: Tiled first, Corner second. -->
				<div class="segmented-tabs" role="tablist">
					<button
						class="segmented-tab"
						:class="{ active: wm_mode === 'Tiled' }"
						role="tab"
						:aria-selected="wm_mode === 'Tiled'"
						:title="__('Tiled — covers the whole image, not draggable')"
						@click="wm_set_mode('Tiled')"
					>
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
						{{ __("Tiled") }}
					</button>
					<button
						class="segmented-tab"
						:class="{ active: wm_mode === 'Corner' }"
						role="tab"
						:aria-selected="wm_mode === 'Corner'"
						:title="__('Corner — single logo at a fixed position, draggable')"
						@click="wm_set_mode('Corner')"
					>
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L12 12"/><rect x="2" y="14" width="10" height="8" rx="1"/></svg>
						{{ __("Corner") }}
					</button>
				</div>

				<!-- Tiled mode controls -->
				<template v-if="wm_mode === 'Tiled'">
					<div class="wm-sliders-row">
						<div class="wm-slider-field">
							<label class="wm-control-label">{{ __("Opacity") }}</label>
							<input type="range" class="wm-slider" min="5" max="100"
								:value="wm_tile_opacity" @input="wm_set_tile_opacity(parseInt($event.target.value))" />
							<span class="wm-slider-value">{{ wm_tile_opacity }}%</span>
						</div>
						<div class="wm-slider-field">
							<label class="wm-control-label">{{ __("Tile Size") }}</label>
							<input type="range" class="wm-slider" min="3" max="80"
								:value="wm_tile_size" @input="wm_set_tile_size(parseInt($event.target.value))" />
							<span class="wm-slider-value">{{ Math.round(wm_tile_size) }}%</span>
						</div>
						<div class="wm-slider-field">
							<label class="wm-control-label">{{ __("Rotation") }}</label>
							<input type="range" class="wm-slider" min="-180" max="180"
								:value="wm_tile_rotation" @input="wm_set_tile_rotation(parseInt($event.target.value))" />
							<span class="wm-slider-value">{{ wm_tile_rotation }}°</span>
						</div>
						<div class="wm-slider-field">
							<label class="wm-control-label">{{ __("Spacing") }}</label>
							<input type="range" class="wm-slider" min="0" max="100"
								:value="wm_tile_spacing" @input="wm_set_tile_spacing(parseInt($event.target.value))" />
							<span class="wm-slider-value">{{ wm_tile_spacing }}%</span>
						</div>
					</div>
				</template>

				<!-- Corner mode controls -->
				<template v-if="wm_mode === 'Corner'">
					<div class="wm-sliders-row">
						<div class="wm-slider-field">
							<label class="wm-control-label">{{ __("Opacity") }}</label>
							<input type="range" class="wm-slider" min="5" max="100"
								:value="wm_opacity" @input="wm_set_opacity(parseInt($event.target.value))" />
							<span class="wm-slider-value">{{ wm_opacity }}%</span>
						</div>
						<div class="wm-slider-field">
							<label class="wm-control-label">{{ __("Size") }}</label>
							<input type="range" class="wm-slider" min="5" max="100"
								:value="wm_size" @input="wm_set_size(parseFloat($event.target.value))" />
							<span class="wm-slider-value">{{ Math.round(wm_size) }}%</span>
						</div>
						<div class="wm-slider-field">
							<label class="wm-control-label">{{ __("Position X") }}</label>
							<input type="range" class="wm-slider" min="0" max="100"
								:value="wm_pos_x" @input="wm_set_pos_x(parseFloat($event.target.value))" />
							<span class="wm-slider-value">{{ Math.round(wm_pos_x) }}%</span>
						</div>
						<div class="wm-slider-field">
							<label class="wm-control-label">{{ __("Position Y") }}</label>
							<input type="range" class="wm-slider" min="0" max="100"
								:value="wm_pos_y" @input="wm_set_pos_y(parseFloat($event.target.value))" />
							<span class="wm-slider-value">{{ Math.round(wm_pos_y) }}%</span>
						</div>
					</div>
				</template>

				<div class="wm-panel-actions">
					<button class="btn btn-xs btn-default" @click="wm_reset_defaults">
						{{ __("Reset") }}
					</button>
					<button class="btn btn-xs btn-primary-light" @click="wm_save_defaults">
						{{ __("Save as Default") }}
					</button>
				</div>
			</div>
		</div>

		<div class="image-cropper-actions" ref="actions">
			<div class="cropper-left-actions">
				<div class="btn-group" v-if="fixed_aspect_ratio == null">
					<button
						v-for="button in aspect_ratio_buttons"
						type="button"
						class="btn btn-default btn-sm"
						:class="{
							active: isNaN(aspect_ratio)
								? isNaN(button.value)
								: button.value === aspect_ratio,
						}"
						:key="button.label"
						@click="aspect_ratio = button.value"
					>
						{{ button.label }}
					</button>
				</div>
				<div
					v-if="show_remove_bg"
					class="toggle-pill"
					:class="{ active: bg_removed, processing: bg_processing }"
					@click="toggle_remove_bg"
				>
					<span class="toggle-pill-label">{{ __("Remove BG") }}</span>
					<span class="toggle-pill-switch">
						<span class="toggle-pill-track" :class="{ on: bg_removed }">
							<span class="toggle-pill-thumb"></span>
						</span>
					</span>
				</div>
				<div
					v-if="show_watermark"
					class="toggle-pill"
					:class="{ active: wm_enabled }"
					@click="toggle_watermark"
				>
					<span class="toggle-pill-label">{{ __("Watermark") }}</span>
					<span class="toggle-pill-switch">
						<span class="toggle-pill-track" :class="{ on: wm_enabled }">
							<span class="toggle-pill-thumb"></span>
						</span>
					</span>
				</div>
			</div>
			<div>
				<button
					class="btn btn-sm margin-right"
					@click="$emit('toggle_image_cropper')"
					v-if="fixed_aspect_ratio == null"
				>
					{{ __("Back") }}
				</button>
				<button class="btn btn-primary btn-sm" :disabled="bg_processing" @click="crop_image">
					{{ __("Crop") }}
				</button>
			</div>
		</div>
	</div>
</template>

<script>
import Cropper from "cropperjs";
export default {
	name: "ImageCropper",
	props: [
		"file", "fixed_aspect_ratio",
		"show_remove_bg", "remove_bg_checked", "remove_bg_padding_pct",
		"show_watermark", "watermark_settings", "wm_default_enabled",
	],
	data() {
		return {
			src: null,
			cropper: null,
			image: null,
			aspect_ratio: NaN,
			// Remove BG
			bg_removed: false,
			bg_processing: false,
			original_file: null,
			nobg_file: null,
			// Auto-crop metadata from microservice (Phase 1). `nobg_bbox` is the
			// non-transparent bounding box of the processed PNG; when present, the
			// Cropper `ready` callback snaps the initial crop box to it plus the
			// configured padding. Null means "no auto-crop" (legacy microservice
			// response or Remove BG disabled) and Cropper falls back to default.
			nobg_bbox: null,
			nobg_natural_size: null,
			// Local override for padding — starts as null (= use the prop from
			// Image Processing Settings). When the user drags the padding slider
			// in the Remove BG section, this takes effect and auto-crop is
			// re-applied live.
			local_padding_pct: null,
			// Watermark
			wm_enabled: false,
			wm_loaded: false,
			wm_img: null,
			wm_pos_x: 80,
			wm_pos_y: 90,
			wm_size: 20,
			wm_opacity: 50,
			wm_dragging: false,
			wm_drag_offset_x: 0,
			wm_drag_offset_y: 0,
			wm_mode: "Corner",
			// Tiled mode params
			wm_tile_size: 15,
			wm_tile_opacity: 12,
			wm_tile_rotation: -30,
			wm_tile_spacing: 40,
			// Interaction mode
			interaction_mode: "crop",
		};
	},
	watch: {
		aspect_ratio(value) {
			if (this.cropper) {
				this.cropper.setAspectRatio(value);
			}
		},
	},
	mounted() {
		// Remove BG: cached files + bbox metadata (Phase 1)
		this.original_file = this.file._original_file || this.file.cropper_file;
		this.nobg_file = this.file._nobg_file || null;
		this.nobg_bbox = this.file._nobg_bbox || null;
		this.nobg_natural_size = this.file._nobg_natural_size || null;
		this.file._original_file = this.original_file;

		if (this.remove_bg_checked && this.nobg_file) {
			this.bg_removed = true;
			this.load_image(this.nobg_file);
		} else {
			this.load_image(this.file.cropper_file);
			if (this.show_remove_bg && this.remove_bg_checked && !this.nobg_file) {
				this.do_remove_bg();
			}
		}

		// Watermark: load settings
		if (this.show_watermark && this.watermark_settings) {
			this.wm_enabled = this.wm_default_enabled;
			this.wm_mode = this.watermark_settings.mode || "Corner";
			// Corner params
			this.wm_pos_x = this.watermark_settings.position_x || 80;
			this.wm_pos_y = this.watermark_settings.position_y || 90;
			this.wm_size = this.watermark_settings.size || 20;
			this.wm_opacity = this.watermark_settings.opacity || 50;
			// Tiled params
			this.wm_tile_size = this.watermark_settings.tile_size || 15;
			this.wm_tile_opacity = this.watermark_settings.tile_opacity || 20;
			this.wm_tile_rotation = this.watermark_settings.tile_rotation != null ? this.watermark_settings.tile_rotation : -30;
			this.wm_tile_spacing = this.watermark_settings.tile_spacing || 40;
			this.load_watermark_image(this.watermark_settings.watermark_image);
		}

		// Global listeners for watermark drag
		this._on_mousemove = this.on_wrapper_mousemove.bind(this);
		this._on_mouseup = this.on_wrapper_mouseup.bind(this);
		this._on_touchmove = this.on_wrapper_touchmove.bind(this);
		this._on_touchend = this.on_wrapper_mouseup.bind(this);
		document.addEventListener("mousemove", this._on_mousemove);
		document.addEventListener("mouseup", this._on_mouseup);
		document.addEventListener("touchmove", this._on_touchmove, { passive: false });
		document.addEventListener("touchend", this._on_touchend);

		// When the viewport or the modal itself resizes, the CropperJS canvas
		// re-layouts automatically via its built-in listener, but our watermark
		// overlay canvas sits on top and needs to be resized + redrawn manually.
		// Debounce with rAF to coalesce rapid resize events.
		this._on_window_resize = () => {
			if (this._resize_raf) return;
			this._resize_raf = requestAnimationFrame(() => {
				this._resize_raf = null;
				if (this.wm_enabled && this.wm_loaded) {
					this.wm_resize_canvas();
				}
			});
		};
		window.addEventListener("resize", this._on_window_resize);

		// Mark the enclosing Bootstrap modal-body so our scoped CSS can enable
		// internal scrolling — otherwise very tall images + section cards push
		// the modal past the viewport bottom. `$refs.wrapper` is inside the
		// modal-body, so walking up finds it.
		//
		// The action bar (aspect ratio buttons, feature toggles, Back/Crop)
		// uses `position: sticky; bottom: 0` inside the scrollable modal-body
		// so it stays pinned at the visual bottom of the dialog regardless of
		// how tall the image + parameter panel grow. The dialog's built-in
		// modal-footer (with the file-selection stage's Set all private /
		// Upload buttons) is hidden via the `.image-cropper-modal-body` class
		// → [next] → `.modal-footer { display: none }` sibling selector so we
		// don't show two rows of actions while cropping.
		this.$nextTick(() => {
			const body = this.$el.closest && this.$el.closest(".modal-body");
			if (body) {
				body.classList.add("image-cropper-modal-body");
				this._modal_body_el = body;
			}
		});
	},
	beforeDestroy() {
		document.removeEventListener("mousemove", this._on_mousemove);
		document.removeEventListener("mouseup", this._on_mouseup);
		document.removeEventListener("touchmove", this._on_touchmove);
		document.removeEventListener("touchend", this._on_touchend);
		window.removeEventListener("resize", this._on_window_resize);
		if (this._resize_raf) cancelAnimationFrame(this._resize_raf);
		if (this._modal_body_el) {
			this._modal_body_el.classList.remove("image-cropper-modal-body");
		}
	},
	computed: {
		aspect_ratio_buttons() {
			return [
				{ label: __("1:1"), value: 1 },
				{ label: __("4:3"), value: 4 / 3 },
				{ label: __("16:9"), value: 16 / 9 },
				{ label: __("Free"), value: NaN },
			];
		},
		// The padding actually applied by _apply_auto_crop. Local override wins
		// if set, otherwise fall back to the prop from Image Processing Settings,
		// then a hardcoded 5% default.
		effective_padding_pct() {
			if (this.local_padding_pct != null) return this.local_padding_pct;
			const p = Number(this.remove_bg_padding_pct);
			return Number.isFinite(p) ? p : 2;
		},
	},
	methods: {
		// ── Image loading ──
		load_image(file) {
			if (window.FileReader) {
				let fr = new FileReader();
				fr.onload = () => {
					this.src = fr.result;
					this.$nextTick(() => this.init_cropper());
				};
				fr.readAsDataURL(file);
			}
		},
		init_cropper() {
			if (this.cropper) this.cropper.destroy();
			let crop_box = this.file.crop_box_data;
			this.image = this.$refs.image;
			this.image.onload = () => {
				this.cropper = new Cropper(this.image, {
					zoomable: false,
					scalable: false,
					viewMode: 1,
					data: crop_box,
					aspectRatio: this.aspect_ratio,
					ready: () => {
						// Phase 1 auto-crop: if Remove BG produced a bbox AND the
						// user hasn't already saved a manual crop_box_data for this
						// file, snap the initial crop box to bbox + padding.
						// We respect crop_box_data because users who already tweaked
						// the crop shouldn't have their work overwritten when the
						// cropper re-mounts (e.g. after toggling Remove BG).
						if (
							this.bg_removed &&
							this.nobg_bbox &&
							!this.file.crop_box_data
						) {
							this._apply_auto_crop();
						}
						if (this.wm_enabled && this.wm_loaded) {
							this.$nextTick(() => this.wm_resize_canvas());
						}
					},
					crop: () => {
						if (this.wm_enabled && this.wm_loaded) {
							this.$nextTick(() => this.wm_draw());
						}
					},
				});
			};
		},

		// ── Auto-crop (Phase 1) ──
		_apply_auto_crop() {
			// Snap the Cropper crop box to the product's non-transparent bounding
			// box plus a configurable padding. Called from the Cropper `ready`
			// callback after a Remove BG result is loaded.
			//
			// Padding is a percentage of the LONGER side of the bbox (so wide or
			// tall products both get a proportional border). Negative values
			// tighten into the bbox to shed anti-aliasing halos. CropperJS clamps
			// the final rectangle to the image bounds automatically.
			if (!this.cropper || !this.nobg_bbox) return;
			const { x, y, width, height } = this.nobg_bbox;
			const padding_pct = this.effective_padding_pct;
			const pad = (padding_pct / 100) * Math.max(width, height);
			this.cropper.setData({
				x: x - pad,
				y: y - pad,
				width: width + 2 * pad,
				height: height + 2 * pad,
			});
		},

		// ── Remove BG padding control (Phase 1 — live-edit from Remove BG card) ──
		set_padding_pct(val) {
			if (!Number.isFinite(val)) return;
			// Clamp to slider bounds
			this.local_padding_pct = Math.max(-20, Math.min(40, val));
			if (this.bg_removed && this.nobg_bbox && this.cropper) {
				this._apply_auto_crop();
			}
		},
		reset_padding_pct() {
			this.local_padding_pct = null;
			if (this.bg_removed && this.nobg_bbox && this.cropper) {
				this._apply_auto_crop();
			}
		},
		async save_padding_default() {
			// Persist the current padding as the system-wide default in Image
			// Processing Settings. Mirrors wm_save_defaults. After save the
			// prop baseline is updated in the cached settings so Reset clears
			// the local override back to this new default instead of the old
			// one.
			const value = this.effective_padding_pct;
			try {
				await frappe.call({
					method: "frappe.client.set_value",
					args: {
						doctype: "Image Processing Settings",
						name: "Image Processing Settings",
						fieldname: { remove_bg_padding_pct: value },
					},
				});
				if (frappe._image_processing_settings_cache) {
					frappe._image_processing_settings_cache.remove_bg_padding_pct = value;
				}
				frappe.show_alert({
					message: __("Auto-crop padding default saved ({0}%)", [value]),
					indicator: "green",
				});
			} catch (e) {
				frappe.show_alert({
					message: __("Failed to save default"),
					indicator: "red",
				});
			}
		},

		// ── Crop ──
		crop_image() {
			const crop_data = this.cropper.getData();
			const image_data = this.cropper.getImageData();
			this.file.crop_box_data = crop_data;
			const canvas = this.cropper.getCroppedCanvas();

			if (this.wm_enabled && this.wm_loaded && this.wm_img) {
				const ctx = canvas.getContext("2d");
				const cw = canvas.width;
				const ch = canvas.height;
				const full_w = image_data.naturalWidth;
				const full_h = image_data.naturalHeight;
				const crop_x = crop_data.x;
				const crop_y = crop_data.y;
				const crop_w = crop_data.width;
				const crop_h = crop_data.height;
				const scale_x = cw / crop_w;
				const scale_y = ch / crop_h;

				if (this.wm_mode === "Tiled") {
					// Tiled watermark on cropped canvas
					const tile_w = (this.wm_tile_size / 100) * full_w * scale_x;
					const tile_h = tile_w * (this.wm_img.naturalHeight / this.wm_img.naturalWidth);
					const spacing_x = (this.wm_tile_spacing / 100) * full_w * scale_x;
					const spacing_y = (this.wm_tile_spacing / 100) * full_h * scale_y;
					const step_x = tile_w + spacing_x;
					const step_y = tile_h + spacing_y;
					const angle = (this.wm_tile_rotation * Math.PI) / 180;

					ctx.save();
					ctx.globalAlpha = this.wm_tile_opacity / 100;
					ctx.translate(cw / 2, ch / 2);
					ctx.rotate(angle);
					const diag = Math.sqrt(cw * cw + ch * ch);
					for (let y = -diag; y < diag; y += step_y) {
						for (let x = -diag; x < diag; x += step_x) {
							ctx.drawImage(this.wm_img, x, y, tile_w, tile_h);
						}
					}
					ctx.restore();
				} else {
					// Corner watermark
					const wm_center_x = (this.wm_pos_x / 100) * full_w;
					const wm_center_y = (this.wm_pos_y / 100) * full_h;
					const wm_w_full = (this.wm_size / 100) * full_w;
					const wm_h_full = wm_w_full * (this.wm_img.naturalHeight / this.wm_img.naturalWidth);
					const draw_x = (wm_center_x - wm_w_full / 2 - crop_x) * scale_x;
					const draw_y = (wm_center_y - wm_h_full / 2 - crop_y) * scale_y;
					const draw_w = wm_w_full * scale_x;
					const draw_h = wm_h_full * scale_y;
					ctx.globalAlpha = this.wm_opacity / 100;
					ctx.drawImage(this.wm_img, draw_x, draw_y, draw_w, draw_h);
					ctx.globalAlpha = 1.0;
				}
			}

			const file_type = (this.bg_removed || this.wm_enabled) ? "image/png" : this.file.file_obj.type;
			canvas.toBlob((blob) => {
				let name = this.file.name;
				if (this.bg_removed) name = name.replace(/\.[^.]+$/, "_nobg.png");
				if (this.wm_enabled) name = name.replace(/\.[^.]+$/, "_wm.png");
				this.file.file_obj = new File([blob], name, { type: blob.type });
				this.file.name = name;
				this.$emit("toggle_image_cropper");
			}, file_type);
		},

		// ── Remove BG ──
		toggle_remove_bg() {
			if (this.bg_processing) return;
			if (this.bg_removed) {
				this.bg_removed = false;
				this.file.cropper_file = this.original_file;
				this.file.file_obj = this.original_file;
				this.$emit("remove_bg_changed", false);
				this.load_image(this.original_file);
			} else if (this.nobg_file) {
				this.bg_removed = true;
				this.file.cropper_file = this.nobg_file;
				this.file.file_obj = this.nobg_file;
				this.$emit("remove_bg_changed", true);
				this.load_image(this.nobg_file);
			} else {
				this.do_remove_bg();
			}
		},
		async do_remove_bg() {
			this.bg_processing = true;
			try {
				let form_data = new FormData();
				form_data.append("file", this.original_file, this.file.name);
				form_data.append("is_private", 0);
				form_data.append("folder", "Home");
				let upload_resp = await fetch("/api/method/upload_file", {
					method: "POST",
					headers: { "Accept": "application/json", "X-Frappe-CSRF-Token": frappe.csrf_token },
					body: form_data,
				});
				let upload_data = await upload_resp.json();
				let resp = await frappe.call({
					method: "next.utils.remove_bg.remove_background",
					args: { file_url: upload_data.message.file_url },
				});
				if (resp && resp.message && resp.message.file_url) {
					let blob_resp = await fetch(resp.message.file_url);
					let blob = await blob_resp.blob();
					this.nobg_file = new File([blob], "nobg.png", { type: "image/png" });
					this.file._nobg_file = this.nobg_file;
					// Phase 1: capture bbox + natural_size for auto-crop. Null when
					// the microservice returned a legacy raw-PNG response.
					this.nobg_bbox = (resp.message && resp.message.bbox) || null;
					this.nobg_natural_size = (resp.message && resp.message.natural_size) || null;
					this.file._nobg_bbox = this.nobg_bbox;
					this.file._nobg_natural_size = this.nobg_natural_size;
					this.bg_removed = true;
					this.file.cropper_file = this.nobg_file;
					this.file.file_obj = this.nobg_file;
					this.$emit("remove_bg_changed", true);
					this.load_image(this.nobg_file);
				}
			} catch (e) {
				frappe.show_alert({ message: __("Background removal failed"), indicator: "orange" });
				console.error(e);
			} finally {
				this.bg_processing = false;
			}
		},

		// ── Watermark ──
		load_watermark_image(url) {
			const img = new Image();
			img.crossOrigin = "anonymous";
			img.onload = () => {
				this.wm_img = img;
				this.wm_loaded = true;
				this.$nextTick(() => this.wm_resize_canvas());
			};
			img.onerror = () => {
				frappe.show_alert({ message: __("Failed to load watermark image"), indicator: "orange" });
			};
			img.src = url;
		},
		toggle_watermark() {
			if (!this.wm_loaded && !this.wm_enabled) {
				if (this.watermark_settings && this.watermark_settings.watermark_image) {
					this.wm_enabled = true;
					this.load_watermark_image(this.watermark_settings.watermark_image);
				}
				return;
			}
			this.wm_enabled = !this.wm_enabled;
			this.$emit("wm_enabled_changed", this.wm_enabled);
			if (this.wm_enabled) {
				this.$nextTick(() => this.wm_resize_canvas());
			} else {
				// Auto-switch to crop mode when watermark is turned off
				this.set_mode("crop");
			}
		},
		wm_resize_canvas() {
			const canvas = this.$refs.wm_canvas;
			const wrapper = this.$refs.wrapper;
			if (!canvas || !wrapper) return;
			const container = wrapper.querySelector(".cropper-container");
			if (container) {
				canvas.width = container.offsetWidth;
				canvas.height = container.offsetHeight;
			} else {
				canvas.width = wrapper.offsetWidth;
				canvas.height = wrapper.offsetHeight;
			}
			this.wm_draw();
		},
		wm_draw() {
			const canvas = this.$refs.wm_canvas;
			if (!canvas || !this.wm_img || !this.cropper) return;
			const ctx = canvas.getContext("2d");
			const cw = canvas.width;
			const ch = canvas.height;
			ctx.clearRect(0, 0, cw, ch);

			const cd = this.cropper.getCanvasData();

			if (this.wm_mode === "Tiled") {
				this.wm_draw_tiled(ctx, cd);
			} else {
				this.wm_draw_corner(ctx, cd);
			}
		},
		wm_draw_corner(ctx, cd) {
			const r = this.wm_get_rect_in_container(cd);
			ctx.globalAlpha = this.wm_opacity / 100;
			ctx.drawImage(this.wm_img, r.x, r.y, r.w, r.h);
			ctx.globalAlpha = 1.0;

			// Outline hints the user that this rectangle is the draggable target.
			// Solid + thicker when interaction is set to "Move watermark", dashed
			// and thinner otherwise so it still marks the watermark without
			// screaming "drag me" when the user is cropping.
			const active = this.interaction_mode === "watermark";
			ctx.strokeStyle = active ? "rgba(59, 130, 246, 0.9)" : "rgba(59, 130, 246, 0.5)";
			ctx.lineWidth = active ? 2 : 1;
			if (!active) ctx.setLineDash([4, 4]);
			ctx.strokeRect(r.x, r.y, r.w, r.h);
			ctx.setLineDash([]);
			// Corner handles so the rectangle reads as "draggable" (only when
			// interaction is active).
			if (active) {
				const handle = 6;
				ctx.fillStyle = "rgba(59, 130, 246, 0.9)";
				[
					[r.x, r.y],
					[r.x + r.w, r.y],
					[r.x, r.y + r.h],
					[r.x + r.w, r.y + r.h],
				].forEach(([hx, hy]) => {
					ctx.fillRect(hx - handle / 2, hy - handle / 2, handle, handle);
				});
			}
		},
		wm_draw_tiled(ctx, cd) {
			const tile_w = (this.wm_tile_size / 100) * cd.width;
			const tile_h = tile_w * (this.wm_img.naturalHeight / this.wm_img.naturalWidth);
			const spacing_x = (this.wm_tile_spacing / 100) * cd.width;
			const spacing_y = (this.wm_tile_spacing / 100) * cd.height;
			const step_x = tile_w + spacing_x;
			const step_y = tile_h + spacing_y;
			const angle = (this.wm_tile_rotation * Math.PI) / 180;

			ctx.save();
			ctx.globalAlpha = this.wm_tile_opacity / 100;
			// Rotate around image center
			const cx = cd.left + cd.width / 2;
			const cy = cd.top + cd.height / 2;
			ctx.translate(cx, cy);
			ctx.rotate(angle);

			const diag = Math.sqrt(cd.width * cd.width + cd.height * cd.height);
			for (let y = -diag; y < diag; y += step_y) {
				for (let x = -diag; x < diag; x += step_x) {
					ctx.drawImage(this.wm_img, x, y, tile_w, tile_h);
				}
			}
			ctx.restore();
		},
		// Watermark rect in container/canvas display coordinates
		wm_get_rect_in_container(cd) {
			// cd = cropper.getCanvasData() = { left, top, width, height } of image in container
			const wm_w = (this.wm_size / 100) * cd.width;
			const wm_h = wm_w * (this.wm_img.naturalHeight / this.wm_img.naturalWidth);
			return {
				x: cd.left + (this.wm_pos_x / 100) * cd.width - wm_w / 2,
				y: cd.top + (this.wm_pos_y / 100) * cd.height - wm_h / 2,
				w: wm_w, h: wm_h,
			};
		},
		wm_hit_test(mx, my) {
			if (!this.cropper) return false;
			const cd = this.cropper.getCanvasData();
			const r = this.wm_get_rect_in_container(cd);
			return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
		},

		set_mode(mode) {
			this.interaction_mode = mode;
			if (this.cropper) {
				// Disable/enable CropperJS drag based on mode
				if (mode === "watermark") {
					this.cropper.setDragMode("none");
				} else {
					this.cropper.setDragMode("crop");
				}
			}
			// Repaint watermark so the corner outline picks up the new active state.
			if (this.wm_enabled && this.wm_loaded) {
				this.$nextTick(() => this.wm_draw());
			}
		},

		// Wrapper-level mouse/touch handlers — only active in Corner-mode
		// watermark interaction. Tiled watermark covers the whole image so
		// there's no meaningful drag target; users adjust tile params via
		// sliders instead.
		on_wrapper_mousedown(e) {
			if (this.interaction_mode !== "watermark") return;
			if (this.wm_mode !== "Corner") return;
			if (!this.wm_enabled || !this.wm_loaded || !this.cropper) return;
			const canvas = this.$refs.wm_canvas;
			if (!canvas) return;
			const rect = canvas.getBoundingClientRect();
			const mx = e.clientX - rect.left;
			const my = e.clientY - rect.top;
			const cd = this.cropper.getCanvasData();
			e.stopPropagation();
			e.preventDefault();
			this.wm_dragging = true;
			// Offset from watermark center in container coords
			this.wm_drag_offset_x = mx - (cd.left + (this.wm_pos_x / 100) * cd.width);
			this.wm_drag_offset_y = my - (cd.top + (this.wm_pos_y / 100) * cd.height);
		},
		on_wrapper_mousemove(e) {
			if (!this.wm_dragging || !this.cropper) return;
			const canvas = this.$refs.wm_canvas;
			if (!canvas) return;
			const rect = canvas.getBoundingClientRect();
			const mx = e.clientX - rect.left;
			const my = e.clientY - rect.top;
			const cd = this.cropper.getCanvasData();
			this.wm_pos_x = Math.max(0, Math.min(100, ((mx - this.wm_drag_offset_x - cd.left) / cd.width) * 100));
			this.wm_pos_y = Math.max(0, Math.min(100, ((my - this.wm_drag_offset_y - cd.top) / cd.height) * 100));
			this.wm_draw();
		},
		on_wrapper_mouseup() {
			this.wm_dragging = false;
		},
		on_wrapper_wheel(e) {
			if (this.interaction_mode !== "watermark") return;
			if (this.wm_mode !== "Corner") return;
			if (!this.wm_enabled || !this.wm_loaded) return;
			const delta = e.deltaY > 0 ? -1 : 1;
			this.wm_size = Math.max(5, Math.min(100, this.wm_size + delta));
			this.wm_draw();
		},
		on_wrapper_touchstart(e) {
			if (this.interaction_mode !== "watermark") return;
			if (this.wm_mode !== "Corner") return;
			if (!this.wm_enabled || !this.wm_loaded || !this.cropper) return;
			const canvas = this.$refs.wm_canvas;
			if (!canvas) return;
			const touch = e.touches[0];
			const rect = canvas.getBoundingClientRect();
			const mx = touch.clientX - rect.left;
			const my = touch.clientY - rect.top;
			const cd = this.cropper.getCanvasData();
			e.stopPropagation();
			e.preventDefault();
			this.wm_dragging = true;
			this.wm_drag_offset_x = mx - (cd.left + (this.wm_pos_x / 100) * cd.width);
			this.wm_drag_offset_y = my - (cd.top + (this.wm_pos_y / 100) * cd.height);
		},
		on_wrapper_touchmove(e) {
			if (!this.wm_dragging || !this.cropper) return;
			e.preventDefault();
			const canvas = this.$refs.wm_canvas;
			if (!canvas) return;
			const touch = e.touches[0];
			const rect = canvas.getBoundingClientRect();
			const mx = touch.clientX - rect.left;
			const my = touch.clientY - rect.top;
			const cd = this.cropper.getCanvasData();
			this.wm_pos_x = Math.max(0, Math.min(100, ((mx - this.wm_drag_offset_x - cd.left) / cd.width) * 100));
			this.wm_pos_y = Math.max(0, Math.min(100, ((my - this.wm_drag_offset_y - cd.top) / cd.height) * 100));
			this.wm_draw();
		},

		// Watermark control panel methods
		wm_set_pos_x(val) {
			if (isNaN(val)) return;
			this.wm_pos_x = Math.max(0, Math.min(100, val));
			this.wm_draw();
		},
		wm_set_pos_y(val) {
			if (isNaN(val)) return;
			this.wm_pos_y = Math.max(0, Math.min(100, val));
			this.wm_draw();
		},
		wm_set_size(val) {
			if (isNaN(val)) return;
			this.wm_size = Math.max(5, Math.min(100, val));
			this.wm_draw();
		},
		wm_set_opacity(val) {
			if (isNaN(val)) return;
			this.wm_opacity = Math.max(5, Math.min(100, val));
			this.wm_draw();
		},
		wm_set_mode(mode) {
			this.wm_mode = mode;
			// Tiled mode has no drag target — snap back to "Adjust crop box"
			// interaction so the cursor + wrapper state stays consistent.
			if (mode === "Tiled" && this.interaction_mode === "watermark") {
				this.set_mode("crop");
			}
			this.wm_draw();
		},
		wm_set_tile_size(val) {
			if (isNaN(val)) return;
			this.wm_tile_size = Math.max(3, Math.min(80, val));
			this.wm_draw();
		},
		wm_set_tile_opacity(val) {
			if (isNaN(val)) return;
			this.wm_tile_opacity = Math.max(5, Math.min(100, val));
			this.wm_draw();
		},
		wm_set_tile_rotation(val) {
			if (isNaN(val)) return;
			this.wm_tile_rotation = Math.max(-180, Math.min(180, val));
			this.wm_draw();
		},
		wm_set_tile_spacing(val) {
			if (isNaN(val)) return;
			this.wm_tile_spacing = Math.max(0, Math.min(100, val));
			this.wm_draw();
		},
		async wm_save_defaults() {
			try {
				await frappe.call({
					method: "frappe.client.set_value",
					args: {
						doctype: "Watermark Settings",
						name: "Watermark Settings",
						fieldname: {
							mode: this.wm_mode,
							position_x: Math.round(this.wm_pos_x * 10) / 10,
							position_y: Math.round(this.wm_pos_y * 10) / 10,
							size: Math.round(this.wm_size * 10) / 10,
							opacity: this.wm_opacity,
							tile_size: Math.round(this.wm_tile_size * 10) / 10,
							tile_opacity: this.wm_tile_opacity,
							tile_rotation: this.wm_tile_rotation,
							tile_spacing: this.wm_tile_spacing,
						},
					},
				});
				if (frappe._watermark_settings_cache) {
					Object.assign(frappe._watermark_settings_cache, {
						mode: this.wm_mode,
						position_x: this.wm_pos_x,
						position_y: this.wm_pos_y,
						size: this.wm_size,
						opacity: this.wm_opacity,
						tile_size: this.wm_tile_size,
						tile_opacity: this.wm_tile_opacity,
						tile_rotation: this.wm_tile_rotation,
						tile_spacing: this.wm_tile_spacing,
					});
				}
				frappe.show_alert({ message: __("Watermark defaults saved"), indicator: "green" });
			} catch (e) {
				frappe.show_alert({ message: __("Failed to save defaults"), indicator: "red" });
			}
		},
		wm_reset_defaults() {
			if (this.watermark_settings) {
				const s = this.watermark_settings;
				this.wm_mode = s.mode || "Corner";
				this.wm_pos_x = s.position_x || 80;
				this.wm_pos_y = s.position_y || 90;
				this.wm_size = s.size || 20;
				this.wm_opacity = s.opacity || 50;
				this.wm_tile_size = s.tile_size || 15;
				this.wm_tile_opacity = s.tile_opacity || 20;
				this.wm_tile_rotation = s.tile_rotation != null ? s.tile_rotation : -30;
				this.wm_tile_spacing = s.tile_spacing || 40;
				this.wm_draw();
				frappe.show_alert({ message: __("Reset to defaults"), indicator: "blue" });
			}
		},
	},
};
</script>

<style scoped>
img {
	display: block;
	max-width: 100%;
	/* Cap the image so the whole cropper dialog (image + param cards + action
	   bar + modal chrome) fits inside the viewport. The 420px budget leaves
	   room for: modal header/footer (~120px), section cards (~220px when both
	   open), action bar (~50px), and small margins. Fallback 600px keeps
	   legacy behavior on very tall viewports where calc() overshoots. */
	max-height: min(600px, calc(100vh - 420px));
}

/* ── Unified Image Adjustments panel ──
   A single bordered card hosting Remove BG padding + Watermark controls.
   Each feature contributes a row only when its toggle is on. */
.adjustments-panel {
	margin-top: 12px;
	padding: 14px 16px;
	border: 1px solid var(--border-color);
	border-radius: 10px;
	background: var(--fg-color, white);
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.adjustments-row + .adjustments-row {
	margin-top: 14px;
	padding-top: 14px;
	border-top: 1px solid var(--border-color);
}

.adjustments-field-label {
	display: block;
	margin: 0 0 6px;
	font-size: 12px;
	font-weight: 600;
	color: var(--text-color);
	letter-spacing: 0.01em;
}

.adjustments-warn {
	font-size: 12px;
	color: var(--orange-600, #c2410c);
	background: var(--orange-50, #fff7ed);
	border: 1px solid var(--orange-200, #fed7aa);
	border-radius: 6px;
	padding: 8px 12px;
}

.padding-input-row {
	display: flex;
	align-items: center;
	gap: 12px;
}

.padding-input-row .wm-slider {
	flex: 1;
}

.padding-input-group {
	width: 82px;
	flex-shrink: 0;
}

/* ── Segmented tabs (used by Tiled/Corner + Drag on image switchers) ──
   Selected tab is a solid primary-colored pill with a small shadow; the
   unselected tab keeps its own fully-opaque surface (not transparent) so the
   two states read as equally-present controls, just colored differently. */
.segmented-tabs {
	display: inline-flex;
	padding: 3px;
	background: var(--gray-100, #f3f4f6);
	border: 1px solid var(--border-color);
	border-radius: 8px;
	gap: 2px;
}

.segmented-tab {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 6px 16px;
	border: none;
	border-radius: 6px;
	font-size: var(--text-sm);
	font-weight: 500;
	color: var(--text-color);
	background: transparent;
	cursor: pointer;
	transition: all 0.18s ease;
	white-space: nowrap;
}

.segmented-tab svg {
	opacity: 0.7;
	transition: opacity 0.18s ease;
}

.segmented-tab:hover {
	background: var(--gray-200, #e5e7eb);
}

.segmented-tab:hover svg {
	opacity: 1;
}

.segmented-tab.active {
	background: var(--primary);
	color: white;
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.08);
}

.segmented-tab.active svg {
	opacity: 1;
}

.segmented-tab.active:hover {
	background: var(--primary);
}

/* ── Interaction mode switcher (above image) ── */
.interaction-switcher {
	display: flex;
	align-items: center;
	gap: 10px;
	margin-bottom: 10px;
}

.interaction-switcher-label {
	font-size: 12px;
	color: var(--text-muted);
	font-weight: 500;
	white-space: nowrap;
}

.cropper-image-wrapper {
	position: relative;
}

.cropper-image-wrapper.wm-mode {
	cursor: move;
}

/* While Remove BG is running, hide CropperJS's own crop-box chrome so the
   user sees just the plain image + loading overlay. The crop box is
   meaningless during this ~10-second window (auto-crop will overwrite it
   when the bbox arrives), and leaving it visible is a visual distraction. */
.cropper-image-wrapper.bg-processing >>> .cropper-crop-box,
.cropper-image-wrapper.bg-processing >>> .cropper-dashed,
.cropper-image-wrapper.bg-processing >>> .cropper-line,
.cropper-image-wrapper.bg-processing >>> .cropper-point,
.cropper-image-wrapper.bg-processing >>> .cropper-face,
.cropper-image-wrapper.bg-processing >>> .cropper-view-box {
	display: none !important;
}

.watermark-overlay-canvas {
	position: absolute;
	top: 0;
	left: 0;
	z-index: 5;
	pointer-events: none;
}

/* Sticky action bar at the bottom of the scrollable modal-body. Stays
   visually pinned to the dialog footer edge regardless of content height.
   Negative horizontal margins cancel the modal-body padding so the bar
   spans full width and its border-top/shadow reach both edges. */
.image-cropper-actions {
	position: sticky;
	bottom: 0;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin: 16px calc(var(--padding-lg, 20px) * -1) 0;
	padding: 14px var(--padding-lg, 20px);
	background: white;
	border-top: 1px solid var(--border-color);
	box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.04);
	z-index: 3;
}

.cropper-left-actions {
	display: flex;
	align-items: center;
	gap: 10px;
	flex-wrap: wrap;
}

/* ── Toggle pills ── */
.toggle-pill {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 4px 12px;
	border-radius: 20px;
	font-size: var(--text-sm);
	color: var(--text-muted);
	background: var(--bg-color);
	border: 1px solid var(--border-color);
	cursor: pointer;
	transition: all 0.2s ease;
	user-select: none;
	white-space: nowrap;
}

.toggle-pill:hover { border-color: var(--primary); }

.toggle-pill.active {
	color: var(--primary);
	background: var(--control-bg);
	border-color: var(--primary);
}

.toggle-pill.processing { opacity: 0.7; cursor: wait; }

.toggle-pill-track {
	display: inline-block;
	width: 28px;
	height: 16px;
	border-radius: 8px;
	background: var(--gray-400);
	position: relative;
	transition: background 0.2s ease;
}

.toggle-pill-track.on { background: var(--primary); }

.toggle-pill-thumb {
	position: absolute;
	top: 2px;
	left: 2px;
	width: 12px;
	height: 12px;
	border-radius: 50%;
	background: white;
	transition: transform 0.2s ease;
}

.toggle-pill-track.on .toggle-pill-thumb {
	transform: translateX(12px);
}

/* ── Loading overlay ── */
.cropper-loading-overlay {
	position: absolute;
	top: 0; left: 0; right: 0; bottom: 0;
	background: rgba(255, 255, 255, 0.85);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	z-index: 10;
	gap: 12px;
}

.cropper-spinner {
	width: 36px;
	height: 36px;
	border: 3px solid var(--gray-300);
	border-top-color: var(--primary);
	border-radius: 50%;
	animation: cropper-spin 0.8s linear infinite;
}

.cropper-loading-text {
	font-size: var(--text-sm);
	color: var(--text-muted);
}

@keyframes cropper-spin {
	to { transform: rotate(360deg); }
}

/* ── Watermark control panel ── */
/* .wm-mode-selector / .wm-mode-btn replaced by .segmented-tabs above.
   The Tiled/Corner segmented control appears inside adjustments-row-wm. */
.adjustments-row-wm .segmented-tabs {
	margin-bottom: 12px;
}

.wm-control-label {
	font-size: 11px;
	font-weight: 500;
	color: var(--text-muted);
	margin: 0 0 6px 0;
	line-height: 1.4;
	text-transform: uppercase;
	letter-spacing: 0.03em;
}

.wm-input-group {
	display: flex;
	align-items: center;
	background: var(--fg-color, white);
	border: 1px solid var(--border-color);
	border-radius: var(--border-radius-sm, 4px);
	overflow: hidden;
	height: 28px;
}

.wm-input-group:focus-within {
	border-color: var(--primary);
	box-shadow: 0 0 0 1px var(--primary);
}

.wm-input {
	flex: 1;
	border: none;
	outline: none;
	background: transparent;
	font-size: var(--text-sm);
	color: var(--text-color);
	padding: 0 6px;
	min-width: 0;
	height: 100%;
	-moz-appearance: textfield;
}

.wm-input::-webkit-inner-spin-button,
.wm-input::-webkit-outer-spin-button {
	-webkit-appearance: none;
	margin: 0;
}

.wm-input-suffix {
	font-size: 11px;
	color: var(--text-muted);
	padding: 0 6px;
	user-select: none;
	flex-shrink: 0;
}

.wm-sliders-row {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 18px 28px;
	margin-bottom: 12px;
}

.wm-slider-field {
	display: flex;
	flex-direction: column;
	min-width: 0;
}

@media (max-width: 576px) {
	.wm-sliders-row {
		grid-template-columns: 1fr;
		gap: 14px;
	}
}

.wm-slider {
	width: 100%;
	height: 4px;
	cursor: pointer;
	accent-color: var(--primary);
	margin: 2px 0;
}

.wm-slider-value {
	margin-top: 4px;
	font-size: 11px;
	font-weight: 500;
	color: var(--text-color);
	text-align: center;
}

.wm-panel-actions {
	display: flex;
	justify-content: flex-end;
	gap: 6px;
	margin-top: 8px;
}

.wm-panel-actions .btn-xs {
	font-size: 11px;
	padding: 2px 10px;
	line-height: 1.6;
}

.btn-primary-light {
	background: var(--blue-50, #eff6ff);
	color: var(--primary);
	border: 1px solid var(--blue-200, #bfdbfe);
}

.btn-primary-light:hover {
	background: var(--blue-100, #dbeafe);
	border-color: var(--primary);
}

/* ── Mobile ── */
@media (max-width: 576px) {
	/* Tighter image cap on small viewports so param cards still fit. */
	img {
		max-height: min(400px, calc(100vh - 360px));
	}

	.adjustments-panel {
		padding: 12px;
	}

	.wm-panel-actions {
		justify-content: stretch;
	}

	.wm-panel-actions .btn-xs {
		flex: 1;
		text-align: center;
	}

	.cropper-left-actions {
		gap: 4px;
	}

	.segmented-tabs {
		width: 100%;
	}

	.segmented-tab {
		flex: 1;
		justify-content: center;
		padding: 6px 10px;
		font-size: 12px;
	}
}
</style>

<!-- Global (non-scoped) styles: apply to .modal-body (which sits outside the
     Vue component subtree) and to descendants of .image-cropper-modal-body.
     Scoped styles wouldn't reach modal-body itself, and some descendant
     rules (modal-footer sibling hide) need to bypass scoping too. -->
<style>
.modal-body.image-cropper-modal-body {
	max-height: calc(100vh - 180px);
	overflow-y: auto;
	/* Remove the default modal-body bottom padding so the sticky action
	   bar sits flush at the bottom edge with no visible gap. */
	padding-bottom: 0 !important;
}

/* Hide the dialog's built-in footer (Set all private / Upload) while the
   cropper is active. We use the sibling combinator from modal-body to
   modal-footer because they share the same .modal-content parent. */
.modal-body.image-cropper-modal-body + .modal-footer {
	display: none !important;
}
</style>
