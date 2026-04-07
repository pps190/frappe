<template>
	<div>
		<div class="cropper-image-wrapper">
			<img ref="image" :src="src" :alt="file.name" />
			<canvas
				v-if="wm_enabled && wm_loaded"
				ref="wm_canvas"
				class="watermark-overlay-canvas"
				@mousedown="wm_mouse_down"
				@mousemove="wm_mouse_move"
				@mouseup="wm_mouse_up"
				@mouseleave="wm_mouse_up"
				@wheel.prevent="wm_scroll"
				@touchstart.prevent="wm_touch_start"
				@touchmove.prevent="wm_touch_move"
				@touchend="wm_mouse_up"
			></canvas>
			<div v-if="bg_processing" class="cropper-loading-overlay">
				<div class="cropper-spinner"></div>
				<div class="cropper-loading-text">{{ __("Removing background...") }}</div>
			</div>
		</div>
		<div class="image-cropper-actions">
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
				<div v-if="wm_enabled && wm_loaded" class="opacity-control">
					<label class="opacity-label">{{ __("Opacity") }}</label>
					<input
						type="range"
						min="5"
						max="100"
						:value="wm_opacity"
						@input="wm_set_opacity($event.target.value)"
						class="opacity-slider"
					/>
					<span class="opacity-value">{{ wm_opacity }}%</span>
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
		"show_remove_bg", "remove_bg_checked",
		"show_watermark", "watermark_settings",
	],
	data() {
		let aspect_ratio = NaN;
		return {
			src: null,
			cropper: null,
			image: null,
			aspect_ratio,
			// Remove BG state
			bg_removed: false,
			bg_processing: false,
			original_file: null,
			nobg_file: null,
			// Watermark state
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
		// Remove BG: use cached files from previous session
		this.original_file = this.file._original_file || this.file.cropper_file;
		this.nobg_file = this.file._nobg_file || null;
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

		// Watermark: load settings and image
		if (this.show_watermark && this.watermark_settings && this.watermark_settings.enabled) {
			this.wm_enabled = true;
			this.wm_pos_x = this.watermark_settings.position_x || 80;
			this.wm_pos_y = this.watermark_settings.position_y || 90;
			this.wm_size = this.watermark_settings.size || 20;
			this.wm_opacity = this.watermark_settings.opacity || 50;
			this.load_watermark_image(this.watermark_settings.watermark_image);
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
	},
	methods: {
		// ── Image loading ──
		load_image(file) {
			if (window.FileReader) {
				let fr = new FileReader();
				fr.onload = () => {
					this.src = fr.result;
					this.$nextTick(() => {
						this.init_cropper();
					});
				};
				fr.readAsDataURL(file);
			}
		},
		init_cropper() {
			if (this.cropper) {
				this.cropper.destroy();
			}
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
				window.cropper = this.cropper;
			};
		},

		// ── Crop ──
		crop_image() {
			this.file.crop_box_data = this.cropper.getData();
			const canvas = this.cropper.getCroppedCanvas();

			// Composite watermark onto the cropped canvas
			if (this.wm_enabled && this.wm_loaded && this.wm_img) {
				const ctx = canvas.getContext("2d");
				const cw = canvas.width;
				const ch = canvas.height;
				const wm_w = (this.wm_size / 100) * cw;
				const wm_h = wm_w * (this.wm_img.naturalHeight / this.wm_img.naturalWidth);
				const cx = (this.wm_pos_x / 100) * cw - wm_w / 2;
				const cy = (this.wm_pos_y / 100) * ch - wm_h / 2;

				ctx.globalAlpha = this.wm_opacity / 100;
				ctx.drawImage(this.wm_img, cx, cy, wm_w, wm_h);
				ctx.globalAlpha = 1.0;
			}

			const file_type = (this.bg_removed || this.wm_enabled) ? "image/png" : this.file.file_obj.type;
			canvas.toBlob((blob) => {
				let name = this.file.name;
				if (this.bg_removed) {
					name = name.replace(/\.[^.]+$/, "_nobg.png");
				}
				if (this.wm_enabled) {
					name = name.replace(/\.[^.]+$/, "_wm.png");
				}
				var cropped_file_obj = new File([blob], name, { type: blob.type });
				this.file.file_obj = cropped_file_obj;
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
					headers: {
						"Accept": "application/json",
						"X-Frappe-CSRF-Token": frappe.csrf_token,
					},
					body: form_data,
				});
				let upload_data = await upload_resp.json();
				let temp_url = upload_data.message.file_url;

				let resp = await frappe.call({
					method: "next.utils.remove_bg.remove_background",
					args: { file_url: temp_url },
				});

				if (resp && resp.message && resp.message.file_url) {
					let blob_resp = await fetch(resp.message.file_url);
					let blob = await blob_resp.blob();
					this.nobg_file = new File([blob], "nobg.png", { type: "image/png" });
					this.file._nobg_file = this.nobg_file;
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
				// Try loading if not yet loaded
				if (this.watermark_settings && this.watermark_settings.watermark_image) {
					this.wm_enabled = true;
					this.load_watermark_image(this.watermark_settings.watermark_image);
				}
				return;
			}
			this.wm_enabled = !this.wm_enabled;
			if (this.wm_enabled) {
				this.$nextTick(() => this.wm_resize_canvas());
			}
		},
		wm_resize_canvas() {
			const canvas = this.$refs.wm_canvas;
			const wrapper = this.$el.querySelector(".cropper-image-wrapper");
			if (!canvas || !wrapper) return;
			// Match the cropper container size
			const cropper_container = wrapper.querySelector(".cropper-container");
			if (cropper_container) {
				canvas.width = cropper_container.offsetWidth;
				canvas.height = cropper_container.offsetHeight;
			} else {
				canvas.width = wrapper.offsetWidth;
				canvas.height = wrapper.offsetHeight;
			}
			this.wm_draw();
		},
		wm_draw() {
			const canvas = this.$refs.wm_canvas;
			if (!canvas || !this.wm_img) return;
			const ctx = canvas.getContext("2d");
			const cw = canvas.width;
			const ch = canvas.height;
			ctx.clearRect(0, 0, cw, ch);

			const r = this.wm_get_rect(cw, ch);
			ctx.globalAlpha = this.wm_opacity / 100;
			ctx.drawImage(this.wm_img, r.x, r.y, r.w, r.h);
			ctx.globalAlpha = 1.0;

			// Dashed border
			ctx.strokeStyle = "rgba(59, 130, 246, 0.5)";
			ctx.lineWidth = 1;
			ctx.setLineDash([4, 4]);
			ctx.strokeRect(r.x, r.y, r.w, r.h);
			ctx.setLineDash([]);
		},
		wm_get_rect(cw, ch) {
			const wm_w = (this.wm_size / 100) * cw;
			const wm_h = wm_w * (this.wm_img.naturalHeight / this.wm_img.naturalWidth);
			const cx = (this.wm_pos_x / 100) * cw;
			const cy = (this.wm_pos_y / 100) * ch;
			return { x: cx - wm_w / 2, y: cy - wm_h / 2, w: wm_w, h: wm_h };
		},
		wm_hit_test(mx, my) {
			const canvas = this.$refs.wm_canvas;
			if (!canvas) return false;
			const r = this.wm_get_rect(canvas.width, canvas.height);
			return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
		},
		wm_mouse_down(e) {
			const canvas = this.$refs.wm_canvas;
			const rect = canvas.getBoundingClientRect();
			const mx = e.clientX - rect.left;
			const my = e.clientY - rect.top;
			if (this.wm_hit_test(mx, my)) {
				this.wm_dragging = true;
				this.wm_drag_offset_x = mx - (this.wm_pos_x / 100) * canvas.width;
				this.wm_drag_offset_y = my - (this.wm_pos_y / 100) * canvas.height;
				canvas.style.cursor = "grabbing";
			}
		},
		wm_mouse_move(e) {
			const canvas = this.$refs.wm_canvas;
			const rect = canvas.getBoundingClientRect();
			const mx = e.clientX - rect.left;
			const my = e.clientY - rect.top;
			if (!this.wm_dragging) {
				canvas.style.cursor = this.wm_hit_test(mx, my) ? "grab" : "default";
				return;
			}
			this.wm_pos_x = Math.max(0, Math.min(100, ((mx - this.wm_drag_offset_x) / canvas.width) * 100));
			this.wm_pos_y = Math.max(0, Math.min(100, ((my - this.wm_drag_offset_y) / canvas.height) * 100));
			this.wm_draw();
		},
		wm_mouse_up() {
			if (this.wm_dragging) {
				this.wm_dragging = false;
				const canvas = this.$refs.wm_canvas;
				if (canvas) canvas.style.cursor = "grab";
			}
		},
		wm_scroll(e) {
			const delta = e.deltaY > 0 ? -1 : 1;
			this.wm_size = Math.max(5, Math.min(80, this.wm_size + delta));
			this.wm_draw();
		},
		wm_set_opacity(val) {
			this.wm_opacity = parseInt(val);
			this.wm_draw();
		},
		wm_touch_start(e) {
			const touch = e.touches[0];
			const canvas = this.$refs.wm_canvas;
			const rect = canvas.getBoundingClientRect();
			const mx = touch.clientX - rect.left;
			const my = touch.clientY - rect.top;
			if (this.wm_hit_test(mx, my)) {
				this.wm_dragging = true;
				this.wm_drag_offset_x = mx - (this.wm_pos_x / 100) * canvas.width;
				this.wm_drag_offset_y = my - (this.wm_pos_y / 100) * canvas.height;
			}
		},
		wm_touch_move(e) {
			if (!this.wm_dragging) return;
			const touch = e.touches[0];
			const canvas = this.$refs.wm_canvas;
			const rect = canvas.getBoundingClientRect();
			const mx = touch.clientX - rect.left;
			const my = touch.clientY - rect.top;
			this.wm_pos_x = Math.max(0, Math.min(100, ((mx - this.wm_drag_offset_x) / canvas.width) * 100));
			this.wm_pos_y = Math.max(0, Math.min(100, ((my - this.wm_drag_offset_y) / canvas.height) * 100));
			this.wm_draw();
		},
	},
};
</script>

<style scoped>
img {
	display: block;
	max-width: 100%;
	max-height: 600px;
}

.image-cropper-actions {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: var(--margin-md);
}

.cropper-left-actions {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-wrap: wrap;
}

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

.toggle-pill:hover {
	border-color: var(--primary);
}

.toggle-pill.active {
	color: var(--primary);
	background: var(--control-bg);
	border-color: var(--primary);
}

.toggle-pill.processing {
	opacity: 0.7;
	cursor: wait;
}

.toggle-pill-track {
	display: inline-block;
	width: 28px;
	height: 16px;
	border-radius: 8px;
	background: var(--gray-400);
	position: relative;
	transition: background 0.2s ease;
}

.toggle-pill-track.on {
	background: var(--primary);
}

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

.cropper-image-wrapper {
	position: relative;
}

.watermark-overlay-canvas {
	position: absolute;
	top: 0;
	left: 0;
	z-index: 5;
	pointer-events: auto;
}

.cropper-loading-overlay {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
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

.opacity-control {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: var(--text-sm);
	color: var(--text-muted);
}

.opacity-label {
	margin: 0;
	white-space: nowrap;
}

.opacity-slider {
	width: 80px;
	height: 4px;
	cursor: pointer;
	accent-color: var(--primary);
}

.opacity-value {
	min-width: 32px;
	text-align: right;
}
</style>
