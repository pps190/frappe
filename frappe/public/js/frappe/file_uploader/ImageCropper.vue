<template>
	<div>
		<div class="cropper-image-wrapper">
			<img ref="image" :src="src" :alt="file.name" />
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
					class="remove-bg-pill"
					:class="{ active: bg_removed, processing: bg_processing }"
					@click="toggle_remove_bg"
				>
					<span class="remove-bg-label">{{ __("Remove BG") }}</span>
					<span class="remove-bg-switch">
						<span class="remove-bg-track" :class="{ on: bg_removed }">
							<span class="remove-bg-thumb"></span>
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
	props: ["file", "fixed_aspect_ratio", "show_remove_bg", "remove_bg_checked"],
	data() {
		let aspect_ratio = NaN;
		return {
			src: null,
			cropper: null,
			image: null,
			aspect_ratio,
			bg_removed: false,
			bg_processing: false,
			original_file: null,
			nobg_file: null,
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
		// Use cached files from previous cropper session if available
		this.original_file = this.file._original_file || this.file.cropper_file;
		this.nobg_file = this.file._nobg_file || null;
		this.file._original_file = this.original_file;

		if (this.remove_bg_checked && this.nobg_file) {
			// Already processed before, show nobg version
			this.bg_removed = true;
			this.load_image(this.nobg_file);
		} else {
			this.load_image(this.file.cropper_file);
			// Auto-trigger remove bg if checked and not yet processed
			if (this.show_remove_bg && this.remove_bg_checked && !this.nobg_file) {
				this.do_remove_bg();
			}
		}
	},
	computed: {
		aspect_ratio_buttons() {
			return [
				{
					label: __("1:1"),
					value: 1,
				},
				{
					label: __("4:3"),
					value: 4 / 3,
				},
				{
					label: __("16:9"),
					value: 16 / 9,
				},
				{
					label: __("Free"),
					value: NaN,
				},
			];
		},
	},
	methods: {
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
				});
				window.cropper = this.cropper;
			};
		},
		crop_image() {
			this.file.crop_box_data = this.cropper.getData();
			const canvas = this.cropper.getCroppedCanvas();
			const file_type = this.bg_removed ? "image/png" : this.file.file_obj.type;
			canvas.toBlob((blob) => {
				let name = this.file.name;
				if (this.bg_removed) {
					name = name.replace(/\.[^.]+$/, "_nobg.png");
				}
				var cropped_file_obj = new File([blob], name, {
					type: blob.type,
				});
				this.file.file_obj = cropped_file_obj;
				this.file.name = name;
				this.$emit("toggle_image_cropper");
			}, file_type);
		},
		toggle_remove_bg() {
			if (this.bg_processing) return;

			if (this.bg_removed) {
				// Switch back to original
				this.bg_removed = false;
				this.file.cropper_file = this.original_file;
				this.file.file_obj = this.original_file;
				this.$emit("remove_bg_changed", false);
				this.load_image(this.original_file);
			} else if (this.nobg_file) {
				// Already have processed version, switch to it
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
				// Upload original to temp
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

				// Call remove bg
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
				frappe.show_alert({
					message: __("Background removal failed"),
					indicator: "orange",
				});
				console.error(e);
			} finally {
				this.bg_processing = false;
			}
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
}

.remove-bg-pill {
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

.remove-bg-pill:hover {
	border-color: var(--primary);
}

.remove-bg-pill.active {
	color: var(--primary);
	background: var(--control-bg);
	border-color: var(--primary);
}

.remove-bg-pill.processing {
	opacity: 0.7;
	cursor: wait;
}

.remove-bg-track {
	display: inline-block;
	width: 28px;
	height: 16px;
	border-radius: 8px;
	background: var(--gray-400);
	position: relative;
	transition: background 0.2s ease;
}

.remove-bg-track.on {
	background: var(--primary);
}

.remove-bg-thumb {
	position: absolute;
	top: 2px;
	left: 2px;
	width: 12px;
	height: 12px;
	border-radius: 50%;
	background: white;
	transition: transform 0.2s ease;
}

.remove-bg-track.on .remove-bg-thumb {
	transform: translateX(12px);
}

.cropper-image-wrapper {
	position: relative;
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
</style>
