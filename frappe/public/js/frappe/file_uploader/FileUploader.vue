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
			<!-- Step 3 (files added, crop committed): read-only recap.
			     Prefers last_crop_settings (populated by @crop_committed so
			     the recap reflects the exact state baked into the file)
			     and falls back to the Step 1 default toggles when the user
			     hasn't cropped yet (e.g. they skipped the cropper on a
			     non-image file). -->
			<template v-if="files.length > 0">
				<div class="fu-recap-card">
					<div class="fu-recap-title">{{ __("Applied to your image") }}</div>
					<div class="fu-recap-hint">{{ __("Locked in at the Crop step — reopen the cropper to change these.") }}</div>
					<ul class="fu-recap-list">
						<li v-if="show_remove_bg" :class="{ off: !recap.remove_bg }">
							<span class="fu-recap-dot" :class="recap.remove_bg ? 'on' : 'off'"></span>
							<span class="fu-recap-label">{{ __("Remove Background") }}</span>
							<span class="fu-recap-value">{{ recap.remove_bg ? __("on") : __("off") }}</span>
						</li>
						<li v-if="show_watermark" :class="{ off: !recap.watermark_enabled }">
							<span class="fu-recap-dot" :class="recap.watermark_enabled ? 'on' : 'off'"></span>
							<span class="fu-recap-label">{{ __("Watermark") }}</span>
							<span class="fu-recap-value">
								{{ recap.watermark_enabled ? (recap.watermark_mode || "Tiled") : __("off") }}
							</span>
						</li>
						<li v-if="show_comments" :class="{ off: !recap.comments_enabled }">
							<span class="fu-recap-dot" :class="recap.comments_enabled ? 'on' : 'off'"></span>
							<span class="fu-recap-label">{{ __("Comments") }}</span>
							<span class="fu-recap-value">
								{{ recap.comments_enabled
									? (recap.comment_count ? __("{0} boxes", [recap.comment_count]) : __("on"))
									: __("off") }}
							</span>
						</li>
						<li v-if="show_resize" :class="{ off: !recap.resize_enabled }">
							<span class="fu-recap-dot" :class="recap.resize_enabled ? 'on' : 'off'"></span>
							<span class="fu-recap-label">{{ __("Canvas") }}</span>
							<span class="fu-recap-value">
								{{ recap.resize_enabled ? recap.resize_aspect : __("off") }}
							</span>
						</li>
					</ul>
				</div>
			</template>

			<!-- Step 1 (no files yet): interactive 4-tab panel — reuses
			     the cropper's existing .cropper-feature-tabs / .cropper-tab-*
			     / .wm-slider-row / .segmented-tabs / .wm-panel-actions classes
			     so Step 1 and Step 2 are visually identical, driven by ONE
			     stylesheet. -->
			<template v-else>
				<div class="cropper-feature-tabs" role="tablist">
					<button
						v-for="tab in available_tabs"
						:key="tab.key"
						type="button"
						class="cropper-feature-tab"
						:class="{ active: active_tab === tab.key }"
						role="tab"
						:aria-selected="active_tab === tab.key"
						@click.stop.prevent="_switch_tab(tab.key)"
					>
						<span class="cropper-feature-tab-label">{{ tab.label }}</span>
						<span class="cropper-feature-tab-state" :class="tab.on ? 'on' : 'off'">
							<span class="cropper-feature-tab-dot"></span>
							{{ tab.on ? __("on") : __("off") }}
						</span>
					</button>
				</div>

				<div class="cropper-tab-body">
					<!-- ── REMOVE BG pane ── -->
					<div v-show="active_tab === 'remove_bg'" class="cropper-tab-pane">
						<div class="cropper-tab-enable">
							<span class="cropper-tab-enable-label">{{ __("Enable Remove Background") }}</span>
							<div
								class="toggle-pill toggle-pill-compact"
								:class="{ active: remove_bg_checked, 'is-disabled': !!remove_bg_disabled_hint }"
								@click="!remove_bg_disabled_hint && (remove_bg_checked = !remove_bg_checked)"
							>
								<span class="toggle-pill-switch">
									<span class="toggle-pill-track" :class="{ on: remove_bg_checked && !remove_bg_disabled_hint }">
										<span class="toggle-pill-thumb"></span>
									</span>
								</span>
							</div>
						</div>
						<div v-if="remove_bg_disabled_hint" class="adjustments-row adjustments-warn">
							{{ remove_bg_disabled_hint }}
							<a v-if="remove_bg_disabled_link" :href="remove_bg_disabled_link">{{ __("Configure") }}</a>
						</div>
						<div v-else-if="remove_bg_checked" class="adjustments-row">
							<div class="wm-slider-row">
								<label class="wm-slider-label">{{ __("Auto-crop padding") }}</label>
								<input type="range" class="wm-slider" min="-20" max="40" step="1"
									:value="step1_padding_pct"
									@input="step1_padding_pct = parseInt($event.target.value)" />
								<span class="wm-slider-value">{{ step1_padding_pct }}%</span>
							</div>
							<div class="wm-panel-actions">
								<button class="btn btn-xs btn-default" @click="_reset_bg_default">{{ __("Reset") }}</button>
								<button class="btn btn-xs btn-primary-light" @click="_save_bg_default">{{ __("Save as Default") }}</button>
							</div>
						</div>
					</div>

					<!-- ── WATERMARK pane ── -->
					<div v-show="active_tab === 'watermark'" class="cropper-tab-pane">
						<div class="cropper-tab-enable">
							<span class="cropper-tab-enable-label">{{ __("Enable Watermark") }}</span>
							<div
								class="toggle-pill toggle-pill-compact"
								:class="{ active: wm_enabled, 'is-disabled': !local_watermark_settings || !local_watermark_settings.watermark_image }"
								@click="(local_watermark_settings && local_watermark_settings.watermark_image) && (wm_enabled = !wm_enabled)"
							>
								<span class="toggle-pill-switch">
									<span class="toggle-pill-track" :class="{ on: wm_enabled }">
										<span class="toggle-pill-thumb"></span>
									</span>
								</span>
							</div>
						</div>
						<div v-if="!local_watermark_settings || !local_watermark_settings.watermark_image" class="adjustments-row adjustments-warn">
							{{ __("No watermark image uploaded.") }}
							<a href="/app/watermark-settings">{{ __("Configure") }}</a>
						</div>
						<div v-else-if="wm_enabled" class="adjustments-row adjustments-row-wm">
							<div class="segmented-tabs" role="tablist">
								<button type="button" class="segmented-tab"
									:class="{ active: (local_watermark_settings.mode || 'Tiled') === 'Tiled' }"
									@click="_set_wm_field('mode', 'Tiled')">
									<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
									{{ __("Tiled") }}
								</button>
								<button type="button" class="segmented-tab"
									:class="{ active: local_watermark_settings.mode === 'Corner' }"
									@click="_set_wm_field('mode', 'Corner')">
									<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L12 12"/><rect x="2" y="14" width="10" height="8" rx="1"/></svg>
									{{ __("Corner") }}
								</button>
							</div>
							<template v-if="(local_watermark_settings.mode || 'Tiled') === 'Tiled'">
								<div class="wm-slider-row">
									<label class="wm-slider-label">{{ __("Opacity") }}</label>
									<input type="range" class="wm-slider" min="5" max="100"
										:value="local_watermark_settings.tile_opacity || 12"
										@input="_set_wm_field('tile_opacity', parseInt($event.target.value))" />
									<span class="wm-slider-value">{{ local_watermark_settings.tile_opacity || 12 }}%</span>
								</div>
								<div class="wm-slider-row">
									<label class="wm-slider-label">{{ __("Tile Size") }}</label>
									<input type="range" class="wm-slider" min="5" max="80"
										:value="local_watermark_settings.tile_size || 15"
										@input="_set_wm_field('tile_size', parseFloat($event.target.value))" />
									<span class="wm-slider-value">{{ Math.round(local_watermark_settings.tile_size || 15) }}%</span>
								</div>
								<div class="wm-slider-row">
									<label class="wm-slider-label">{{ __("Rotation") }}</label>
									<input type="range" class="wm-slider" min="-180" max="180"
										:value="local_watermark_settings.tile_rotation != null ? local_watermark_settings.tile_rotation : -30"
										@input="_set_wm_field('tile_rotation', parseInt($event.target.value))" />
									<span class="wm-slider-value">{{ local_watermark_settings.tile_rotation != null ? local_watermark_settings.tile_rotation : -30 }}°</span>
								</div>
								<div class="wm-slider-row">
									<label class="wm-slider-label">{{ __("Spacing") }}</label>
									<input type="range" class="wm-slider" min="0" max="100"
										:value="local_watermark_settings.tile_spacing || 40"
										@input="_set_wm_field('tile_spacing', parseInt($event.target.value))" />
									<span class="wm-slider-value">{{ local_watermark_settings.tile_spacing || 40 }}%</span>
								</div>
							</template>
							<template v-else>
								<div class="wm-slider-row">
									<label class="wm-slider-label">{{ __("Opacity") }}</label>
									<input type="range" class="wm-slider" min="5" max="100"
										:value="local_watermark_settings.opacity || 50"
										@input="_set_wm_field('opacity', parseInt($event.target.value))" />
									<span class="wm-slider-value">{{ local_watermark_settings.opacity || 50 }}%</span>
								</div>
								<div class="wm-slider-row">
									<label class="wm-slider-label">{{ __("Size") }}</label>
									<input type="range" class="wm-slider" min="5" max="100"
										:value="local_watermark_settings.size || 20"
										@input="_set_wm_field('size', parseFloat($event.target.value))" />
									<span class="wm-slider-value">{{ Math.round(local_watermark_settings.size || 20) }}%</span>
								</div>
								<div class="wm-slider-row">
									<label class="wm-slider-label">{{ __("Position X") }}</label>
									<input type="range" class="wm-slider" min="0" max="100"
										:value="local_watermark_settings.position_x || 80"
										@input="_set_wm_field('position_x', parseFloat($event.target.value))" />
									<span class="wm-slider-value">{{ Math.round(local_watermark_settings.position_x || 80) }}%</span>
								</div>
								<div class="wm-slider-row">
									<label class="wm-slider-label">{{ __("Position Y") }}</label>
									<input type="range" class="wm-slider" min="0" max="100"
										:value="local_watermark_settings.position_y || 90"
										@input="_set_wm_field('position_y', parseFloat($event.target.value))" />
									<span class="wm-slider-value">{{ Math.round(local_watermark_settings.position_y || 90) }}%</span>
								</div>
								<div class="wm-slider-row">
									<label class="wm-slider-label">{{ __("Rotation") }}</label>
									<input type="range" class="wm-slider" min="-180" max="180" step="5"
										:value="local_watermark_settings.corner_rotation || 0"
										@input="_set_wm_field('corner_rotation', parseFloat($event.target.value))" />
									<span class="wm-slider-value">{{ Math.round(local_watermark_settings.corner_rotation || 0) }}°</span>
								</div>
							</template>
							<div class="wm-panel-actions">
								<button class="btn btn-xs btn-default" @click="_reset_wm_default">{{ __("Reset") }}</button>
								<button class="btn btn-xs btn-primary-light" @click="_save_wm_default">{{ __("Save as Default") }}</button>
							</div>
						</div>
					</div>

					<!-- ── COMMENTS pane ── -->
					<div v-show="active_tab === 'comments'" class="cropper-tab-pane">
						<div class="cropper-tab-enable">
							<span class="cropper-tab-enable-label">{{ __("Enable Comments") }}</span>
							<div
								class="toggle-pill toggle-pill-compact"
								:class="{ active: comments_enabled_default }"
								@click="comments_enabled_default = !comments_enabled_default"
							>
								<span class="toggle-pill-switch">
									<span class="toggle-pill-track" :class="{ on: comments_enabled_default }">
										<span class="toggle-pill-thumb"></span>
									</span>
								</span>
							</div>
						</div>
						<div v-if="comments_enabled_default && local_comment_defaults" class="adjustments-row">
							<label class="adjustments-field-label">{{ __("Default style for new comment boxes") }}</label>
							<div class="wm-slider-row">
								<label class="wm-slider-label">{{ __("Font") }}</label>
								<select class="wm-select-inline"
									:value="local_comment_defaults.font_family || 'Arial'"
									@change="_set_comment_default('font_family', $event.target.value)">
									<option v-for="f in ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana']" :key="f" :value="f">{{ f }}</option>
								</select>
							</div>
							<div class="wm-slider-row">
								<label class="wm-slider-label">{{ __("Size") }}</label>
								<input type="range" class="wm-slider" min="1" max="20" step="0.5"
									:value="local_comment_defaults.font_size_pct || 5"
									@input="_set_comment_default('font_size_pct', parseFloat($event.target.value))" />
								<span class="wm-slider-value">{{ (local_comment_defaults.font_size_pct || 5).toFixed(1) }}%</span>
							</div>
							<div class="wm-inline-row">
								<label class="wm-inline-check">
									<input type="checkbox"
										:checked="local_comment_defaults.font_weight === 'Bold'"
										@change="_set_comment_default('font_weight', $event.target.checked ? 'Bold' : 'Normal')" />
									<span><strong>B</strong></span>
								</label>
								<label class="wm-inline-check">
									<input type="checkbox"
										:checked="local_comment_defaults.font_style === 'Italic'"
										@change="_set_comment_default('font_style', $event.target.checked ? 'Italic' : 'Normal')" />
									<span><em>I</em></span>
								</label>
								<label class="wm-inline-colour">
									<span>{{ __("Color") }}</span>
									<input type="color"
										:value="local_comment_defaults.color || '#000000'"
										@input="_set_comment_default('color', $event.target.value)" />
								</label>
							</div>
							<label class="adjustments-field-label" style="margin-top:8px">{{ __("Align") }}</label>
							<div class="segmented-tabs" role="tablist">
								<button v-for="a in ['Left', 'Center', 'Right']" :key="a"
									type="button" class="segmented-tab"
									:class="{ active: (local_comment_defaults.align || 'Center') === a }"
									@click="_set_comment_default('align', a)">{{ __(a) }}</button>
							</div>
							<div class="wm-panel-actions">
								<button class="btn btn-xs btn-default" @click="_reset_comment_default">{{ __("Reset") }}</button>
								<button class="btn btn-xs btn-primary-light" @click="_save_comment_default">{{ __("Save as Default") }}</button>
							</div>
						</div>
					</div>

					<!-- ── CANVAS pane ── -->
					<div v-show="active_tab === 'canvas'" class="cropper-tab-pane">
						<div class="cropper-tab-enable">
							<span class="cropper-tab-enable-label">{{ __("Enable Canvas normalization") }}</span>
							<div
								class="toggle-pill toggle-pill-compact"
								:class="{ active: resize_enabled_default }"
								@click="resize_enabled_default = !resize_enabled_default"
							>
								<span class="toggle-pill-switch">
									<span class="toggle-pill-track" :class="{ on: resize_enabled_default }">
										<span class="toggle-pill-thumb"></span>
									</span>
								</span>
							</div>
						</div>
						<div v-if="resize_enabled_default && local_resize_settings" class="adjustments-row">
							<label class="adjustments-field-label">{{ __("Aspect") }}</label>
							<div class="segmented-tabs" role="tablist">
								<button v-for="opt in ['1:1', '4:3', '16:9', '3:2', '2:3', 'Free']" :key="opt"
									type="button" class="segmented-tab"
									:class="{ active: (local_resize_settings.resize_aspect || '1:1') === opt }"
									@click="_set_canvas_aspect(opt)">{{ opt }}</button>
							</div>
							<label class="adjustments-field-label" style="margin-top:12px">{{ __("Mode") }}</label>
							<div class="segmented-tabs" role="tablist">
								<button v-for="opt in ['Contain', 'Cover', 'Stretch']" :key="opt"
									type="button" class="segmented-tab"
									:class="{ active: (local_resize_settings.resize_mode || 'Contain') === opt }"
									@click="_set_canvas_mode(opt)">{{ __(opt) }}</button>
							</div>
							<div class="wm-inline-row">
								<label class="wm-inline-check">
									<input type="checkbox"
										:checked="local_resize_settings.resize_flatten_rgb !== false"
										@change="_set_canvas_field('resize_flatten_rgb', $event.target.checked ? 1 : 0)" />
									<span>{{ __("Solid Background") }}</span>
								</label>
								<label v-if="local_resize_settings.resize_flatten_rgb !== false" class="wm-inline-colour">
									<span>{{ __("Color") }}</span>
									<input type="color"
										:value="local_resize_settings.resize_fill_color || '#FFFFFF'"
										@input="_set_canvas_field('resize_fill_color', $event.target.value)" />
								</label>
							</div>
							<div class="wm-panel-actions">
								<button class="btn btn-xs btn-default" @click="_reset_canvas_default">{{ __("Reset") }}</button>
								<button class="btn btn-xs btn-primary-light" @click="_save_canvas_default">{{ __("Save as Default") }}</button>
							</div>
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
			:remove_bg_padding_pct="step1_padding_pct"
			:show_watermark="show_watermark"
			:watermark_settings="local_watermark_settings"
			:wm_default_enabled="wm_enabled"
			:show_resize="show_resize"
			:resize_settings="local_resize_settings"
			:resize_default_enabled="resize_enabled_default"
			:show_comments="show_comments"
			:comment_defaults="local_comment_defaults"
			:comment_presets="comment_presets"
			:comments_default_enabled="comments_enabled_default"
			@toggle_image_cropper="toggle_image_cropper(-1)"
			@upload_after_crop="trigger_upload = true"
			@remove_bg_changed="remove_bg_checked = $event"
			@wm_enabled_changed="wm_enabled = $event"
			@comments_enabled_changed="comments_enabled_default = $event"
			@resize_enabled_changed="resize_enabled_default = $event"
			@crop_committed="_on_crop_committed"
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
			comments_enabled_default: !!(this.comment_defaults && this.comment_defaults.enabled),
			resize_enabled_default: !!(this.resize_settings && this.resize_settings.resize_enabled),
			// Auto-crop padding — initial value comes from Image Processing
			// Settings (remove_bg_padding_pct prop). User can override on
			// Step 1 before picking a file.
			step1_padding_pct: this.remove_bg_padding_pct != null ? this.remove_bg_padding_pct : 2,
			// Which right-panel tab is visible on Step 1.
			active_tab: "remove_bg",
			// Snapshot of the cropper's final feature states at the moment
			// the user clicked Crop. Populated by @crop_committed so Step 3's
			// recap card can display "exactly what was baked" rather than
			// Step 1's pre-cropper defaults (which may have been edited
			// inside the cropper).
			last_crop_settings: null,
			// ── Local editable copies of settings-prop objects ────────
			// Props passed from index.js are plain JS objects cached on
			// frappe._*_cache — NOT Vue-reactive. Mutating them via $set
			// on a prop doesn't reliably trigger re-renders (Vue 2 warns
			// "avoid mutating prop" and the parent never observed the
			// nested keys). We deep-clone into local data so every
			// <input :value> binding is fully reactive, then pass the
			// local copy into ImageCropper as the :watermark_settings /
			// :resize_settings / :comment_defaults props so Step 1 →
			// Step 2 edits roundtrip cleanly.
			local_watermark_settings: this.watermark_settings
				? JSON.parse(JSON.stringify(this.watermark_settings))
				: null,
			local_resize_settings: this.resize_settings
				? JSON.parse(JSON.stringify(this.resize_settings))
				: null,
			local_comment_defaults: this.comment_defaults
				? JSON.parse(JSON.stringify(this.comment_defaults))
				: null,
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
		// Step 3 recap view: prefer post-crop snapshot (last_crop_settings)
		// so it reflects whatever the user committed in the cropper,
		// falling back to Step 1 defaults before the first crop. One
		// source so template binds stay readable.
		recap() {
			const s = this.last_crop_settings || {};
			return {
				remove_bg: s.remove_bg != null ? s.remove_bg : this.remove_bg_checked,
				watermark_enabled: s.watermark_enabled != null ? s.watermark_enabled : this.wm_enabled,
				watermark_mode: s.watermark_mode
					|| (this.local_watermark_settings && this.local_watermark_settings.mode)
					|| "Tiled",
				comments_enabled: s.comments_enabled != null ? s.comments_enabled : this.comments_enabled_default,
				comment_count: s.comment_count || 0,
				resize_enabled: s.resize_enabled != null ? s.resize_enabled : this.resize_enabled_default,
				resize_aspect: s.resize_aspect
					|| (this.local_resize_settings && this.local_resize_settings.resize_aspect)
					|| "1:1",
				resize_mode: s.resize_mode
					|| (this.local_resize_settings && this.local_resize_settings.resize_mode)
					|| "Contain",
			};
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
		// Step 1 params mutate their underlying settings objects in place
		// so the cropper — which reads these same objects as props on
		// mount — picks up the user's choices when they click a File
		// Source button. All three settings objects (watermark_settings,
		// resize_settings, comment_defaults) are passed by reference from
		// index.js, so $set here updates the cropper's initial values.

		_switch_tab(key) {
			this.active_tab = key;
		},
		_on_crop_committed(snapshot) {
			this.last_crop_settings = snapshot;
			// Keep Step 1 / recap toggle dots in sync with the cropper's
			// final state so a user clicking Back sees what they last
			// committed, not the pre-crop defaults.
			this.remove_bg_checked = !!snapshot.remove_bg;
			this.wm_enabled = !!snapshot.watermark_enabled;
			this.comments_enabled_default = !!snapshot.comments_enabled;
			this.resize_enabled_default = !!snapshot.resize_enabled;
			if (this.local_watermark_settings && snapshot.watermark_mode) {
				this.$set(this.local_watermark_settings, "mode", snapshot.watermark_mode);
			}
			if (this.local_resize_settings) {
				if (snapshot.resize_aspect) {
					this.$set(this.local_resize_settings, "resize_aspect", snapshot.resize_aspect);
				}
				if (snapshot.resize_mode) {
					this.$set(this.local_resize_settings, "resize_mode", snapshot.resize_mode);
				}
			}
		},
		_set_wm_field(field, value) {
			if (!this.local_watermark_settings) return;
			this.$set(this.local_watermark_settings, field, value);
		},
		_set_comment_default(field, value) {
			if (!this.local_comment_defaults) return;
			this.$set(this.local_comment_defaults, field, value);
		},
		_set_canvas_aspect(opt) {
			if (!this.local_resize_settings) return;
			this.$set(this.local_resize_settings, "resize_aspect", opt);
		},
		_set_canvas_mode(opt) {
			if (!this.local_resize_settings) return;
			this.$set(this.local_resize_settings, "resize_mode", opt);
		},
		_set_canvas_field(field, value) {
			if (!this.local_resize_settings) return;
			this.$set(this.local_resize_settings, field, value);
		},

		// ── Reset / Save-as-default buttons per tab ─────────────────
		// Reset reverts the local editable copy to the prop value the
		// uploader was constructed with (what Settings had at dialog
		// open). Save persists the current local values back to the
		// Settings DocType via frappe.client.set_value so future
		// uploads inherit them.

		_reset_bg_default() {
			this.step1_padding_pct = this.remove_bg_padding_pct != null
				? this.remove_bg_padding_pct : 2;
			frappe.show_alert({ message: __("Reset to saved defaults"), indicator: "blue" });
		},
		_save_bg_default() {
			frappe.call({
				method: "frappe.client.set_value",
				args: {
					doctype: "Image Processing Settings",
					name: "Image Processing Settings",
					fieldname: { remove_bg_padding_pct: this.step1_padding_pct },
				},
			}).then(() => {
				frappe.show_alert({ message: __("Auto-crop padding saved as default"), indicator: "green" });
			}).catch(() => {
				frappe.show_alert({ message: __("Failed to save default"), indicator: "red" });
			});
		},

		_reset_wm_default() {
			if (!this.watermark_settings) return;
			this.local_watermark_settings = JSON.parse(JSON.stringify(this.watermark_settings));
			frappe.show_alert({ message: __("Reset to saved defaults"), indicator: "blue" });
		},
		_save_wm_default() {
			const s = this.local_watermark_settings;
			if (!s) return;
			frappe.call({
				method: "frappe.client.set_value",
				args: {
					doctype: "Watermark Settings",
					name: "Watermark Settings",
					fieldname: {
						mode: s.mode || "Tiled",
						position_x: s.position_x != null ? s.position_x : 80,
						position_y: s.position_y != null ? s.position_y : 90,
						corner_rotation: s.corner_rotation != null ? s.corner_rotation : 0,
						size: s.size != null ? s.size : 20,
						opacity: s.opacity != null ? s.opacity : 50,
						tile_size: s.tile_size != null ? s.tile_size : 15,
						tile_opacity: s.tile_opacity != null ? s.tile_opacity : 12,
						tile_rotation: s.tile_rotation != null ? s.tile_rotation : -30,
						tile_spacing: s.tile_spacing != null ? s.tile_spacing : 40,
					},
				},
			}).then(() => {
				// Refresh the shared cache so subsequent upload dialogs pick up
				// the new defaults without a page reload.
				if (frappe._watermark_settings_cache) {
					Object.assign(frappe._watermark_settings_cache, s);
				}
				frappe.show_alert({ message: __("Watermark defaults saved"), indicator: "green" });
			}).catch(() => {
				frappe.show_alert({ message: __("Failed to save defaults"), indicator: "red" });
			});
		},

		_reset_comment_default() {
			if (!this.comment_defaults) return;
			this.local_comment_defaults = JSON.parse(JSON.stringify(this.comment_defaults));
			frappe.show_alert({ message: __("Reset to saved defaults"), indicator: "blue" });
		},
		_save_comment_default() {
			const c = this.local_comment_defaults;
			if (!c) return;
			frappe.call({
				method: "frappe.client.set_value",
				args: {
					doctype: "Image Processing Settings",
					name: "Image Processing Settings",
					fieldname: {
						default_comment_font_family: c.font_family || "Arial",
						default_comment_font_size_pct: c.font_size_pct || 5,
						default_comment_font_weight: c.font_weight || "Normal",
						default_comment_font_style: c.font_style || "Normal",
						default_comment_color: c.color || "#000000",
						default_comment_align: c.align || "Center",
					},
				},
			}).then(() => {
				frappe.show_alert({ message: __("Comment defaults saved"), indicator: "green" });
			}).catch(() => {
				frappe.show_alert({ message: __("Failed to save defaults"), indicator: "red" });
			});
		},

		_reset_canvas_default() {
			if (!this.resize_settings) return;
			this.local_resize_settings = JSON.parse(JSON.stringify(this.resize_settings));
			frappe.show_alert({ message: __("Reset to saved defaults"), indicator: "blue" });
		},
		_save_canvas_default() {
			const r = this.local_resize_settings;
			if (!r) return;
			frappe.call({
				method: "frappe.client.set_value",
				args: {
					doctype: "Image Processing Settings",
					name: "Image Processing Settings",
					fieldname: {
						resize_enabled: this.resize_enabled_default ? 1 : 0,
						resize_aspect: r.resize_aspect || "1:1",
						resize_mode: r.resize_mode || "Contain",
						resize_fill_color: r.resize_fill_color || "#FFFFFF",
						resize_flatten_rgb: r.resize_flatten_rgb !== false ? 1 : 0,
					},
				},
			}).then(() => {
				frappe.show_alert({ message: __("Canvas defaults saved"), indicator: "green" });
			}).catch(() => {
				frappe.show_alert({ message: __("Failed to save defaults"), indicator: "red" });
			});
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
	grid-template-columns: minmax(0, 1fr) 420px;
	gap: 20px;
	align-items: stretch;
}
.file-uploader .fu-left-col { min-width: 0; }
.file-uploader .fu-right-col {
	position: sticky;
	top: 0;
	border: 1px solid var(--border-color);
	border-radius: 10px;
	background: #fff;
	padding: 18px;
	display: flex;
	flex-direction: column;
	gap: 16px;
	min-height: 360px;
}

/* ── Shared panel styles ──────────────────────────────────────────
   Identical selectors + values to the cropper's scoped styles
   (ImageCropper.vue). Because those are `scoped`, they only apply
   inside the cropper; the uploader's Step 1 panel needs its own
   copy so it renders identically without cross-component leaks.
-------------------------------------------------------------------- */

/* Tab header strip */
.file-uploader .cropper-feature-tabs {
	display: flex;
	gap: 6px;
	margin-bottom: 10px;
}
.file-uploader .cropper-feature-tab {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 4px;
	padding: 10px 6px;
	background: #fff;
	border: 1px solid var(--border-color);
	border-radius: 8px;
	cursor: pointer;
	color: #303133;
	transition: all 0.15s ease;
}
.file-uploader .cropper-feature-tab:hover {
	border-color: var(--primary);
}
.file-uploader .cropper-feature-tab.active {
	border: 2px solid var(--primary);
	background: #ecf5ff;
}
.file-uploader .cropper-feature-tab-label {
	font-weight: 600;
	font-size: 15px;
	color: #303133;
	line-height: 1.2;
}
.file-uploader .cropper-feature-tab.active .cropper-feature-tab-label {
	color: var(--primary);
}
.file-uploader .cropper-feature-tab-state {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	font-size: 13px;
	font-weight: 600;
	text-transform: uppercase;
}
.file-uploader .cropper-feature-tab-state.on { color: #22c55e; }
.file-uploader .cropper-feature-tab-state.off { color: #94a3b8; }
.file-uploader .cropper-feature-tab-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: currentColor;
}

/* Tab body */
.file-uploader .cropper-tab-body {
	flex: 1;
	padding: 14px;
	border: 1px solid var(--border-color);
	border-radius: 8px;
	background: #fff;
	overflow-y: auto;
	min-height: 0;
}
.file-uploader .cropper-tab-pane {
	display: flex;
	flex-direction: column;
	gap: 14px;
}

/* "Enable X" row at top of each pane */
.file-uploader .cropper-tab-enable {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 14px;
	border: 1px solid var(--border-color);
	border-radius: 6px;
	background: #fafbfc;
}
.file-uploader .cropper-tab-enable-label {
	font-size: 16px;
	font-weight: 600;
	color: #303133;
}

/* Toggle pill (same DOM as cropper) */
.file-uploader .toggle-pill {
	display: inline-flex;
	align-items: center;
	cursor: pointer;
}
.file-uploader .toggle-pill.is-disabled {
	cursor: not-allowed;
	opacity: 0.55;
}
.file-uploader .toggle-pill-switch {
	display: inline-flex;
}
.file-uploader .toggle-pill-track {
	display: inline-block;
	width: 40px;
	height: 22px;
	border-radius: 11px;
	background: #cbd5e1;
	position: relative;
	transition: background 0.2s ease;
}
.file-uploader .toggle-pill-track.on { background: var(--primary); }
.file-uploader .toggle-pill-thumb {
	position: absolute;
	top: 3px;
	left: 3px;
	width: 16px;
	height: 16px;
	border-radius: 50%;
	background: #fff;
	transition: transform 0.2s ease;
}
.file-uploader .toggle-pill-track.on .toggle-pill-thumb {
	transform: translateX(18px);
}

/* Slider row (label | slider | value) */
.file-uploader .wm-slider-row {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-bottom: 6px;
}
.file-uploader .wm-slider-row:last-child { margin-bottom: 0; }
.file-uploader .wm-slider-label {
	width: 100px;
	font-size: 15px;
	font-weight: 500;
	color: #475569;
}
.file-uploader .wm-slider {
	flex: 1;
	height: 4px;
	cursor: pointer;
	accent-color: var(--primary);
}
.file-uploader .wm-slider-value {
	width: 52px;
	font-size: 14px;
	font-weight: 500;
	color: #303133;
	text-align: right;
	font-variant-numeric: tabular-nums;
}

/* Font family dropdown that lives in a wm-slider-row slot */
.file-uploader .wm-select-inline {
	flex: 1;
	padding: 7px 10px;
	font-size: 14px;
	border: 1px solid var(--border-color);
	border-radius: 6px;
	background: #fff;
	color: #303133;
	cursor: pointer;
}
.file-uploader .wm-select-inline:focus {
	outline: none;
	border-color: var(--primary);
	box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}

/* Segmented mode selector (Tiled/Corner, Aspect 1:1/4:3/…, Align L/C/R) */
.file-uploader .segmented-tabs {
	display: flex;
	flex-wrap: wrap;
	background: var(--gray-100, #f3f4f6);
	padding: 3px;
	border-radius: 8px;
	gap: 2px;
}
.file-uploader .segmented-tab {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 8px 18px;
	border: none;
	border-radius: 6px;
	font-size: 14px;
	font-weight: 500;
	color: var(--text-color);
	background: transparent;
	cursor: pointer;
	transition: all 0.18s ease;
	white-space: nowrap;
}
.file-uploader .segmented-tab:hover {
	background: var(--gray-200, #e5e7eb);
}
.file-uploader .segmented-tab.active {
	background: var(--primary);
	color: #fff;
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.08);
}

/* Row of inline check/color fields (B / I / Color ▣ / Solid BG ☑) */
.file-uploader .wm-inline-row {
	display: flex;
	flex-wrap: wrap;
	gap: 14px;
	align-items: center;
	margin-top: 6px;
}
.file-uploader .wm-inline-check {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: 14px;
	font-weight: 500;
	color: #475569;
	cursor: pointer;
	margin: 0;
}
.file-uploader .wm-inline-check input[type="checkbox"] {
	width: 18px;
	height: 18px;
	margin: 0;
	cursor: pointer;
}
.file-uploader .wm-inline-colour {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: 14px;
	font-weight: 500;
	color: #475569;
	margin: 0;
}
.file-uploader .wm-inline-colour input[type="color"] {
	width: 36px;
	height: 28px;
	padding: 2px;
	border: 1px solid var(--border-color);
	border-radius: 4px;
	cursor: pointer;
	background: transparent;
}

/* Adjustments sub-rows (padding, watermark content, comment content…) */
.file-uploader .adjustments-row {
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.file-uploader .adjustments-row-wm {
	gap: 10px;
}
.file-uploader .adjustments-warn {
	font-size: 13px;
	color: var(--text-muted);
	padding: 10px 12px;
	background: #f8fafc;
	border-radius: 6px;
}
.file-uploader .adjustments-field-label {
	display: block;
	margin: 0 0 6px;
	font-size: 14px;
	font-weight: 600;
	color: var(--text-color);
}

/* Panel action row (Reset / Save as Default) */
.file-uploader .wm-panel-actions {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
	margin-top: 12px;
}
.file-uploader .wm-panel-actions .btn-xs {
	font-size: 13px;
	padding: 5px 14px;
	line-height: 1.6;
}

/* ── Recap card (Step 3) ────────────────────────────────────────── */
.fu-recap-card {
	display: flex;
	flex-direction: column;
	gap: 6px;
}
.fu-recap-title {
	font-size: 16px;
	font-weight: 600;
	color: #0f172a;
}
.fu-recap-hint {
	font-size: 13px;
	color: var(--text-muted);
	margin-bottom: 10px;
	line-height: 1.5;
}
.fu-recap-list {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.fu-recap-list li {
	display: grid;
	grid-template-columns: 12px 1fr auto;
	align-items: center;
	gap: 12px;
	padding: 12px 14px;
	border: 1px solid var(--border-color);
	border-radius: 8px;
	background: #fafbfc;
	font-size: 15px;
}
.fu-recap-list li.off {
	background: #f8fafc;
	color: #94a3b8;
}
.fu-recap-dot {
	width: 10px;
	height: 10px;
	border-radius: 50%;
}
.fu-recap-dot.on  { background: #10b981; }
.fu-recap-dot.off { background: #cbd5e1; }
.fu-recap-label { font-weight: 500; }
.fu-recap-value {
	font-size: 13px;
	color: #64748b;
	text-transform: uppercase;
	letter-spacing: 0.03em;
	font-weight: 500;
}

/* ── Mobile: stack right column below left ─────────────────────── */
@media (max-width: 900px) {
	.file-uploader.fu-with-panel {
		grid-template-columns: 1fr;
		gap: 16px;
	}
	.file-uploader .fu-right-col {
		position: static;
		min-height: 0;
		padding: 14px;
	}
	.file-uploader .cropper-feature-tab { padding: 8px 4px; }
	.file-uploader .cropper-feature-tab-label { font-size: 14px; }
	.file-uploader .cropper-feature-tab-state { font-size: 12px; }
	.file-uploader .cropper-tab-enable-label { font-size: 15px; }
	.file-uploader .fu-recap-list li { font-size: 14px; padding: 10px 12px; }
	.file-uploader .wm-slider-label { width: 82px; font-size: 13px; }
	.file-uploader .wm-slider-value { width: 44px; font-size: 12px; }
	.file-uploader .segmented-tab { padding: 7px 12px; font-size: 13px; }
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
