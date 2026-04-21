<template>
	<div
		class="file-uploader"
		:class="{
			'fu-with-panel': any_feature_shown && !show_image_cropper && !show_file_browser && !show_web_link,
		}"
		@dragover.prevent="dragover"
		@dragleave.prevent="dragleave"
		@drop.prevent="dropfiles"
	>
		<!-- LEFT COLUMN: dropzone (step 1) OR file list (step 3) -->
		<div class="fu-left-col">
		<div
			class="file-upload-area"
			v-show="files.length === 0 && !show_file_browser && !show_web_link"
		>
			<div v-if="!is_dragging">
				<div class="text-center">
					{{ __("Drag and drop files here or upload from") }}
				</div>
				<div class="mt-2 text-center">
					<button class="btn btn-file-upload" @click="browse_files">
						<svg
							width="30"
							height="30"
							viewBox="0 0 30 30"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<circle cx="15" cy="15" r="15" fill="url(#paint0_linear)" />
							<path
								d="M13.5 22V19"
								stroke="white"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
							<path
								d="M16.5 22V19"
								stroke="white"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
							<path
								d="M10.5 22H19.5"
								stroke="white"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
							<path
								d="M7.5 16H22.5"
								stroke="white"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
							<path
								d="M21 8H9C8.17157 8 7.5 8.67157 7.5 9.5V17.5C7.5 18.3284 8.17157 19 9 19H21C21.8284 19 22.5 18.3284 22.5 17.5V9.5C22.5 8.67157 21.8284 8 21 8Z"
								stroke="white"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
							<defs>
								<linearGradient
									id="paint0_linear"
									x1="0"
									y1="0"
									x2="0"
									y2="30"
									gradientUnits="userSpaceOnUse"
								>
									<stop stop-color="#2C9AF1" />
									<stop offset="1" stop-color="#2490EF" />
								</linearGradient>
							</defs>
						</svg>
						<div class="mt-1">{{ __("My Device") }}</div>
					</button>
					<input
						type="file"
						class="hidden"
						ref="file_input"
						@change="on_file_input"
						:multiple="allow_multiple"
						:accept="(restrictions.allowed_file_types || []).join(', ')"
					/>
					<button
						class="btn btn-file-upload"
						v-if="!disable_file_browser"
						@click="show_file_browser = true"
					>
						<svg
							width="30"
							height="30"
							viewBox="0 0 30 30"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<circle cx="15" cy="15" r="15" fill="#48BB74" />
							<path
								d="M13.0245 11.5H8C7.72386 11.5 7.5 11.7239 7.5 12V20C7.5 21.1046 8.39543 22 9.5 22H20.5C21.6046 22 22.5 21.1046 22.5 20V14.5C22.5 14.2239 22.2761 14 22 14H15.2169C15.0492 14 14.8926 13.9159 14.8 13.776L13.4414 11.724C13.3488 11.5841 13.1922 11.5 13.0245 11.5Z"
								stroke="white"
								stroke-miterlimit="10"
								stroke-linecap="square"
							/>
							<path
								d="M8.87939 9.5V8.5C8.87939 8.22386 9.10325 8 9.37939 8H20.6208C20.8969 8 21.1208 8.22386 21.1208 8.5V12"
								stroke="white"
								stroke-miterlimit="10"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
						<div class="mt-1">{{ __("Library") }}</div>
					</button>
					<button
						class="btn btn-file-upload"
						v-if="allow_web_link"
						@click="show_web_link = true"
					>
						<svg
							width="30"
							height="30"
							viewBox="0 0 30 30"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<circle cx="15" cy="15" r="15" fill="#ECAC4B" />
							<path
								d="M12.0469 17.9543L17.9558 12.0454"
								stroke="white"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
							<path
								d="M13.8184 11.4547L15.7943 9.47873C16.4212 8.85205 17.2714 8.5 18.1578 8.5C19.0443 8.5 19.8945 8.85205 20.5214 9.47873V9.47873C21.1481 10.1057 21.5001 10.9558 21.5001 11.8423C21.5001 12.7287 21.1481 13.5789 20.5214 14.2058L18.5455 16.1818"
								stroke="white"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
							<path
								d="M11.4547 13.8184L9.47873 15.7943C8.85205 16.4212 8.5 17.2714 8.5 18.1578C8.5 19.0443 8.85205 19.8945 9.47873 20.5214V20.5214C10.1057 21.1481 10.9558 21.5001 11.8423 21.5001C12.7287 21.5001 13.5789 21.1481 14.2058 20.5214L16.1818 18.5455"
								stroke="white"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
						<div class="mt-1">{{ __("Link") }}</div>
					</button>
					<button
						v-if="allow_take_photo"
						class="btn btn-file-upload"
						@click="capture_image"
					>
						<svg
							width="30"
							height="30"
							viewBox="0 0 30 30"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<circle cx="15" cy="15" r="15" fill="#CE315B" />
							<path
								d="M11.5 10.5H9.5C8.67157 10.5 8 11.1716 8 12V20C8 20.8284 8.67157 21.5 9.5 21.5H20.5C21.3284 21.5 22 20.8284 22 20V12C22 11.1716 21.3284 10.5 20.5 10.5H18.5L17.3 8.9C17.1111 8.64819 16.8148 8.5 16.5 8.5H13.5C13.1852 8.5 12.8889 8.64819 12.7 8.9L11.5 10.5Z"
								stroke="white"
								stroke-linejoin="round"
							/>
							<circle cx="15" cy="16" r="2.5" stroke="white" />
						</svg>
						<div class="mt-1">{{ __("Camera") }}</div>
					</button>
					<button
						v-if="google_drive_settings.enabled"
						class="btn btn-file-upload"
						@click="show_google_drive_picker"
					>
						<svg width="30" height="30">
							<image
								href="/assets/frappe/icons/social/google_drive.svg"
								width="30"
								height="30"
							/>
						</svg>
						<div class="mt-1">{{ __("Google Drive") }}</div>
					</button>
				</div>
				<div class="text-muted text-medium text-center">
					{{ upload_notes }}
				</div>
			</div>
			<div v-else>
				{{ __("Drop files here") }}
			</div>
		</div>
		<div
			class="file-preview-area"
			v-show="files.length && !show_file_browser && !show_web_link"
		>
			<div class="file-preview-container" v-if="!show_image_cropper">
				<FilePreview
					v-for="(file, i) in files"
					:key="file.name"
					:file="file"
					@remove="remove_file(file)"
					@toggle_private="file.private = !file.private"
					@toggle_optimize="file.optimize = !file.optimize"
					@toggle_image_cropper="toggle_image_cropper(i)"
				/>
			</div>
			<div class="flex align-center" v-if="show_upload_button && currently_uploading === -1">
				<button class="btn btn-primary btn-sm margin-right" @click="upload_files">
					<span v-if="files.length === 1">
						{{ __("Upload file") }}
					</span>
					<span v-else>
						{{ __("Upload {0} files", [files.length]) }}
					</span>
				</button>
				<div class="text-muted text-medium">
					{{ __("Click on the lock icon to toggle public/private") }}
				</div>
			</div>
		</div>
		</div><!-- /.fu-left-col -->

		<!-- RIGHT COLUMN: feature tabs + pane OR recap card
		     Only rendered outside the cropper step (cropper has its own
		     identical panel). Hidden entirely when no feature was
		     requested, so non-image uploads keep the simple single-column
		     layout that Frappe's default uploader has. -->
		<div
			class="fu-right-col"
			v-if="any_feature_shown && !show_image_cropper && !show_file_browser && !show_web_link"
		>
			<!-- Step 3 (files added, crop committed): read-only recap -->
			<template v-if="files.length > 0">
				<div class="fu-recap-card">
					<div class="fu-recap-title">{{ __("Applied to your image") }}</div>
					<div class="fu-recap-hint">{{ __("Locked in at the Crop step — cannot be edited after upload.") }}</div>
					<ul class="fu-recap-list">
						<li v-if="show_remove_bg" :class="{ off: !remove_bg_checked }">
							<span class="fu-recap-dot" :class="remove_bg_checked ? 'on' : 'off'"></span>
							<span class="fu-recap-label">{{ __("Remove Background") }}</span>
							<span class="fu-recap-value">{{ remove_bg_checked ? __("on") : __("off") }}</span>
						</li>
						<li v-if="show_watermark" :class="{ off: !wm_enabled }">
							<span class="fu-recap-dot" :class="wm_enabled ? 'on' : 'off'"></span>
							<span class="fu-recap-label">{{ __("Watermark") }}</span>
							<span class="fu-recap-value">
								{{ wm_enabled
									? (watermark_settings && watermark_settings.mode === "Corner" ? __("Corner") : __("Tiled"))
									: __("off") }}
							</span>
						</li>
						<li v-if="show_comments" :class="{ off: !comments_enabled_default }">
							<span class="fu-recap-dot" :class="comments_enabled_default ? 'on' : 'off'"></span>
							<span class="fu-recap-label">{{ __("Comments") }}</span>
							<span class="fu-recap-value">{{ comments_enabled_default ? __("on") : __("off") }}</span>
						</li>
						<li v-if="show_resize" :class="{ off: !resize_enabled_default }">
							<span class="fu-recap-dot" :class="resize_enabled_default ? 'on' : 'off'"></span>
							<span class="fu-recap-label">{{ __("Canvas") }}</span>
							<span class="fu-recap-value">{{ resize_enabled_default ? (resize_settings && resize_settings.resize_aspect) || "1:1" : __("off") }}</span>
						</li>
					</ul>
				</div>
			</template>

			<!-- Step 1 (no files yet): interactive 4-tab panel -->
			<template v-else>
				<div class="fu-feature-tabs" role="tablist">
					<button
						v-for="tab in available_tabs"
						:key="tab.key"
						type="button"
						class="fu-feature-tab"
						:class="{ active: active_tab === tab.key }"
						role="tab"
						:aria-selected="active_tab === tab.key"
						@click="active_tab = tab.key"
					>
						<span class="fu-feature-tab-label">{{ tab.label }}</span>
						<span class="fu-feature-tab-state" :class="tab.on ? 'on' : 'off'">
							<span class="fu-feature-tab-dot"></span>
							{{ tab.on ? __("on") : __("off") }}
						</span>
					</button>
				</div>

				<div class="fu-tab-body">
					<!-- REMOVE BG pane -->
					<div v-show="active_tab === 'remove_bg'" class="fu-tab-pane">
						<div class="fu-tab-enable">
							<span class="fu-tab-enable-label">{{ __("Enable Remove Background") }}</span>
							<div
								class="fu-toggle-pill"
								:class="{ active: remove_bg_checked, 'is-disabled': !!remove_bg_disabled_hint }"
								@click="!remove_bg_disabled_hint && (remove_bg_checked = !remove_bg_checked)"
							>
								<span class="fu-toggle-track" :class="{ on: remove_bg_checked && !remove_bg_disabled_hint }">
									<span class="fu-toggle-thumb"></span>
								</span>
							</div>
						</div>
						<div v-if="remove_bg_disabled_hint" class="fu-tab-note">
							{{ remove_bg_disabled_hint }}
							<a v-if="remove_bg_disabled_link" :href="remove_bg_disabled_link">{{ __("Configure") }}</a>
						</div>
						<div v-else class="fu-tab-note">
							{{ __("Auto-crop padding + mask preview available after adding a file.") }}
						</div>
					</div>

					<!-- WATERMARK pane -->
					<div v-show="active_tab === 'watermark'" class="fu-tab-pane">
						<div class="fu-tab-enable">
							<span class="fu-tab-enable-label">{{ __("Enable Watermark") }}</span>
							<div
								class="fu-toggle-pill"
								:class="{ active: wm_enabled, 'is-disabled': !watermark_settings || !watermark_settings.watermark_image }"
								@click="(watermark_settings && watermark_settings.watermark_image) && (wm_enabled = !wm_enabled)"
							>
								<span class="fu-toggle-track" :class="{ on: wm_enabled }">
									<span class="fu-toggle-thumb"></span>
								</span>
							</div>
						</div>
						<div v-if="!watermark_settings || !watermark_settings.watermark_image" class="fu-tab-note">
							{{ __("No watermark image uploaded.") }}
							<a href="/app/watermark-settings">{{ __("Configure") }}</a>
						</div>
						<div v-else class="fu-tab-note">
							{{ __("Mode: {0}. Position, size and rotation are editable in the Crop step.", [(watermark_settings && watermark_settings.mode) || "Tiled"]) }}
						</div>
					</div>

					<!-- COMMENTS pane -->
					<div v-show="active_tab === 'comments'" class="fu-tab-pane">
						<div class="fu-tab-enable">
							<span class="fu-tab-enable-label">{{ __("Enable Comments") }}</span>
							<div
								class="fu-toggle-pill"
								:class="{ active: comments_enabled_default }"
								@click="comments_enabled_default = !comments_enabled_default"
							>
								<span class="fu-toggle-track" :class="{ on: comments_enabled_default }">
									<span class="fu-toggle-thumb"></span>
								</span>
							</div>
						</div>
						<div class="fu-tab-note">
							{{ __("Add, position and style text overlays in the Crop step.") }}
						</div>
					</div>

					<!-- CANVAS pane (aspect + mode are editable here, baked later) -->
					<div v-show="active_tab === 'canvas'" class="fu-tab-pane">
						<div class="fu-tab-enable">
							<span class="fu-tab-enable-label">{{ __("Enable Canvas normalization") }}</span>
							<div
								class="fu-toggle-pill"
								:class="{ active: resize_enabled_default }"
								@click="resize_enabled_default = !resize_enabled_default"
							>
								<span class="fu-toggle-track" :class="{ on: resize_enabled_default }">
									<span class="fu-toggle-thumb"></span>
								</span>
							</div>
						</div>
						<div v-if="resize_enabled_default && resize_settings" class="fu-tab-field">
							<label class="fu-tab-field-label">{{ __("Aspect") }}</label>
							<div class="fu-seg-row">
								<button
									v-for="opt in ['1:1', '4:3', '16:9', '3:2', '2:3', 'Free']"
									:key="opt"
									type="button"
									class="fu-seg-btn"
									:class="{ active: (resize_settings.resize_aspect || '1:1') === opt }"
									@click="_set_canvas_aspect(opt)"
								>{{ opt }}</button>
							</div>
						</div>
						<div v-if="resize_enabled_default && resize_settings" class="fu-tab-field">
							<label class="fu-tab-field-label">{{ __("Mode") }}</label>
							<div class="fu-seg-row">
								<button
									v-for="opt in ['Contain', 'Cover', 'Stretch']"
									:key="opt"
									type="button"
									class="fu-seg-btn"
									:class="{ active: (resize_settings.resize_mode || 'Contain') === opt }"
									@click="_set_canvas_mode(opt)"
								>{{ __(opt) }}</button>
							</div>
						</div>
						<div v-else class="fu-tab-note">
							{{ __("Resize, background color and file-size cap are configurable in the Crop step.") }}
						</div>
					</div>
				</div>
			</template>
		</div><!-- /.fu-right-col -->

		<ImageCropper
			v-if="show_image_cropper && wrapper_ready"
			:file="files[crop_image_with_index]"
			:fixed_aspect_ratio="restrictions.crop_image_aspect_ratio"
			:show_remove_bg="show_remove_bg && !remove_bg_disabled_hint"
			:remove_bg_checked="remove_bg_checked"
			:remove_bg_padding_pct="remove_bg_padding_pct"
			:show_watermark="show_watermark"
			:watermark_settings="watermark_settings"
			:wm_default_enabled="wm_enabled"
			:show_resize="show_resize"
			:resize_settings="resize_settings"
			:resize_default_enabled="resize_enabled_default"
			:show_comments="show_comments"
			:comment_defaults="comment_defaults"
			:comment_presets="comment_presets"
			:comments_default_enabled="comments_enabled_default"
			@toggle_image_cropper="toggle_image_cropper(-1)"
			@upload_after_crop="trigger_upload = true"
			@remove_bg_changed="remove_bg_checked = $event"
			@wm_enabled_changed="wm_enabled = $event"
			@comments_enabled_changed="comments_enabled_default = $event"
			@resize_enabled_changed="resize_enabled_default = $event"
		/>
		<FileBrowser
			ref="file_browser"
			v-if="show_file_browser && !disable_file_browser"
			@hide-browser="show_file_browser = false"
		/>
		<WebLink ref="web_link" v-if="show_web_link" @hide-web-link="show_web_link = false" />
	</div>
</template>

<script>
import FilePreview from "./FilePreview.vue";
import FileBrowser from "./FileBrowser.vue";
import WebLink from "./WebLink.vue";
import GoogleDrivePicker from "../../integrations/google_drive_picker";
import ImageCropper from "./ImageCropper.vue";

export default {
	name: "FileUploader",
	props: {
		show_upload_button: {
			default: true,
		},
		disable_file_browser: {
			default: false,
		},
		allow_multiple: {
			default: true,
		},
		as_dataurl: {
			default: false,
		},
		doctype: {
			default: null,
		},
		docname: {
			default: null,
		},
		fieldname: {
			default: null,
		},
		folder: {
			default: "Home",
		},
		method: {
			default: null,
		},
		on_success: {
			default: null,
		},
		make_attachments_public: {
			default: null,
		},
		restrictions: {
			default: () => ({
				max_file_size: null, // 2048 -> 2KB
				max_number_of_files: null,
				allowed_file_types: [], // ['image/*', 'video/*', '.jpg', '.gif', '.pdf'],
				crop_image_aspect_ratio: null, // 1, 16 / 9, 4 / 3, NaN (free)
			}),
		},
		attach_doc_image: {
			default: false,
		},
		upload_notes: {
			default: null, // "Images or video, upto 2MB"
		},
		show_remove_bg: {
			default: false,
		},
		remove_bg_default: {
			default: true,
		},
		remove_bg_disabled_hint: {
			default: null,
		},
		remove_bg_padding_pct: {
			default: 5,
		},
		show_watermark: {
			default: false,
		},
		watermark_settings: {
			default: null,
		},
		// Resize (new 2026-04) — aspect normalization applied at
		// Crop time. Mirror of Image Processing Settings' resize_* fields.
		show_resize: {
			default: false,
		},
		resize_settings: {
			default: null,
		},
		// Comments (new 2026-04) — show the text-overlay list editor in
		// the Cropper. comment_defaults = default style for new boxes;
		// comment_presets = quick-insert library from Image Processing
		// Settings.
		show_comments: {
			default: false,
		},
		comment_defaults: {
			default: null,
		},
		comment_presets: {
			default: null,
		},
	},
	components: {
		FilePreview,
		FileBrowser,
		WebLink,
		ImageCropper,
	},
	data() {
		return {
			files: [],
			is_dragging: false,
			currently_uploading: -1,
			show_file_browser: false,
			show_web_link: false,
			show_image_cropper: false,
			crop_image_with_index: -1,
			trigger_upload: false,
			close_dialog: false,
			hide_dialog_footer: false,
			allow_take_photo: false,
			allow_web_link: true,
			google_drive_settings: {
				enabled: false,
			},
			wrapper_ready: false,
			remove_bg_checked: this.remove_bg_default && !this.remove_bg_disabled_hint,
			wm_enabled: this.watermark_settings && this.watermark_settings.enabled ? true : false,
			// Pre-cropper toggles for Comments + Canvas so the file-picker
			// page exposes the same 4 features the cropper tab-panel does.
			// Actual application happens inside ImageCropper; these just
			// carry the user's default toggle intent into the cropper.
			comments_enabled_default: !!(this.comment_defaults && this.comment_defaults.enabled),
			resize_enabled_default: !!(this.resize_settings && this.resize_settings.resize_enabled),
			// Which right-panel tab is visible on Step 1. Reset in mounted()
			// to the first-available feature so the pane doesn't open on a
			// tab the consumer didn't opt into.
			active_tab: "remove_bg",
		};
	},
	created() {
		this.allow_take_photo = window.navigator.mediaDevices;
		if (frappe.user_id !== "Guest") {
			frappe.call({
				// method only available after login
				method: "frappe.integrations.doctype.google_settings.google_settings.get_file_picker_settings",
				callback: (resp) => {
					if (!resp.exc) {
						this.google_drive_settings = resp.message;
					}
				},
			});
		}
		if (this.restrictions.max_file_size == null) {
			frappe.call("frappe.core.api.file.get_max_file_size").then((res) => {
				this.restrictions.max_file_size = Number(res.message);
			});
		}
		if (this.restrictions.max_number_of_files == null && this.doctype) {
			this.restrictions.max_number_of_files = frappe.get_meta(this.doctype)?.max_attachments;
		}
	},
	watch: {
		files(newvalue, oldvalue) {
			if (!this.allow_multiple && newvalue.length > 1) {
				this.files = [newvalue[newvalue.length - 1]];
			}
		},
		remove_bg_checked(checked) {
			// Swap file_obj between original and nobg using cached files
			this.files.forEach((file, i) => {
				if (!file._original_file || !file._nobg_file) return;
				let target = checked ? file._nobg_file : file._original_file;
				// Use Vue.set to ensure reactivity
				this.$set(file, "file_obj", target);
				this.$set(file, "cropper_file", target);
			});
		},
	},
	computed: {
		upload_complete() {
			return (
				this.files.length > 0 &&
				this.files.every((file) => file.total !== 0 && file.progress === file.total)
			);
		},
		// At least one of the 4 image-processing features was opted-in by
		// the caller. Controls whether the right-side panel renders at all
		// — a plain Attachment upload (no image processing) stays
		// single-column like the original Frappe uploader.
		any_feature_shown() {
			return !!(this.show_remove_bg || this.show_watermark
				|| this.show_comments || this.show_resize);
		},
		// Tab objects used by the v-for in the template. Each entry knows
		// its ON state so the pill header can render the green/grey dot
		// without the template having to branch on key.
		available_tabs() {
			const tabs = [];
			if (this.show_remove_bg) {
				tabs.push({
					key: "remove_bg",
					label: __("Remove BG"),
					on: !!this.remove_bg_checked && !this.remove_bg_disabled_hint,
				});
			}
			if (this.show_watermark) {
				tabs.push({
					key: "watermark",
					label: __("Watermark"),
					on: !!this.wm_enabled,
				});
			}
			if (this.show_comments) {
				tabs.push({
					key: "comments",
					label: __("Comments"),
					on: !!this.comments_enabled_default,
				});
			}
			if (this.show_resize) {
				tabs.push({
					key: "canvas",
					label: __("Canvas"),
					on: !!this.resize_enabled_default,
				});
			}
			return tabs;
		},
	},
	mounted() {
		// Reset active_tab to the first available feature, so the panel
		// doesn't land on a tab the consumer didn't opt into.
		const first = this.available_tabs[0];
		if (first) this.active_tab = first.key;
	},
	methods: {
		// Canvas (Resize) aspect + mode editors for Step 1. We mutate the
		// resize_settings object in place so the cropper picks up the
		// latest values via its own prop watcher when the user clicks Crop.
		_set_canvas_aspect(opt) {
			if (!this.resize_settings) return;
			this.$set(this.resize_settings, "resize_aspect", opt);
		},
		_set_canvas_mode(opt) {
			if (!this.resize_settings) return;
			this.$set(this.resize_settings, "resize_mode", opt);
		},
		dragover() {
			this.is_dragging = true;
		},
		dragleave() {
			this.is_dragging = false;
		},
		dropfiles(e) {
			this.is_dragging = false;
			this.add_files(e.dataTransfer.files);
		},
		browse_files() {
			this.$refs.file_input.click();
		},
		on_file_input(e) {
			this.add_files(this.$refs.file_input.files);
		},
		remove_file(file) {
			this.files = this.files.filter((f) => f !== file);
		},
		toggle_image_cropper(index) {
			this.crop_image_with_index = this.show_image_cropper ? -1 : index;
			this.hide_dialog_footer = !this.show_image_cropper;
			this.show_image_cropper = !this.show_image_cropper;
		},
		toggle_all_private() {
			let flag;
			let private_values = this.files.filter((file) => file.private);
			if (private_values.length < this.files.length) {
				// there are some private and some public
				// set all to private
				flag = true;
			} else {
				// all are private, set all to public
				flag = false;
			}
			this.files = this.files.map((file) => {
				file.private = flag;
				return file;
			});
		},
		show_max_files_number_warning(file) {
			console.warn(
				`File skipped because it exceeds the allowed specified limit of ${max_number_of_files} uploads`,
				file
			);
			if (this.doctype) {
				MSG = __(
					'File "{0}" was skipped because only {1} uploads are allowed for DocType "{2}"',
					[file.name, max_number_of_files, this.doctype]
				);
			} else {
				MSG = __('File "{0}" was skipped because only {1} uploads are allowed', [
					file.name,
					max_number_of_files,
				]);
			}
			frappe.show_alert({
				message: MSG,
				indicator: "orange",
			});
		},
		add_files(file_array) {
			let files = Array.from(file_array)
				.filter(this.check_restrictions)
				.map((file) => {
					let is_image = file.type.startsWith("image");
					let size_kb = file.size / 1024;
					return {
						file_obj: file,
						cropper_file: file,
						crop_box_data: null,
						optimize: size_kb > 200 && is_image && !file.type.includes("svg"),
						name: file.name,
						doc: null,
						progress: 0,
						total: 0,
						failed: false,
						request_succeeded: false,
						error_message: null,
						uploading: false,
						private: !this.make_attachments_public,
					};
				});

			// pop extra files as per FileUploader.restrictions.max_number_of_files
			max_number_of_files = this.restrictions.max_number_of_files;
			if (max_number_of_files && files.length > max_number_of_files) {
				files.slice(max_number_of_files).forEach((file) => {
					this.show_max_files_number_warning(file, this.doctype);
				});

				files = files.slice(0, max_number_of_files);
			}

			this.files = this.files.concat(files);
			// if only one file is allowed and crop_image_aspect_ratio is set, open cropper immediately
			if (
				this.files.length === 1 &&
				!this.allow_multiple &&
				this.restrictions.crop_image_aspect_ratio != null
			) {
				if (!this.files[0].file_obj.type.includes("svg")) {
					this.toggle_image_cropper(0);
				}
			}
		},
		check_restrictions(file) {
			let { max_file_size, allowed_file_types = [] } = this.restrictions;

			let is_correct_type = true;
			let valid_file_size = true;

			if (allowed_file_types && allowed_file_types.length) {
				is_correct_type = allowed_file_types.some((type) => {
					// is this is a mime-type
					if (type.includes("/")) {
						if (!file.type) return false;
						return file.type.match(type);
					}

					// otherwise this is likely an extension
					if (type[0] === ".") {
						return file.name.toLowerCase().endsWith(type.toLowerCase());
					}
					return false;
				});
			}

			if (max_file_size && file.size != null) {
				valid_file_size = file.size < max_file_size;
			}

			if (!is_correct_type) {
				console.warn("File skipped because of invalid file type", file);
				frappe.show_alert({
					message: __('File "{0}" was skipped because of invalid file type', [
						file.name,
					]),
					indicator: "orange",
				});
			}
			if (!valid_file_size) {
				console.warn("File skipped because of invalid file size", file.size, file);
				frappe.show_alert({
					message: __('File "{0}" was skipped because size exceeds {1} MB', [
						file.name,
						max_file_size / (1024 * 1024),
					]),
					indicator: "orange",
				});
			}

			return is_correct_type && valid_file_size;
		},
		upload_files() {
			if (this.show_file_browser) {
				return this.upload_via_file_browser();
			}
			if (this.show_web_link) {
				return this.upload_via_web_link();
			}
			if (this.as_dataurl) {
				return this.return_as_dataurl();
			}
			return frappe
				.run_serially(this.files.map((file, i) => () => this.upload_file(file, i)))
				.finally(() => {
					// Reset upload state so the primary button re-enables when
					// any upload ends (success that didn't auto-close, or error).
					this.currently_uploading = -1;
				});
		},
		upload_via_file_browser() {
			let selected_file = this.$refs.file_browser.selected_node;
			if (!selected_file.value) {
				frappe.msgprint(__("Click on a file to select it."));
				this.close_dialog = true;
				return Promise.reject();
			}
			this.close_dialog = true;
			return this.upload_file({
				library_file_name: selected_file.value,
			});
		},
		upload_via_web_link() {
			let file_url = this.$refs.web_link.url;
			if (!file_url) {
				frappe.msgprint(__("Invalid URL"));
				this.close_dialog = true;
				return Promise.reject();
			}
			file_url = decodeURI(file_url);
			this.close_dialog = true;
			return this.upload_file({
				file_url,
			});
		},
		return_as_dataurl() {
			let promises = this.files.map((file) =>
				frappe.dom.file_to_base64(file.file_obj).then((dataurl) => {
					file.dataurl = dataurl;
					this.on_success && this.on_success(file);
				})
			);
			this.close_dialog = true;
			return Promise.all(promises);
		},
		upload_file(file, i) {
			this.currently_uploading = i;

			return new Promise((resolve, reject) => {
				let xhr = new XMLHttpRequest();
				xhr.upload.addEventListener("loadstart", (e) => {
					file.uploading = true;
				});
				xhr.upload.addEventListener("progress", (e) => {
					if (e.lengthComputable) {
						file.progress = e.loaded;
						file.total = e.total;
					}
				});
				xhr.upload.addEventListener("load", (e) => {
					file.uploading = false;
					resolve();
				});
				xhr.addEventListener("error", (e) => {
					file.failed = true;
					reject();
				});
				xhr.onreadystatechange = () => {
					if (xhr.readyState == XMLHttpRequest.DONE) {
						if (xhr.status === 200) {
							file.request_succeeded = true;
							let r = null;
							let file_doc = null;
							try {
								r = JSON.parse(xhr.responseText);
								if (r.message.doctype === "File") {
									file_doc = r.message;
								}
							} catch (e) {
								r = xhr.responseText;
							}

							file.doc = file_doc;

							if (this.on_success) {
								this.on_success(file_doc, r);
							}

							if (
								i == this.files.length - 1 &&
								this.files.every((file) => file.request_succeeded)
							) {
								this.close_dialog = true;
							}
						} else if (xhr.status === 403) {
							file.failed = true;
							let response = JSON.parse(xhr.responseText);
							file.error_message = `Not permitted. ${response._error_message || ""}`;
						} else if (xhr.status === 413) {
							file.failed = true;
							file.error_message = "Size exceeds the maximum allowed file size.";
						} else {
							file.failed = true;
							file.error_message =
								xhr.status === 0
									? "XMLHttpRequest Error"
									: `${xhr.status} : ${xhr.statusText}`;

							let error = null;
							try {
								error = JSON.parse(xhr.responseText);
							} catch (e) {
								// pass
							}
							frappe.request.cleanup({}, error);
						}
					}
				};
				xhr.open("POST", "/api/method/upload_file", true);
				xhr.setRequestHeader("Accept", "application/json");
				xhr.setRequestHeader("X-Frappe-CSRF-Token", frappe.csrf_token);

				let form_data = new FormData();
				if (file.file_obj) {
					form_data.append("file", file.file_obj, file.name);
				}
				form_data.append("is_private", +file.private);
				form_data.append("folder", this.folder);

				if (file.file_url) {
					form_data.append("file_url", file.file_url);
				}

				if (file.file_name) {
					form_data.append("file_name", file.file_name);
				}

				if (file.library_file_name) {
					form_data.append("library_file_name", file.library_file_name);
				}

				if (this.doctype && this.docname) {
					form_data.append("doctype", this.doctype);
					form_data.append("docname", this.docname);
				}

				if (this.fieldname) {
					form_data.append("fieldname", this.fieldname);
				}

				if (this.method) {
					form_data.append("method", this.method);
				}

				if (file.optimize) {
					form_data.append("optimize", true);
				}

				if (this.attach_doc_image) {
					form_data.append("max_width", 200);
					form_data.append("max_height", 200);
				}

				xhr.send(form_data);
			});
		},
		capture_image() {
			const capture = new frappe.ui.Capture({
				animate: false,
				error: true,
			});
			capture.show();
			capture.submit((data_urls) => {
				data_urls.forEach((data_url) => {
					let filename = `capture_${frappe.datetime
						.now_datetime()
						.replaceAll(/[: -]/g, "_")}.png`;
					this.url_to_file(data_url, filename, "image/png").then((file) =>
						this.add_files([file])
					);
				});
			});
		},
		show_google_drive_picker() {
			this.close_dialog = true;
			let google_drive = new GoogleDrivePicker({
				pickerCallback: (data) => this.google_drive_callback(data),
				...this.google_drive_settings,
			});
			google_drive.loadPicker();
		},
		google_drive_callback(data) {
			if (data.action == google.picker.Action.PICKED) {
				this.upload_file({
					file_url: data.docs[0].url,
					file_name: data.docs[0].name,
				});
			} else if (data.action == google.picker.Action.CANCEL) {
				cur_frm.attachments.new_attachment();
			}
		},
		url_to_file(url, filename, mime_type) {
			return fetch(url)
				.then((res) => res.arrayBuffer())
				.then((buffer) => new File([buffer], filename, { type: mime_type }));
		},
	},
};
</script>
<style>
/* ── 2-column grid for Step 1 + Step 3 ──────────────────────────────
   The uploader auto-splits into a left column (dropzone / file list)
   and a right column (feature-tabs / recap) when the caller opts into
   any image-processing feature. Plain attachment uploads (no features)
   still render single-column like the original Frappe dialog. The
   cropper step switches off the grid via .fu-cropper-mode so it can
   use its own internal layout.
-------------------------------------------------------------------- */
.file-uploader { display: block; }
.file-uploader.fu-with-panel {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 320px;
	gap: 16px;
	align-items: start;
}
.file-uploader .fu-left-col { min-width: 0; }
.file-uploader .fu-right-col {
	position: sticky;
	top: 0;
	border: 1px solid var(--border-color);
	border-radius: 10px;
	background: #fff;
	padding: 12px;
	display: flex;
	flex-direction: column;
	gap: 12px;
}

/* Tab header strip ─ matches the cropper's .cropper-feature-tabs
   visual style so Step 1 and Step 2 look like the same control. */
.fu-feature-tabs {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(64px, 1fr));
	gap: 4px;
	background: #f1f5f9;
	border-radius: 8px;
	padding: 4px;
}
.fu-feature-tab {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 3px;
	padding: 8px 6px;
	background: transparent;
	border: none;
	border-radius: 6px;
	cursor: pointer;
	color: #64748b;
	font-size: 12px;
	transition: background 0.15s ease, color 0.15s ease;
}
.fu-feature-tab:hover { background: rgba(255, 255, 255, 0.55); }
.fu-feature-tab.active {
	background: #fff;
	color: var(--primary);
	box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}
.fu-feature-tab-label {
	font-weight: 600;
	font-size: 11px;
	line-height: 1.2;
}
.fu-feature-tab-state {
	display: inline-flex;
	align-items: center;
	gap: 3px;
	font-size: 10px;
	font-weight: 500;
	text-transform: uppercase;
	letter-spacing: 0.02em;
}
.fu-feature-tab-state.on { color: #10b981; }
.fu-feature-tab-state.off { color: #94a3b8; }
.fu-feature-tab-dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: currentColor;
}

.fu-tab-body { flex: 1 1 auto; }
.fu-tab-pane {
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.fu-tab-enable {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 8px 10px;
	border: 1px solid var(--border-color);
	border-radius: 6px;
	background: #fafbfc;
}
.fu-tab-enable-label {
	font-size: 13px;
	font-weight: 600;
	color: #303133;
}
.fu-tab-note {
	font-size: 12px;
	color: var(--text-muted);
	line-height: 1.5;
	padding: 8px 10px;
	background: #f8fafc;
	border-radius: 6px;
}
.fu-tab-note a {
	color: var(--primary);
	text-decoration: underline;
	margin-left: 4px;
}
.fu-tab-field {
	display: flex;
	flex-direction: column;
	gap: 4px;
}
.fu-tab-field-label {
	font-size: 11px;
	font-weight: 600;
	color: #475569;
	text-transform: uppercase;
	letter-spacing: 0.03em;
	margin: 0;
}
.fu-seg-row {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
}
.fu-seg-btn {
	padding: 4px 10px;
	font-size: 12px;
	font-weight: 500;
	color: #475569;
	background: #fff;
	border: 1px solid var(--border-color);
	border-radius: 4px;
	cursor: pointer;
	transition: all 0.15s ease;
}
.fu-seg-btn:hover { border-color: var(--primary); }
.fu-seg-btn.active {
	background: var(--primary);
	color: #fff;
	border-color: var(--primary);
}

/* Toggle pill — same look as the cropper's compact toggle */
.fu-toggle-pill {
	display: inline-flex;
	align-items: center;
	cursor: pointer;
}
.fu-toggle-pill.is-disabled {
	cursor: not-allowed;
	opacity: 0.55;
}
.fu-toggle-track {
	display: inline-block;
	width: 30px;
	height: 16px;
	border-radius: 8px;
	background: #cbd5e1;
	position: relative;
	transition: background 0.2s ease;
}
.fu-toggle-track.on { background: var(--primary); }
.fu-toggle-thumb {
	position: absolute;
	top: 2px;
	left: 2px;
	width: 12px;
	height: 12px;
	border-radius: 50%;
	background: #fff;
	transition: transform 0.2s ease;
}
.fu-toggle-track.on .fu-toggle-thumb { transform: translateX(14px); }

/* ── Recap card (Step 3) ────────────────────────────────────────── */
.fu-recap-card {
	display: flex;
	flex-direction: column;
	gap: 4px;
}
.fu-recap-title {
	font-size: 13px;
	font-weight: 600;
	color: #0f172a;
}
.fu-recap-hint {
	font-size: 11px;
	color: var(--text-muted);
	margin-bottom: 8px;
}
.fu-recap-list {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 6px;
}
.fu-recap-list li {
	display: grid;
	grid-template-columns: 10px 1fr auto;
	align-items: center;
	gap: 8px;
	padding: 8px 10px;
	border: 1px solid var(--border-color);
	border-radius: 6px;
	background: #fafbfc;
	font-size: 12px;
}
.fu-recap-list li.off {
	background: #f8fafc;
	color: #94a3b8;
}
.fu-recap-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
}
.fu-recap-dot.on  { background: #10b981; }
.fu-recap-dot.off { background: #cbd5e1; }
.fu-recap-label { font-weight: 500; }
.fu-recap-value {
	font-size: 11px;
	color: #64748b;
	text-transform: uppercase;
	letter-spacing: 0.03em;
}

/* ── Mobile: stack right column below left ─────────────────────── */
@media (max-width: 768px) {
	.file-uploader.fu-with-panel {
		grid-template-columns: 1fr;
	}
	.file-uploader .fu-right-col {
		position: static;
	}
	.fu-feature-tabs {
		grid-template-columns: repeat(4, 1fr);
	}
}

.file-upload-area {
	min-height: 20rem;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 24px;
	border: 2px dashed var(--dark-border-color);
	border-radius: 10px;
	cursor: pointer;
	background-color: var(--bg-color);
	transition: border-color 0.15s ease, background-color 0.15s ease;
}
.file-upload-area:hover {
	border-color: var(--primary);
	background-color: var(--control-bg, #f4f8fc);
}
.file-upload-area .text-center {
	color: var(--text-muted);
	font-size: 14px;
}

/* File picker button tiles — rounded pill-style hover, responsive grid */
.file-upload-area .mt-2.text-center {
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 12px;
	margin-top: 18px !important;
}
.btn-file-upload {
	background-color: transparent;
	border: 1px solid transparent;
	border-radius: 12px;
	box-shadow: none;
	padding: 14px 18px;
	font-size: var(--text-xs);
	min-width: 96px;
	display: inline-flex;
	flex-direction: column;
	align-items: center;
	gap: 6px;
	transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}
.btn-file-upload:hover {
	transform: translateY(-1px);
	background: #fff;
	border-color: var(--border-color);
	box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
}
.btn-file-upload:active {
	transform: translateY(0);
}
.btn-file-upload svg {
	display: block;
}
.btn-file-upload .mt-1 {
	font-size: 12px;
	font-weight: 500;
	color: var(--text-color);
	margin-top: 2px !important;
}

/* Post-crop file preview list — rounded rows, breathable spacing,
   responsive for narrow viewports. Overrides base FilePreview.vue
   styles so the list lines up with the modal's new sizing. */
.file-uploader .file-preview-container {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin-bottom: 14px;
}
.file-uploader .file-preview-container .file-preview {
	border: 1px solid var(--border-color);
	border-radius: 10px;
	background: #fff;
	padding: 12px 14px;
	transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.file-uploader .file-preview-container .file-preview + .file-preview {
	border-top-color: var(--border-color);
}
.file-uploader .file-preview-container .file-preview:hover {
	background-color: var(--bg-color);
	border-color: var(--dark-border-color);
	box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
}
.file-uploader .file-preview .file-icon {
	width: 3rem;
	height: 3rem;
	border-radius: 8px;
}
.file-uploader .file-preview .file-name {
	font-size: 13px;
	font-weight: 600;
}
.file-uploader .file-preview .file-size {
	font-size: 12px;
}
.file-uploader .file-preview .config-area {
	margin-top: 4px;
}

/* Below-list action row (Upload button + help text) — align vertically
   on mobile so the button never ends up squeezed under a long hint. */
.file-uploader .flex.align-center {
	gap: 10px;
	flex-wrap: wrap;
}

@media (max-width: 640px) {
	.file-upload-area {
		min-height: 14rem;
		padding: 16px;
	}
	.file-upload-area .mt-2.text-center {
		gap: 8px;
	}
	.btn-file-upload {
		min-width: 80px;
		padding: 10px 12px;
	}
	.file-uploader .file-preview-container .file-preview {
		padding: 10px;
	}
}

.footer-toggle {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	margin-right: 8px;
}

.footer-toggle:first-child {
	margin-left: 0;
}

.footer-toggle .footer-toggle-pill {
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
}

.footer-toggle .footer-toggle-pill:hover {
	border-color: var(--primary);
}

/* Keyboard focus ring for the switch pill. The pill is role="switch"
   with tabindex=0 so users without a mouse reach it through the tab
   order; without this rule they'd see no focus cue at all and never
   know they can press Space to toggle. */
.footer-toggle .footer-toggle-pill:focus-visible {
	outline: 2px solid var(--primary);
	outline-offset: 2px;
}

.footer-toggle .footer-toggle-pill.active {
	color: var(--primary);
	background: var(--control-bg);
	border-color: var(--primary);
}

/* Disabled pill keeps the exact same shape/padding/border as a normal
   off-state pill — just with a locked grey switch and a muted label. No
   dashed border, no opacity tricks; the red info button next to it signals
   "unavailable". */
.footer-toggle .footer-toggle-pill.is-disabled {
	cursor: not-allowed;
	pointer-events: none;
	color: var(--text-light, var(--text-muted));
	background: var(--bg-color);
	border-color: var(--border-color);
}

.footer-toggle .footer-toggle-pill.is-disabled .footer-toggle-track {
	background: var(--gray-300, #d1d5db);
}

/* ── Red circular info button (shown only when the pill is disabled) ── */
.footer-toggle-info-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 20px;
	height: 20px;
	padding: 0;
	border-radius: 50%;
	border: 1px solid var(--red-300, #fca5a5);
	background: var(--red-50, #fef2f2);
	color: var(--red-500, #ef4444);
	cursor: pointer;
	transition: all 0.15s ease;
	flex-shrink: 0;
}

.footer-toggle-info-btn:hover {
	background: var(--red-500, #ef4444);
	color: white;
	border-color: var(--red-500, #ef4444);
	box-shadow: 0 1px 3px rgba(239, 68, 68, 0.3);
}

.footer-toggle-info-btn:active {
	transform: scale(0.92);
}

.footer-toggle-info-btn svg {
	display: block;
}

.footer-toggle-track {
	display: inline-block;
	width: 28px;
	height: 16px;
	border-radius: 8px;
	background: var(--gray-400);
	position: relative;
	transition: background 0.2s ease;
}

.footer-toggle-track.on {
	background: var(--primary);
}

.footer-toggle-thumb {
	position: absolute;
	top: 2px;
	left: 2px;
	width: 12px;
	height: 12px;
	border-radius: 50%;
	background: white;
	transition: transform 0.2s ease;
}

.footer-toggle-track.on .footer-toggle-thumb {
	transform: translateX(12px);
}
</style>

<!-- Global (non-scoped) styles: the feature-disabled modal is appended to
     <body> so it lives outside this component's scope. -->
<style>
.feature-disabled-modal .modal-content {
	border: none;
	border-radius: 12px;
	box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
	overflow: hidden;
}

.feature-disabled-modal .feature-disabled-body {
	padding: 24px 24px 16px;
	text-align: center;
}

.feature-disabled-modal .feature-disabled-icon {
	width: 56px;
	height: 56px;
	margin: 0 auto 14px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	background: var(--orange-50, #fff7ed);
	color: var(--orange-500, #f97316);
}

.feature-disabled-modal .feature-disabled-title {
	margin: 0 0 8px;
	font-size: 16px;
	font-weight: 600;
	color: var(--text-color);
}

.feature-disabled-modal .feature-disabled-reason {
	margin: 0 0 12px;
	font-size: 13px;
	line-height: 1.5;
	color: var(--text-muted);
}

.feature-disabled-modal .feature-disabled-note {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	margin-top: 4px;
	padding: 6px 12px;
	border-radius: 16px;
	background: var(--bg-color);
	border: 1px solid var(--border-color);
	font-size: 12px;
	color: var(--text-muted);
}

.feature-disabled-modal .feature-disabled-note svg {
	flex-shrink: 0;
	color: var(--text-light, var(--text-muted));
}

.feature-disabled-modal .feature-disabled-actions {
	display: flex;
	gap: 8px;
	justify-content: center;
	padding: 12px 24px 20px;
	border-top: 1px solid var(--border-color);
	background: var(--bg-color);
}

.feature-disabled-modal .feature-disabled-actions .btn {
	min-width: 96px;
	padding: 6px 18px;
	font-size: 13px;
	font-weight: 500;
	border-radius: 8px;
}

/* The File Uploader dialog now hosts ImageCropper + its side panel; the default
   modal-dialog (typically 600px wide) is too small. Expand up to 90vw / 90vh
   with a hard ceiling of 1600 × 900 so it doesn't dominate 4K displays. */
.file-uploader-dialog .modal-dialog {
	max-width: min(90vw, 1600px);
	width: min(90vw, 1600px);
	margin: 1.75rem auto;
}
.file-uploader-dialog .modal-content {
	max-height: min(90vh, 900px);
	min-height: min(90vh, 900px);
	display: flex;
	flex-direction: column;
}
.file-uploader-dialog .modal-body {
	flex: 1 1 auto;
	overflow-y: auto;
}
/* Footer region — standard-actions holds the primary Upload button,
   custom-actions holds the feature toggles (Watermark / Remove BG
   pills). Space them properly so they don't collide, and wrap on
   narrow viewports. */
.file-uploader-dialog .modal-footer {
	gap: 10px;
	flex-wrap: wrap;
}
.file-uploader-dialog .modal-footer .custom-btns {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
}

@media (max-width: 768px) {
	.file-uploader-dialog .modal-dialog {
		max-width: 100vw;
		width: 100vw;
		margin: 0;
	}
	.file-uploader-dialog .modal-content {
		min-height: 100vh;
		max-height: 100vh;
		border-radius: 0;
	}
	.file-uploader-dialog .modal-footer {
		flex-direction: column;
		align-items: stretch;
	}
	.file-uploader-dialog .modal-footer .custom-btns {
		justify-content: center;
		order: -1; /* Toggles above primary action on mobile */
	}
	.file-uploader-dialog .modal-footer .standard-actions {
		display: flex;
		justify-content: flex-end;
		gap: 6px;
	}
	.footer-toggle {
		margin-right: 0;
	}
}
</style>
