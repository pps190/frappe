<template>
	<div class="cropper-grid">
		<!-- LEFT COLUMN: toolbar + cropper + preview + action buttons -->
		<div class="cropper-left-col">
			<!-- Top toolbar: Drag mode (crop/watermark/comment) + Crop ratio.
			     Wraps to 2 rows on narrow screens. -->
			<div class="cropper-top-toolbar">
				<div class="cropper-toolbar-group" v-if="show_drag_mode_tabs">
					<span class="cropper-toolbar-label">{{ __("Drag") }}:</span>
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
							v-if="show_watermark && wm_enabled && wm_loaded && wm_mode === 'Corner'"
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
						<button
							v-if="show_comments && comments_enabled && comment_boxes.length > 0"
							class="segmented-tab"
							:class="{ active: interaction_mode === 'comment' }"
							role="tab"
							:aria-selected="interaction_mode === 'comment'"
							:title="__('Drag to move text comments')"
							@click="set_mode('comment')"
						>
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
							{{ __("Comment") }}
						</button>
					</div>
				</div>
				<div class="cropper-toolbar-group" v-if="fixed_aspect_ratio == null">
					<span class="cropper-toolbar-label">{{ __("Crop ratio") }}:</span>
					<div class="btn-group btn-group-sm">
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
				</div>

				<!-- Preview block inline in the toolbar, right-aligned via
				     margin-left: auto so the full toolbar height stays
				     compact (~50px, determined by the taller segmented
				     buttons and aspect ratio chips). Label sits to the
				     left of the 50×50 thumb; thumb is an <el-image> with
				     preview-src-list so click opens the image-viewer
				     lightbox at full resolution. During Remove BG
				     processing the thumb shows a spinner instead of the
				     stale pipeline output. -->
				<div v-if="any_feature_on" class="cropper-toolbar-preview">
					<span class="cropper-toolbar-label">{{ __("Preview") }}:</span>
					<div v-if="bg_processing" class="cropper-toolbar-preview-spinner" :title="__('Processing…')">
						<div class="cropper-spinner cropper-spinner-sm"></div>
					</div>
					<template v-else>
						<canvas
							ref="preview_canvas"
							class="cropper-preview-canvas"
							:class="{ 'el-image-backed': !!_preview_data_url }"
						></canvas>
						<el-image
							v-if="_preview_data_url"
							class="cropper-preview-elimage"
							:src="_preview_data_url"
							:preview-src-list="[_preview_data_url]"
							fit="contain"
						/>
					</template>
				</div>
			</div>

			<!-- Cropper canvas — main image with all overlays.
			     Occupies the full left-col below the toolbar. Preview
			     thumb lives in the toolbar (top row, right-aligned)
			     so it doesn't eat cropper workspace. -->
			<div
				class="cropper-image-wrapper"
				ref="wrapper"
				:class="{
					'wm-mode': interaction_mode === 'watermark' && wm_mode === 'Corner',
					'comment-mode': interaction_mode === 'comment',
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
				<!-- Comment overlay: DOM boxes drawn on top of the image so
				     the user can see text positioning + drag them. -->
				<div
					v-if="show_comments && comments_enabled"
					class="comment-overlay"
					:style="comment_overlay_style"
				>
					<div
						v-for="(box, i) in comment_boxes"
						:key="'overlay-box-' + i"
						class="comment-overlay-box"
						:class="{
							selected: selected_comment_idx === i,
							dragging: comment_dragging_idx === i,
						}"
						:style="comment_box_style(box)"
						:data-box-idx="i"
						@mousedown.stop="on_comment_mousedown($event, i)"
						@touchstart.stop="on_comment_touchstart($event, i)"
					>
						<div class="comment-overlay-text" :style="comment_text_style(box)">
							{{ box.text || __('(empty)') }}
						</div>
						<div
							v-if="selected_comment_idx === i && interaction_mode === 'comment'"
							class="comment-rotate-handle"
							:title="__('Rotate')"
							@mousedown.stop="on_comment_rotate_mousedown($event, i)"
						>↻</div>
						<div
							v-if="selected_comment_idx === i && interaction_mode === 'comment'"
							class="comment-resize-handle"
							:title="__('Resize')"
							@mousedown.stop="on_comment_resize_mousedown($event, i)"
						></div>
					</div>
				</div>
				<div v-if="bg_processing" class="cropper-loading-overlay">
					<div class="cropper-spinner"></div>
					<div class="cropper-loading-text">{{ __("Removing background...") }}</div>
				</div>
			</div>

		</div>

		<!-- RIGHT COLUMN: tabbed feature panel -->
		<div class="cropper-right-col" v-if="any_feature_shown">
			<div class="cropper-feature-tabs">
				<button
					v-if="show_remove_bg"
					type="button"
					class="cropper-feature-tab"
					:class="{ active: active_tab === 'remove_bg' }"
					@click="active_tab = 'remove_bg'"
				>
					<span class="cropper-feature-tab-label">{{ __("Remove BG") }}</span>
					<span class="cropper-feature-tab-state" :class="(bg_removed || bg_processing) ? 'on' : 'off'">
						<span class="cropper-feature-tab-dot"></span>
						{{ bg_processing ? __("…") : (bg_removed ? __("on") : __("off")) }}
					</span>
				</button>
				<button
					v-if="show_watermark"
					type="button"
					class="cropper-feature-tab"
					:class="{ active: active_tab === 'watermark' }"
					@click="active_tab = 'watermark'"
				>
					<span class="cropper-feature-tab-label">{{ __("Watermark") }}</span>
					<span class="cropper-feature-tab-state" :class="wm_enabled ? 'on' : 'off'">
						<span class="cropper-feature-tab-dot"></span>
						{{ wm_enabled ? __("on") : __("off") }}
					</span>
				</button>
				<button
					v-if="show_comments"
					type="button"
					class="cropper-feature-tab"
					:class="{ active: active_tab === 'comments' }"
					@click="active_tab = 'comments'"
				>
					<span class="cropper-feature-tab-label">{{ __("Comments") }}</span>
					<span class="cropper-feature-tab-state" :class="comments_enabled ? 'on' : 'off'">
						<span class="cropper-feature-tab-dot"></span>
						{{ comments_enabled ? __("on") : __("off") }}
					</span>
				</button>
				<button
					v-if="show_resize"
					type="button"
					class="cropper-feature-tab"
					:class="{ active: active_tab === 'canvas' }"
					@click="active_tab = 'canvas'"
				>
					<span class="cropper-feature-tab-label">{{ __("Canvas") }}</span>
					<span class="cropper-feature-tab-state" :class="resize_enabled ? 'on' : 'off'">
						<span class="cropper-feature-tab-dot"></span>
						{{ resize_enabled ? __("on") : __("off") }}
					</span>
				</button>
			</div>

			<div class="cropper-tab-body">
				<!-- REMOVE BG TAB -->
				<div v-show="active_tab === 'remove_bg'" class="cropper-tab-pane">
					<div class="cropper-tab-enable">
						<span class="cropper-tab-enable-label">
							{{ __("Enable Remove Background") }}
							<span v-if="bg_processing" class="cropper-tab-enable-hint">{{ __("Processing…") }}</span>
						</span>
						<div
							class="toggle-pill toggle-pill-compact"
							:class="{ active: bg_removed || bg_processing, processing: bg_processing }"
							@click="toggle_remove_bg"
						>
							<span class="toggle-pill-switch">
								<span class="toggle-pill-track" :class="{ on: bg_removed || bg_processing }">
									<span class="toggle-pill-thumb"></span>
								</span>
							</span>
						</div>
					</div>
					<div v-if="bg_removed && nobg_bbox" class="adjustments-row">
						<label class="adjustments-field-label">{{ __("Auto-crop padding") }}</label>
						<div class="padding-input-row">
							<input
								type="range" class="wm-slider"
								min="-20" max="40" step="1"
								:value="effective_padding_pct"
								@input="set_padding_pct(parseInt($event.target.value))"
							/>
							<div class="wm-input-group padding-input-group">
								<input
									type="number" class="wm-input"
									min="-20" max="40" step="1"
									:value="effective_padding_pct"
									@input="set_padding_pct(parseInt($event.target.value))"
								/>
								<span class="wm-input-suffix">%</span>
							</div>
						</div>
						<div class="wm-panel-actions">
							<button class="btn btn-xs btn-default" @click="reset_padding_pct">{{ __("Reset") }}</button>
							<button class="btn btn-xs btn-primary-light" @click="save_padding_default">{{ __("Save as Default") }}</button>
						</div>
					</div>
					<div v-else-if="bg_removed && !nobg_bbox" class="adjustments-row adjustments-warn">
						{{ __("Auto-crop not available — microservice did not return a bounding box.") }}
					</div>
				</div>

				<!-- WATERMARK TAB -->
				<div v-show="active_tab === 'watermark'" class="cropper-tab-pane">
					<div class="cropper-tab-enable">
						<span class="cropper-tab-enable-label">{{ __("Enable Watermark") }}</span>
						<div
							class="toggle-pill toggle-pill-compact"
							:class="{ active: wm_enabled }"
							@click="toggle_watermark"
						>
							<span class="toggle-pill-switch">
								<span class="toggle-pill-track" :class="{ on: wm_enabled }">
									<span class="toggle-pill-thumb"></span>
								</span>
							</span>
						</div>
					</div>
					<div v-if="wm_enabled" class="adjustments-row adjustments-row-wm">
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

						<template v-if="wm_mode === 'Tiled'">
							<div class="wm-slider-row">
								<label class="wm-slider-label">{{ __("Opacity") }}</label>
								<input type="range" class="wm-slider" min="5" max="100"
									:value="wm_tile_opacity"
									@input="wm_tile_opacity = parseInt($event.target.value)" />
								<span class="wm-slider-value">{{ wm_tile_opacity }}%</span>
							</div>
							<div class="wm-slider-row">
								<label class="wm-slider-label">{{ __("Tile Size") }}</label>
								<input type="range" class="wm-slider" min="5" max="80"
									:value="wm_tile_size"
									@input="wm_tile_size = parseFloat($event.target.value)" />
								<span class="wm-slider-value">{{ Math.round(wm_tile_size) }}%</span>
							</div>
							<div class="wm-slider-row">
								<label class="wm-slider-label">{{ __("Rotation") }}</label>
								<input type="range" class="wm-slider" min="-180" max="180"
									:value="wm_tile_rotation"
									@input="wm_tile_rotation = parseInt($event.target.value)" />
								<span class="wm-slider-value">{{ wm_tile_rotation }}°</span>
							</div>
							<div class="wm-slider-row">
								<label class="wm-slider-label">{{ __("Spacing") }}</label>
								<input type="range" class="wm-slider" min="0" max="100"
									:value="wm_tile_spacing"
									@input="wm_tile_spacing = parseInt($event.target.value)" />
								<span class="wm-slider-value">{{ wm_tile_spacing }}%</span>
							</div>
						</template>

						<template v-else>
							<div class="wm-slider-row">
								<label class="wm-slider-label">{{ __("Opacity") }}</label>
								<input type="range" class="wm-slider" min="5" max="100"
									:value="wm_opacity"
									@input="wm_opacity = parseInt($event.target.value)" />
								<span class="wm-slider-value">{{ wm_opacity }}%</span>
							</div>
							<div class="wm-slider-row">
								<label class="wm-slider-label">{{ __("Size") }}</label>
								<input type="range" class="wm-slider" min="5" max="100"
									:value="wm_size"
									@input="wm_size = parseFloat($event.target.value)" />
								<span class="wm-slider-value">{{ Math.round(wm_size) }}%</span>
							</div>
							<div class="wm-slider-row">
								<label class="wm-slider-label">{{ __("Position X") }}</label>
								<input type="range" class="wm-slider" min="0" max="100"
									:value="wm_pos_x"
									@input="wm_pos_x = parseFloat($event.target.value)" />
								<span class="wm-slider-value">{{ Math.round(wm_pos_x) }}%</span>
							</div>
							<div class="wm-slider-row">
								<label class="wm-slider-label">{{ __("Position Y") }}</label>
								<input type="range" class="wm-slider" min="0" max="100"
									:value="wm_pos_y"
									@input="wm_pos_y = parseFloat($event.target.value)" />
								<span class="wm-slider-value">{{ Math.round(wm_pos_y) }}%</span>
							</div>
							<div class="wm-slider-row">
								<label class="wm-slider-label">{{ __("Rotation") }}</label>
								<input type="range" class="wm-slider" min="-180" max="180" step="5"
									:value="wm_corner_rotation"
									@input="wm_corner_rotation = parseFloat($event.target.value)" />
								<span class="wm-slider-value">{{ Math.round(wm_corner_rotation) }}°</span>
							</div>
						</template>

						<div class="wm-panel-actions">
							<button class="btn btn-xs btn-default" @click="wm_reset_defaults">{{ __("Reset") }}</button>
							<button class="btn btn-xs btn-primary-light" @click="wm_save_defaults">{{ __("Save as Default") }}</button>
						</div>
					</div>
				</div>

				<!-- COMMENTS TAB -->
				<div v-show="active_tab === 'comments'" class="cropper-tab-pane">
					<div class="cropper-tab-enable">
						<span class="cropper-tab-enable-label">{{ __("Enable Comments") }}</span>
						<div
							class="toggle-pill toggle-pill-compact"
							:class="{ active: comments_enabled }"
							@click="comments_enabled = !comments_enabled"
						>
							<span class="toggle-pill-switch">
								<span class="toggle-pill-track" :class="{ on: comments_enabled }">
									<span class="toggle-pill-thumb"></span>
								</span>
							</span>
						</div>
					</div>
					<div v-if="comments_enabled" class="adjustments-row adjustments-row-comments">
						<div class="comments-header">
							<span>{{ __("Comments ({0})", [comment_boxes.length]) }}</span>
							<div class="comments-actions">
								<button type="button" class="btn btn-xs btn-primary-light" @click="_add_comment()">
									+ {{ __("Add") }}
								</button>
								<button
									v-if="comment_presets && comment_presets.length"
									type="button"
									class="btn btn-xs btn-default"
									@click="_toggle_preset_menu()"
								>
									📋 {{ __("Presets") }}
								</button>
								<div v-if="preset_menu_open" class="comment-preset-menu">
									<div
										v-for="(p, pi) in comment_presets"
										:key="'preset-' + pi"
										class="comment-preset-item"
										@click="_insert_preset(p)"
									>
										{{ p.text || __("(no text)") }}
									</div>
								</div>
							</div>
						</div>

						<div v-if="comment_boxes.length === 0" class="comments-empty-hint">
							{{ __('No comments yet. Click "+ Add" or pick a preset.') }}
						</div>

						<div
							v-for="(box, i) in comment_boxes"
							:key="'box-' + i"
							class="comment-entry"
							:class="{ 'comment-entry-selected': selected_comment_idx === i }"
							@click="selected_comment_idx = i"
						>
							<div class="comment-entry-header">
								<span class="comment-entry-idx">#{{ i + 1 }}</span>
								<textarea
									class="comment-text-input"
									:value="box.text"
									:placeholder="__('Text…')"
									rows="1"
									@input="_update_comment(i, 'text', $event.target.value)"
								></textarea>
								<button
									type="button"
									class="btn btn-xs btn-danger comment-delete"
									:title="__('Delete comment')"
									@click.stop="_delete_comment(i)"
								>×</button>
							</div>

							<div class="comment-entry-controls">
								<label class="comment-control comment-control-wide">
									<span>{{ __("Font") }}</span>
									<select class="wm-input comment-font-select"
										:value="box.font_family"
										@change="_update_comment(i, 'font_family', $event.target.value)"
									>
										<option v-for="f in comment_font_families" :key="f" :value="f">{{ f }}</option>
									</select>
								</label>
								<label class="comment-control">
									<span>{{ __("Size %") }}</span>
									<input type="number" class="wm-input comment-num-input"
										min="1" max="50" step="0.5"
										:value="box.font_size_pct"
										@input="_update_comment(i, 'font_size_pct', parseFloat($event.target.value) || 5.0)"
									/>
								</label>
								<button
									type="button"
									class="comment-style-btn"
									:class="{ active: box.font_weight === 'Bold' }"
									:title="__('Bold')"
									@click="_update_comment(i, 'font_weight', box.font_weight === 'Bold' ? 'Normal' : 'Bold')"
								><strong>B</strong></button>
								<button
									type="button"
									class="comment-style-btn"
									:class="{ active: box.font_style === 'Italic' }"
									:title="__('Italic')"
									@click="_update_comment(i, 'font_style', box.font_style === 'Italic' ? 'Normal' : 'Italic')"
								><em>I</em></button>
								<input type="color" class="comment-color-input"
									:title="__('Text color')"
									:value="box.color"
									@input="_update_comment(i, 'color', $event.target.value)"
								/>
							</div>

							<div class="comment-entry-controls">
								<div class="comment-align-group">
									<button
										v-for="a in ['Left', 'Center', 'Right']"
										:key="'align-' + a"
										type="button"
										class="comment-align-btn"
										:class="{ active: box.align === a }"
										:title="__(a)"
										@click="_update_comment(i, 'align', a)"
									>{{ a.charAt(0) }}</button>
								</div>
								<label class="comment-control">
									<span>X%</span>
									<input type="number" class="wm-input comment-num-input"
										min="0" max="100" step="1"
										:value="Math.round(box.position_x_pct)"
										@input="_update_comment(i, 'position_x_pct', parseFloat($event.target.value) || 0)"
									/>
								</label>
								<label class="comment-control">
									<span>Y%</span>
									<input type="number" class="wm-input comment-num-input"
										min="0" max="100" step="1"
										:value="Math.round(box.position_y_pct)"
										@input="_update_comment(i, 'position_y_pct', parseFloat($event.target.value) || 0)"
									/>
								</label>
								<label class="comment-control">
									<span>W%</span>
									<input type="number" class="wm-input comment-num-input"
										min="5" max="100" step="1"
										:value="Math.round(box.width_pct)"
										@input="_update_comment(i, 'width_pct', parseFloat($event.target.value) || 5)"
									/>
								</label>
								<label class="comment-control">
									<span>{{ __("Rotate °") }}</span>
									<input type="number" class="wm-input comment-num-input"
										min="-180" max="180" step="5"
										:value="Math.round(box.rotation_deg || 0)"
										@input="_update_comment(i, 'rotation_deg', parseFloat($event.target.value) || 0)"
									/>
								</label>
							</div>
						</div>

						<div class="wm-panel-actions">
							<button class="btn btn-xs btn-default" @click="_reset_comments_to_defaults">
								{{ __("Reset") }}
							</button>
							<button class="btn btn-xs btn-primary-light" @click="_save_comment_defaults">
								{{ __("Save Style as Default") }}
							</button>
						</div>
					</div>
				</div>

				<!-- CANVAS TAB (was Resize / Output Shape) -->
				<div v-show="active_tab === 'canvas'" class="cropper-tab-pane">
					<div class="cropper-tab-enable">
						<span class="cropper-tab-enable-label">{{ __("Enable Canvas normalization") }}</span>
						<div
							class="toggle-pill toggle-pill-compact"
							:class="{ active: resize_enabled }"
							@click="resize_enabled = !resize_enabled"
						>
							<span class="toggle-pill-switch">
								<span class="toggle-pill-track" :class="{ on: resize_enabled }">
									<span class="toggle-pill-thumb"></span>
								</span>
							</span>
						</div>
					</div>
					<div v-if="resize_enabled" class="adjustments-row adjustments-row-resize">
						<div class="canvas-field">
							<span class="canvas-sublabel">{{ __("Aspect") }}</span>
							<div class="segmented-tabs canvas-segmented">
								<button
									v-for="a in aspect_ratio_options"
									:key="a"
									class="segmented-tab"
									:class="{ active: resize_aspect === a }"
									@click="resize_aspect = a"
								>{{ a }}</button>
							</div>
						</div>
						<div class="canvas-field">
							<span class="canvas-sublabel">{{ __("Fit mode") }}</span>
							<div class="segmented-tabs canvas-segmented">
								<button
									v-for="m in resize_mode_options"
									:key="m"
									class="segmented-tab"
									:class="{ active: resize_mode === m, disabled: resize_aspect === 'Free' }"
									:disabled="resize_aspect === 'Free'"
									@click="resize_mode = m"
								>{{ __(m) }}</button>
							</div>
						</div>
						<div class="canvas-misc-row">
							<label class="resize-inline-toggle">
								<input type="checkbox" v-model="resize_flatten_rgb" />
								<span>{{ __("Solid background") }}</span>
							</label>
							<label
								v-if="resize_flatten_rgb"
								class="resize-inline-field"
							>
								<span>{{ __("Color") }}</span>
								<input
									type="color"
									class="resize-color"
									v-model="resize_fill_color"
								/>
							</label>
							<span
								v-if="!resize_flatten_rgb"
								class="resize-hint"
							>
								{{ __("Transparent background (PNG)") }}
							</span>
						</div>
						<div class="wm-panel-actions">
							<button class="btn btn-xs btn-default" @click="_reset_canvas_defaults">{{ __("Reset") }}</button>
							<button class="btn btn-xs btn-primary-light" @click="_save_canvas_defaults">{{ __("Save as Default") }}</button>
						</div>
					</div>
				</div>
			</div>
		</div>
		<!-- Bottom action row spans both columns so Back / Crop sit in the
		     same bottom-right corner the Upload button occupies on Step 1
		     and Step 3 — consistent toolbar across the whole 3-step flow. -->
		<div class="image-cropper-actions image-cropper-actions-bottom" ref="actions">
			<div>
				<button
					class="btn btn-sm"
					@click="$emit('toggle_image_cropper')"
					v-if="fixed_aspect_ratio == null"
				>
					{{ __("Back") }}
				</button>
			</div>
			<div>
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
		// Resize (new 2026-04) — from Image Processing Settings via item.js
		"show_resize", "resize_settings", "resize_default_enabled",
		// Comments (new 2026-04) — simple list of text overlays baked into
		// the final output. The single-item flow uses a lightweight
		// textarea-based editor (no drag). Batch flow uses the full
		// CommentBoxEditor with draggable handles.
		"show_comments", "comment_defaults", "comment_presets", "comments_default_enabled",
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
			wm_corner_rotation: 0,
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
			// Output Shape (new 2026-04) — baked into the final cropped canvas
			// before upload. Same logic as the server-side PIL helper in
			// item_image_batch.py::_apply_aspect_normalize.
			resize_enabled: false,
			resize_aspect: "1:1",
			resize_mode: "Contain",
			resize_fill_color: "#FFFFFF",
			resize_flatten_rgb: true,
			// max_file_size_kb intentionally NOT tracked in local state —
			// it's a global Settings value enforced server-side when a
			// batch is processed. Single-item uploads don't need it.
			aspect_ratio_options: ["1:1", "4:3", "16:9", "3:2", "2:3", "Free"],
			resize_mode_options: ["Contain", "Cover", "Stretch"],
			// Live preview (new 2026-04) — rerenders on any resize param
			// change so the user sees exactly what Crop will produce.
			preview_dims: null,
			// Full-resolution data URL fed into <el-image> preview-src-list.
			// Updated on every preview render so clicking the thumb
			// always opens the current state of the pipeline.
			_preview_data_url: null,
			_preview_debounce: null,
			// Comments (new 2026-04) — list of text overlays baked into
			// the final Canvas composite. Overlay DOM boxes on top of the
			// cropper image for drag interaction.
			comments_enabled: false,
			comment_boxes: [],
			preset_menu_open: false,
			selected_comment_idx: -1,
			comment_dragging_idx: -1,
			_comment_drag_start: null,
			// Canvas data cache (image display rect in cropper wrapper)
			// updated on cropper ready + crop event for overlay positioning.
			_canvas_data: null,
			comment_font_families: [
				"Arial", "Helvetica", "Times New Roman",
				"Courier New", "Georgia", "Verdana",
			],
			// Active tab in the right-side panel — "remove_bg" / "watermark"
			// / "comments" / "canvas". Reset in mounted() to the first
			// available feature so the right column opens on something.
			active_tab: "remove_bg",
		};
	},
	watch: {
		aspect_ratio(value) {
			if (this.cropper) {
				this.cropper.setAspectRatio(value);
			}
		},
		// Switching tabs should immediately re-render the preview so the
		// user sees the new tab's settings baked into the thumb. The
		// other watchers only fire when a value changes — switching
		// tabs doesn't change any param but the user expects the
		// preview to reflect what the tab represents (particularly
		// Canvas, where the user wants to see the target aspect ratio
		// applied the moment they click the tab).
		active_tab() {
			this._schedule_preview_update();
		},
		// Any change to resize params → rerender the preview. Debounced
		// so slider drags don't hammer the off-screen canvas composite.
		resize_enabled(v) {
			this._schedule_preview_update();
			this.$emit("resize_enabled_changed", !!v);
		},
		comments_enabled(v) {
			this._schedule_preview_update();
			this.$emit("comments_enabled_changed", !!v);
		},
		resize_aspect() { this._schedule_preview_update(); },
		resize_mode() { this._schedule_preview_update(); },
		resize_fill_color() { this._schedule_preview_update(); },
		resize_flatten_rgb() { this._schedule_preview_update(); },
		// Watermark + padding also affect final output — refresh preview
		// on those too so the user sees the composite result.
		wm_enabled() { this._schedule_preview_update(); },
		wm_opacity() { this._schedule_preview_update(); },
		wm_size() { this._schedule_preview_update(); },
		wm_pos_x() { this._schedule_preview_update(); },
		wm_pos_y() { this._schedule_preview_update(); },
		wm_corner_rotation() { this._schedule_preview_update(); this.wm_redraw(); },
		wm_mode() { this._schedule_preview_update(); },
		wm_tile_size() { this._schedule_preview_update(); },
		wm_tile_opacity() { this._schedule_preview_update(); },
		wm_tile_rotation() { this._schedule_preview_update(); },
		wm_tile_spacing() { this._schedule_preview_update(); },
		local_padding_pct() { this._schedule_preview_update(); },
		bg_removed() {
			// Clear any stale preview immediately so the user doesn't see
			// the pre-removal image while the new crop + composite runs.
			// _schedule_preview_update is debounced (120ms) + cropper may
			// still be swapping the underlying image — without this reset
			// the user could briefly see the old Remove BG state.
			this._preview_data_url = null;
			this._schedule_preview_update();
		},
		bg_processing(processing) {
			// Clear the preview while bg removal is in flight so
			// _render_preview doesn't snapshot an inconsistent
			// intermediate state (and _preview_data_url-based v-if gates
			// the el-image + canvas.el-image-backed behavior).
			if (processing) {
				this._preview_data_url = null;
			} else {
				// When processing flips off, cropper.swap() has just
				// bound the new image. Wait a tick for cropper's
				// internal DOM to settle, then re-render preview.
				this.$nextTick(() => this._schedule_preview_update());
			}
		},
		comments_enabled() { this._schedule_preview_update(); },
		comment_boxes: {
			handler() { this._schedule_preview_update(); },
			deep: true,
		},
	},
	mounted() {
		// Initial active tab — open on the first feature that's shown.
		// Priority: Remove BG → Watermark → Comments → Canvas.
		if (this.show_remove_bg) this.active_tab = "remove_bg";
		else if (this.show_watermark) this.active_tab = "watermark";
		else if (this.show_comments) this.active_tab = "comments";
		else if (this.show_resize) this.active_tab = "canvas";

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
			this.wm_corner_rotation = this.watermark_settings.corner_rotation != null
				? this.watermark_settings.corner_rotation
				: 0;
			this.wm_size = this.watermark_settings.size || 20;
			this.wm_opacity = this.watermark_settings.opacity || 50;
			// Tiled params
			this.wm_tile_size = this.watermark_settings.tile_size || 15;
			this.wm_tile_opacity = this.watermark_settings.tile_opacity || 20;
			this.wm_tile_rotation = this.watermark_settings.tile_rotation != null ? this.watermark_settings.tile_rotation : -30;
			this.wm_tile_spacing = this.watermark_settings.tile_spacing || 40;
			this.load_watermark_image(this.watermark_settings.watermark_image);
		}

		// Resize: load settings (new 2026-04). The pre-cropper footer
		// toggle (resize_default_enabled) wins over Settings so a user
		// who flipped Canvas off on the file-picker page stays off.
		if (this.show_resize && this.resize_settings) {
			this.resize_enabled = this.resize_default_enabled != null
				? !!this.resize_default_enabled
				: !!this.resize_settings.resize_enabled;
			this.resize_aspect = this.resize_settings.resize_aspect || "1:1";
			this.resize_mode = this.resize_settings.resize_mode || "Contain";
			this.resize_fill_color = this.resize_settings.resize_fill_color || "#FFFFFF";
			// Default to true when the settings object has no explicit
			// value (undefined) — the doctype default is 1, so a newly
			// installed site shouldn't accidentally produce transparent
			// PNGs just because the settings object was cached before
			// this field existed.
			this.resize_flatten_rgb = this.resize_settings.resize_flatten_rgb !== false;
			// (max_file_size_kb is global Settings only; not read here)
		}

		// Comments: off by default on new uploads unless the footer
		// toggle is ON. Comments carry meaning, so we don't silently
		// bake a previous session's text onto a new photo — the user
		// has to opt in either on the file-picker page or via the tab.
		if (this.show_comments) {
			this.comments_enabled = !!this.comments_default_enabled;
		}
		// comment_boxes starts empty; user adds them with + Add Comment.

		// Global listeners for watermark drag
		this._on_mousemove = this.on_wrapper_mousemove.bind(this);
		this._on_mouseup = this.on_wrapper_mouseup.bind(this);
		this._on_touchmove = this.on_wrapper_touchmove.bind(this);
		this._on_touchend = this.on_wrapper_mouseup.bind(this);
		document.addEventListener("mousemove", this._on_mousemove);
		document.addEventListener("mouseup", this._on_mouseup);
		document.addEventListener("touchmove", this._on_touchmove, { passive: false });
		document.addEventListener("touchend", this._on_touchend);

		// Global listeners for comment drag (new 2026-04)
		this._on_comment_mm = this._on_comment_mousemove.bind(this);
		this._on_comment_mu = this._on_comment_mouseup.bind(this);
		document.addEventListener("mousemove", this._on_comment_mm);
		document.addEventListener("mouseup", this._on_comment_mu);
		document.addEventListener("touchmove", (e) => {
			if (this.comment_dragging_idx < 0) return;
			const t = e.touches[0];
			this._on_comment_mousemove({ clientX: t.clientX, clientY: t.clientY });
			e.preventDefault();
		}, { passive: false });
		document.addEventListener("touchend", this._on_comment_mu);

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
				// Preview thumb's container changes size with the modal,
				// so re-render the preview at the new resolution.
				this._schedule_preview_update();
				// CropperJS doesn't observe its own container element —
				// it relies on window resize. When our wrapper changes
				// size without a window resize (e.g. the side-by-side
				// grid re-flows because the modal was opened at 0×0
				// then laid out), we need to tell cropper to re-measure.
				if (this.cropper) {
					try { this.cropper.resize(); } catch (e) {}
				}
			});
		};
		window.addEventListener("resize", this._on_window_resize);

		// Observe the cropper wrapper directly. CropperJS measures its
		// container once on mount and doesn't auto-update when flex/grid
		// layout shifts (e.g. .cropper-image-wrapper is laid out after
		// Vue's initial paint, leaving cropper with a 0-sized canvas
		// that produces un-draggable / warped crop boxes). A
		// ResizeObserver on the wrapper fixes both first-mount zero
		// size AND devtools-triggered resizes.
		if (typeof ResizeObserver !== "undefined" && this.$refs.wrapper) {
			this._wrapper_ro = new ResizeObserver(() => {
				if (!this.cropper) return;
				// Debounce with rAF so rapid size changes don't thrash
				// cropper.resize().
				if (this._wrapper_ro_raf) return;
				this._wrapper_ro_raf = requestAnimationFrame(() => {
					this._wrapper_ro_raf = null;
					try {
						this.cropper.resize();
					} catch (e) {}
					if (this.wm_enabled && this.wm_loaded) {
						this.wm_resize_canvas();
					}
					this._schedule_preview_update();
				});
			});
			this._wrapper_ro.observe(this.$refs.wrapper);
		}

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
			// Only apply the sticky-footer treatment when the cropper is
			// mounted inside Frappe's FileUploader dialog. External
			// consumers (any app that embeds <image-cropper> in its own
			// page/dialog without the .file-uploader wrapper) keep their
			// default modal-body + modal-footer layout untouched.
			const body = this.$el.closest && this.$el.closest(".file-uploader .modal-body");
			if (body) {
				body.classList.add("image-cropper-modal-body");
				this._modal_body_el = body;
			}
		});
	},
	beforeDestroy() {
		document.removeEventListener("mousemove", this._on_mousemove);
		document.removeEventListener("mouseup", this._on_mouseup);
		if (this._on_comment_mm) document.removeEventListener("mousemove", this._on_comment_mm);
		if (this._on_comment_mu) document.removeEventListener("mouseup", this._on_comment_mu);
		document.removeEventListener("touchmove", this._on_touchmove);
		document.removeEventListener("touchend", this._on_touchend);
		window.removeEventListener("resize", this._on_window_resize);
		if (this._resize_raf) cancelAnimationFrame(this._resize_raf);
		if (this._wrapper_ro_raf) cancelAnimationFrame(this._wrapper_ro_raf);
		if (this._wrapper_ro) {
			try { this._wrapper_ro.disconnect(); } catch (e) {}
			this._wrapper_ro = null;
		}
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

		// Comment overlay sits on top of the image display area (NOT
		// the cropper wrapper as a whole). Position it via the cropper's
		// getCanvasData() output so it tracks zoom + pan.
		comment_overlay_style() {
			const cd = this._canvas_data;
			if (!cd) return { display: "none" };
			return {
				position: "absolute",
				left: cd.left + "px",
				top: cd.top + "px",
				width: cd.width + "px",
				height: cd.height + "px",
				// pointerEvents only active when user is in comment mode,
				// so watermark + crop drag still work from the same pixels.
				pointerEvents: this.interaction_mode === "comment" ? "auto" : "none",
			};
		},

		// At least one feature has been turned ON by the user or the
		// prop defaults. Used to decide whether to render the preview
		// strip (nothing to preview if everything is off).
		any_feature_on() {
			return (
				(this.show_remove_bg && this.bg_removed) ||
				(this.show_watermark && this.wm_enabled) ||
				(this.show_comments && this.comments_enabled) ||
				(this.show_resize && this.resize_enabled)
			);
		},

		// At least one feature's UI is available on this cropper invocation
		// (prop opted in). Controls whether the right-side tabbed panel
		// renders at all — if the user opened the cropper with none of the
		// features enabled, the panel is hidden and the cropper is full-width.
		any_feature_shown() {
			return !!(this.show_remove_bg || this.show_watermark ||
			          this.show_comments || this.show_resize);
		},

		// Whether to show the 'Drag:' tab row above the cropper. Always
		// rendered so toggling watermark / comment on doesn't cause the
		// layout to shift — the 'Crop box' button is always visible.
		show_drag_mode_tabs() {
			return true;
		},

		// Human-readable output format label for the preview chip.
		// Determined by what's on: flatten forces JPEG, otherwise PNG.
		preview_format_label() {
			if (this.show_resize && this.resize_enabled && this.resize_flatten_rgb) {
				return "JPEG";
			}
			if (this.bg_removed || this.wm_enabled ||
			    (this.show_comments && this.comments_enabled && this.comment_boxes.length)) {
				return "PNG";
			}
			return "";
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
						this._update_canvas_data();
						// Initial preview render once cropper is ready
						this.$nextTick(() => this._schedule_preview_update());
					},
					crop: () => {
						if (this.wm_enabled && this.wm_loaded) {
							this.$nextTick(() => this.wm_draw());
						}
						this._update_canvas_data();
						// Preview follows the crop box — user dragging
						// the frame updates the preview live (debounced).
						this._schedule_preview_update();
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
					const rot = (this.wm_corner_rotation || 0) * Math.PI / 180;
					ctx.save();
					ctx.globalAlpha = this.wm_opacity / 100;
					if (rot) {
						const cx = draw_x + draw_w / 2;
						const cy = draw_y + draw_h / 2;
						ctx.translate(cx, cy);
						ctx.rotate(rot);
						ctx.translate(-cx, -cy);
					}
					ctx.drawImage(this.wm_img, draw_x, draw_y, draw_w, draw_h);
					ctx.restore();
				}
			}

			// ── Comments step (new 2026-04) ──
			// Bake text overlays onto the cropped canvas BEFORE aspect
			// normalization, so box positions stay attached to product
			// content (not to Contain-padded fill strips).
			if (this.show_comments && this.comments_enabled && this.comment_boxes.length > 0) {
				const cctx = canvas.getContext("2d");
				this._composite_comments_on_canvas(canvas, cctx);
			}

			// ── Resize step (new 2026-04) ──
			// Apply aspect normalization + optional RGB flatten to a fresh
			// canvas that mirrors the server-side PIL helper in
			// item_image_batch.py::_apply_aspect_normalize. Happens AFTER the
			// watermark + comments composites (so both stay on product
			// content, not on Contain-padded fill strips).
			let final_canvas = canvas;
			if (this.show_resize && this.resize_enabled) {
				final_canvas = this._apply_output_shape(canvas);
			}

			// Pick a type: flatten → JPEG (smaller, opaque); otherwise PNG
			// when Remove BG or Watermark was applied (needs alpha or we
			// have pixels that don't match the source type).
			let file_type;
			if (this.show_resize && this.resize_enabled && this.resize_flatten_rgb) {
				file_type = "image/jpeg";
			} else if (this.bg_removed || this.wm_enabled) {
				file_type = "image/png";
			} else {
				file_type = this.file.file_obj.type;
			}

			final_canvas.toBlob((blob) => {
				let name = this.file.name;
				if (this.bg_removed) name = name.replace(/\.[^.]+$/, "_nobg.png");
				if (this.wm_enabled) name = name.replace(/\.[^.]+$/, "_wm.png");
				if (this.show_resize && this.resize_enabled) {
					const ext = file_type === "image/jpeg" ? ".jpg" : ".png";
					name = name.replace(/\.[^.]+$/, "_shape" + ext);
				}
				this.file.file_obj = new File([blob], name, { type: blob.type });
				this.file.name = name;
				// Emit the final settings snapshot so FileUploader's Step 3
				// recap card shows the exact values the user baked into the
				// file (not the Step 1 defaults, which may have been
				// overridden inside the cropper).
				this.$emit("crop_committed", {
					remove_bg: !!this.bg_removed,
					watermark_enabled: !!this.wm_enabled,
					watermark_mode: this.wm_mode,
					comments_enabled: !!this.comments_enabled,
					comment_count: (this.comment_boxes || []).length,
					resize_enabled: !!this.resize_enabled,
					resize_aspect: this.resize_aspect,
					resize_mode: this.resize_mode,
				});
				this.$emit("toggle_image_cropper");
			}, file_type, file_type === "image/jpeg" ? 0.92 : undefined);
		},

		// Aspect-normalize a canvas via Canvas 2D. Mirrors the server-side
		// _apply_aspect_normalize in item_image_batch.py so the baked file
		// from a single-image upload and from a batch process look the same.
		_apply_output_shape(src_canvas) {
			const aspect_map = {
				"1:1": [1, 1],
				"4:3": [4, 3],
				"16:9": [16, 9],
				"3:2": [3, 2],
				"2:3": [2, 3],
			};

			const aspect = this.resize_aspect;
			const mode = this.resize_mode;
			const sw = src_canvas.width;
			const sh = src_canvas.height;

			// Free or unknown → pass-through (optionally flatten)
			if (aspect === "Free" || !(aspect in aspect_map)) {
				return this._maybe_flatten(src_canvas, sw, sh, src_canvas);
			}

			const [tw, th] = aspect_map[aspect];
			const src_ratio = sw / sh;
			const tgt_ratio = tw / th;

			if (Math.abs(src_ratio - tgt_ratio) < 1e-3) {
				return this._maybe_flatten(src_canvas, sw, sh, src_canvas);
			}

			if (mode === "Stretch") {
				let new_w, new_h;
				if (src_ratio > tgt_ratio) {
					new_w = sw;
					new_h = Math.round(sw / tgt_ratio);
				} else {
					new_w = Math.round(sh * tgt_ratio);
					new_h = sh;
				}
				const out = document.createElement("canvas");
				out.width = new_w;
				out.height = new_h;
				out.getContext("2d").drawImage(src_canvas, 0, 0, new_w, new_h);
				return this._maybe_flatten(out, new_w, new_h, out);
			}

			if (mode === "Cover") {
				let new_w, new_h, off_x = 0, off_y = 0;
				if (src_ratio > tgt_ratio) {
					// Source wider — crop left/right
					new_w = Math.round(sh * tgt_ratio);
					new_h = sh;
					off_x = Math.floor((sw - new_w) / 2);
				} else {
					// Source taller — crop top/bottom
					new_w = sw;
					new_h = Math.round(sw / tgt_ratio);
					off_y = Math.floor((sh - new_h) / 2);
				}
				const out = document.createElement("canvas");
				out.width = new_w;
				out.height = new_h;
				out.getContext("2d").drawImage(
					src_canvas,
					off_x, off_y, new_w, new_h,
					0, 0, new_w, new_h,
				);
				return this._maybe_flatten(out, new_w, new_h, out);
			}

			// Contain: expand shorter axis, pad with fill color.
			let canvas_w, canvas_h;
			if (src_ratio > tgt_ratio) {
				canvas_w = sw;
				canvas_h = Math.round(sw / tgt_ratio);
			} else {
				canvas_w = Math.round(sh * tgt_ratio);
				canvas_h = sh;
			}
			const out = document.createElement("canvas");
			out.width = canvas_w;
			out.height = canvas_h;
			const ctx = out.getContext("2d");
			// Fill the padding area first — transparent if flatten is off,
			// or fill color if flatten is on so the composite is opaque.
			if (this.resize_flatten_rgb) {
				ctx.fillStyle = this.resize_fill_color || "#FFFFFF";
				ctx.fillRect(0, 0, canvas_w, canvas_h);
			}
			const paste_x = Math.floor((canvas_w - sw) / 2);
			const paste_y = Math.floor((canvas_h - sh) / 2);
			ctx.drawImage(src_canvas, paste_x, paste_y);
			return this._maybe_flatten(out, canvas_w, canvas_h, out);
		},

		_maybe_flatten(maybe_rgba_canvas, w, h, src_canvas) {
			if (!this.resize_flatten_rgb) return maybe_rgba_canvas;
			const out = document.createElement("canvas");
			out.width = w;
			out.height = h;
			const ctx = out.getContext("2d");
			ctx.fillStyle = this.resize_fill_color || "#FFFFFF";
			ctx.fillRect(0, 0, w, h);
			ctx.drawImage(src_canvas, 0, 0);
			return out;
		},

		// ── Comments (new 2026-04) ──
		// Per-box style computations for the DOM overlay on the image.
		comment_box_style(box) {
			// Percentage-based position + size. Absolute inside the
			// .comment-overlay container which is already sized to match
			// the cropper image display rect.
			// Rotation uses CSS transform around center to match the
			// server-side PIL rotation (which also rotates around center).
			const leftPct = (box.position_x_pct || 50) - (box.width_pct || 40) / 2;
			const topPct = (box.position_y_pct || 50) - (box.height_pct || 10) / 2;
			const rot = box.rotation_deg || 0;
			return {
				position: "absolute",
				left: leftPct + "%",
				top: topPct + "%",
				width: (box.width_pct || 40) + "%",
				height: (box.height_pct || 10) + "%",
				transform: rot ? `rotate(${rot}deg)` : null,
				transformOrigin: "50% 50%",
			};
		},
		comment_text_style(box) {
			const cd = this._canvas_data;
			// Compute px font size from the displayed image height, not
			// the natural size (so on-screen text matches what user sees
			// in the preview).
			const displayH = (cd && cd.height) ? cd.height : 200;
			const fontPx = Math.max(6, Math.round(displayH * (box.font_size_pct || 5.0) / 100));
			return {
				fontFamily: `"${box.font_family || "Arial"}", sans-serif`,
				fontSize: fontPx + "px",
				fontWeight: box.font_weight === "Bold" ? "700" : "400",
				fontStyle: box.font_style === "Italic" ? "italic" : "normal",
				color: box.color || "#000000",
				textAlign: (box.align || "Center").toLowerCase(),
			};
		},

		// Refresh canvas data cache so overlay positions track cropper
		// zoom/pan. Called from cropper ready + crop events.
		_update_canvas_data() {
			if (!this.cropper) return;
			try {
				this._canvas_data = this.cropper.getCanvasData();
			} catch (e) {
				this._canvas_data = null;
			}
		},

		// ── Comment drag handlers ──
		on_comment_mousedown(e, i) {
			if (this.interaction_mode !== "comment") return;
			this.selected_comment_idx = i;
			this.comment_dragging_idx = i;
			const box = this.comment_boxes[i];
			this._comment_drag_start = {
				mode: "move",
				clientX: e.clientX,
				clientY: e.clientY,
				origXPct: box.position_x_pct,
				origYPct: box.position_y_pct,
			};
			e.preventDefault();
		},
		on_comment_touchstart(e, i) {
			if (this.interaction_mode !== "comment") return;
			const t = e.touches[0];
			this.selected_comment_idx = i;
			this.comment_dragging_idx = i;
			const box = this.comment_boxes[i];
			this._comment_drag_start = {
				mode: "move",
				clientX: t.clientX,
				clientY: t.clientY,
				origXPct: box.position_x_pct,
				origYPct: box.position_y_pct,
			};
		},
		on_comment_rotate_mousedown(e, i) {
			if (this.interaction_mode !== "comment") return;
			const cd = this._canvas_data;
			const wrapper = this.$refs.wrapper;
			if (!cd || !wrapper) return;
			this.selected_comment_idx = i;
			this.comment_dragging_idx = i;
			const box = this.comment_boxes[i];
			// Box center in page pixels: wrapper origin + canvas offset + box center %
			const wrapperRect = wrapper.getBoundingClientRect();
			const cx = wrapperRect.left + cd.left + (box.position_x_pct / 100) * cd.width;
			const cy = wrapperRect.top + cd.top + (box.position_y_pct / 100) * cd.height;
			const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
			this._comment_drag_start = {
				mode: "rotate",
				cx,
				cy,
				startAngle,
				origRot: box.rotation_deg || 0,
			};
			e.preventDefault();
		},
		on_comment_resize_mousedown(e, i) {
			if (this.interaction_mode !== "comment") return;
			const cd = this._canvas_data;
			if (!cd) return;
			this.selected_comment_idx = i;
			this.comment_dragging_idx = i;
			const box = this.comment_boxes[i];
			this._comment_drag_start = {
				mode: "resize",
				clientX: e.clientX,
				clientY: e.clientY,
				origWPct: box.width_pct || 40,
				origHPct: box.height_pct || 10,
				origFontPct: box.font_size_pct || 5,
			};
			e.preventDefault();
		},
		_on_comment_mousemove(e) {
			if (this.comment_dragging_idx < 0 || !this._comment_drag_start) return;
			const start = this._comment_drag_start;
			const i = this.comment_dragging_idx;
			const box = this.comment_boxes[i];
			if (!box) return;

			if (start.mode === "rotate") {
				const currentAngle = Math.atan2(
					e.clientY - start.cy,
					e.clientX - start.cx
				) * 180 / Math.PI;
				let rot = start.origRot + (currentAngle - start.startAngle);
				while (rot > 180) rot -= 360;
				while (rot < -180) rot += 360;
				if (e.shiftKey) rot = Math.round(rot / 15) * 15;
				this.$set(this.comment_boxes, i, { ...box, rotation_deg: rot });
				return;
			}

			const cd = this._canvas_data;
			if (!cd) return;

			if (start.mode === "resize") {
				const dx = e.clientX - start.clientX;
				const dy = e.clientY - start.clientY;
				const dwPct = (dx / cd.width) * 100 * 2;   // ×2 because we resize from center
				const dhPct = (dy / cd.height) * 100 * 2;
				const newW = Math.max(5, Math.min(100, start.origWPct + dwPct));
				const newH = Math.max(2, Math.min(100, start.origHPct + dhPct));
				// Scale font proportionally with height change (same rule as
				// CommentBoxEditor's resize handle).
				const ratio = newH / Math.max(start.origHPct, 0.1);
				const newFont = Math.max(0.1, Math.min(50, start.origFontPct * ratio));
				this.$set(this.comment_boxes, i, {
					...box,
					width_pct: newW,
					height_pct: newH,
					font_size_pct: newFont,
				});
				return;
			}

			const dx = e.clientX - start.clientX;
			const dy = e.clientY - start.clientY;
			const dxPct = (dx / cd.width) * 100;
			const dyPct = (dy / cd.height) * 100;
			const newX = Math.max(0, Math.min(100, start.origXPct + dxPct));
			const newY = Math.max(0, Math.min(100, start.origYPct + dyPct));
			this.$set(this.comment_boxes, i, {
				...box,
				position_x_pct: newX,
				position_y_pct: newY,
			});
		},
		_on_comment_mouseup() {
			if (this.comment_dragging_idx >= 0) {
				this.comment_dragging_idx = -1;
				this._comment_drag_start = null;
				this._schedule_preview_update();
			}
		},

		// ── Reset / save comment-style defaults ──
		_reset_comments_to_defaults() {
			if (!this.comment_boxes.length) return;
			const d = this.comment_defaults || {};
			for (let i = 0; i < this.comment_boxes.length; i++) {
				const box = this.comment_boxes[i];
				this.$set(this.comment_boxes, i, {
					...box,
					font_family: d.font_family || "Arial",
					font_size_pct: d.font_size_pct || 5.0,
					font_weight: d.font_weight || "Normal",
					font_style: d.font_style || "Normal",
					color: d.color || "#000000",
					align: d.align || "Center",
				});
			}
		},
		_save_comment_defaults() {
			// Save the currently-selected box's style (or box #1's if none
			// selected) as the new system-wide default via the Settings API.
			const idx = this.selected_comment_idx >= 0 ? this.selected_comment_idx : 0;
			const box = this.comment_boxes[idx];
			if (!box) {
				frappe.show_alert({ message: __("No comment to save as default"), indicator: "orange" });
				return;
			}
			frappe.call({
				method: "frappe.client.set_value",
				args: {
					doctype: "Image Processing Settings",
					name: "Image Processing Settings",
					fieldname: {
						default_comment_font_family: box.font_family,
						default_comment_font_size_pct: box.font_size_pct,
						default_comment_font_weight: box.font_weight,
						default_comment_font_style: box.font_style,
						default_comment_color: box.color,
						default_comment_align: box.align,
					},
				},
				callback: () => {
					frappe.show_alert({ message: __("Comment style saved as default"), indicator: "green" });
				},
			});
		},

		// ── Canvas (resize + fill + flatten) reset / save ──
		_reset_canvas_defaults() {
			const s = this.resize_settings || {};
			this.resize_enabled = s.resize_enabled !== undefined ? !!s.resize_enabled : true;
			this.resize_aspect = s.resize_aspect || "1:1";
			this.resize_mode = s.resize_mode || "Contain";
			this.resize_fill_color = s.resize_fill_color || "#FFFFFF";
			this.resize_flatten_rgb = s.resize_flatten_rgb !== undefined ? !!s.resize_flatten_rgb : true;
		},
		_save_canvas_defaults() {
			frappe.call({
				method: "frappe.client.set_value",
				args: {
					doctype: "Image Processing Settings",
					name: "Image Processing Settings",
					fieldname: {
						resize_enabled: this.resize_enabled ? 1 : 0,
						resize_aspect: this.resize_aspect,
						resize_mode: this.resize_mode,
						resize_fill_color: this.resize_fill_color,
						resize_flatten_rgb: this.resize_flatten_rgb ? 1 : 0,
					},
				},
				callback: () => {
					frappe.show_alert({ message: __("Canvas settings saved as default"), indicator: "green" });
				},
			});
		},

		_add_comment() {
			const d = this.comment_defaults || {};
			this.comment_boxes.push({
				text: "",
				position_x_pct: 50,
				position_y_pct: 50,
				width_pct: 40,
				height_pct: 10,
				font_family: d.font_family || "Arial",
				font_size_pct: d.font_size_pct || 5.0,
				font_weight: d.font_weight || "Normal",
				font_style: d.font_style || "Normal",
				color: d.color || "#000000",
				align: d.align || "Center",
			});
		},
		_update_comment(i, field, value) {
			const current = this.comment_boxes[i];
			if (!current) return;
			this.$set(this.comment_boxes, i, { ...current, [field]: value });
		},
		_delete_comment(i) {
			this.comment_boxes.splice(i, 1);
		},
		_toggle_preset_menu() {
			this.preset_menu_open = !this.preset_menu_open;
		},
		_insert_preset(preset) {
			this.comment_boxes.push({
				text: preset.text || "",
				position_x_pct: preset.position_x_pct ?? 50,
				position_y_pct: preset.position_y_pct ?? 50,
				width_pct: preset.width_pct ?? 40,
				height_pct: preset.height_pct ?? 10,
				font_family: preset.font_family || "Arial",
				font_size_pct: preset.font_size_pct ?? 5.0,
				font_weight: preset.font_weight || "Normal",
				font_style: preset.font_style || "Normal",
				color: preset.color || "#000000",
				align: preset.align || "Center",
			});
			this.preset_menu_open = false;
		},

		// Paint all enabled comment boxes onto the cropped canvas. Called
		// after watermark compositing, before aspect normalize, so boxes
		// stay attached to content (not Contain-padded fill strips).
		// Mirrors the server-side _apply_comment_boxes in item_image_batch.py.
		_composite_comments_on_canvas(canvas, ctx) {
			if (!this.comment_boxes || this.comment_boxes.length === 0) return;
			const w = canvas.width;
			const h = canvas.height;
			for (const box of this.comment_boxes) {
				if (!box.text) continue;
				const font_size_px = Math.max(1, Math.round(h * (box.font_size_pct || 5.0) / 100));
				const family = box.font_family || "Arial";
				const weight = box.font_weight === "Bold" ? "bold" : "normal";
				const style = box.font_style === "Italic" ? "italic" : "normal";
				ctx.font = `${style} ${weight} ${font_size_px}px "${family}", sans-serif`;
				ctx.fillStyle = box.color || "#000000";

				const cx = w * (box.position_x_pct || 50) / 100;
				const cy = h * (box.position_y_pct || 50) / 100;
				const box_w_px = w * (box.width_pct || 40) / 100;
				const rotation_deg = box.rotation_deg || 0;

				// Simple greedy word-wrap (same intent as _wrap_to_width on server)
				const lines = this._wrap_text_to_width(
					String(box.text || ""), box_w_px, ctx
				);
				const line_h = font_size_px * 1.2;
				const total_h = lines.length * line_h;

				// Rotate around box center (cx, cy). Matches CSS transform-origin 50% 50%
				// on the overlay box and PIL's rotate(-angle, expand=True) + alpha_composite
				// which keeps text centered on (cx, cy) after rotation.
				const needs_rotate = Math.abs(rotation_deg) > 0.001;
				if (needs_rotate) {
					ctx.save();
					ctx.translate(cx, cy);
					ctx.rotate((rotation_deg * Math.PI) / 180);
					ctx.translate(-cx, -cy);
				}

				let y_cursor = cy - total_h / 2 + line_h * 0.75;
				for (const line of lines) {
					const line_w = ctx.measureText(line).width;
					let x;
					if (box.align === "Left") x = cx - box_w_px / 2;
					else if (box.align === "Right") x = cx + box_w_px / 2 - line_w;
					else x = cx - line_w / 2;
					ctx.fillText(line, x, y_cursor);
					y_cursor += line_h;
				}

				if (needs_rotate) {
					ctx.restore();
				}
			}
		},

		_wrap_text_to_width(text, max_width_px, ctx) {
			if (!text) return [];
			const out = [];
			for (const paragraph of text.split("\n")) {
				if (!paragraph) { out.push(""); continue; }
				const words = paragraph.split(" ");
				let line = "";
				for (const word of words) {
					const candidate = line ? `${line} ${word}` : word;
					if (ctx.measureText(candidate).width <= max_width_px || !line) {
						line = candidate;
					} else {
						out.push(line);
						line = word;
					}
				}
				if (line) out.push(line);
			}
			return out;
		},

		// ── Live preview (new 2026-04) ──
		_schedule_preview_update() {
			if (this._preview_debounce) clearTimeout(this._preview_debounce);
			this._preview_debounce = setTimeout(() => {
				this._preview_debounce = null;
				this._render_preview();
			}, 120);
		},

		_render_preview() {
			const preview_canvas = this.$refs.preview_canvas;
			if (!preview_canvas) return;
			if (!this.cropper) return;

			// Run the same pipeline crop_image would, but draw to a
			// 200×200 display canvas. Reuses _apply_output_shape so
			// preview + actual output match exactly.
			let src;
			try {
				src = this.cropper.getCroppedCanvas();
			} catch (e) {
				return;
			}
			if (!src) return;

			// Apply watermark to a working copy (off-screen)
			const work = document.createElement("canvas");
			work.width = src.width;
			work.height = src.height;
			const wctx = work.getContext("2d");
			wctx.drawImage(src, 0, 0);
			if (this.wm_enabled && this.wm_loaded && this.wm_img) {
				this._composite_watermark_on_canvas(work, wctx);
			}
			// Comments — baked BEFORE Resize so box positions stay attached
			// to product content, not to Contain-padded fill strips.
			if (this.show_comments && this.comments_enabled) {
				this._composite_comments_on_canvas(work, wctx);
			}

			// Apply Resize (same helper used on final crop)
			const final_canvas = (this.show_resize && this.resize_enabled)
				? this._apply_output_shape(work)
				: work;

			// Compute display box from the preview thumb's actual rendered
			// size (the thumb is sized by CSS flex:1 matching the cropper
			// height, so the preview scales with the modal height). Fall
			// back to 280 on mount before layout has settled.
			const thumb = preview_canvas.parentElement;
			const maxAvail = thumb
				? Math.max(120, Math.min(thumb.clientWidth || 280, thumb.clientHeight || 280))
				: 280;
			const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
			const MAX = Math.round(maxAvail * dpr);
			const ratio = final_canvas.width / final_canvas.height;
			let disp_w, disp_h;
			if (ratio >= 1) {
				disp_w = MAX;
				disp_h = Math.round(MAX / ratio);
			} else {
				disp_h = MAX;
				disp_w = Math.round(MAX * ratio);
			}
			preview_canvas.width = disp_w;
			preview_canvas.height = disp_h;
			// CSS size (what the user sees) is disp_* / dpr.
			preview_canvas.style.width = Math.round(disp_w / dpr) + "px";
			preview_canvas.style.height = Math.round(disp_h / dpr) + "px";
			const pctx = preview_canvas.getContext("2d");
			pctx.clearRect(0, 0, disp_w, disp_h);
			pctx.drawImage(final_canvas, 0, 0, disp_w, disp_h);

			this.preview_dims = { w: final_canvas.width, h: final_canvas.height };

			// Refresh the <el-image> data URL from the same final_canvas
			// so the click-to-enlarge viewer always shows current state.
			// Use PNG whenever the final output has transparency so the
			// preview looks identical to the cropper workspace (both dark
			// gray showing through alpha). JPEG only when Canvas flatten
			// is explicitly on — that's the one case where transparency
			// is baked to a solid color and JPEG's compression wins.
			try {
				const flatten = this.show_resize && this.resize_enabled && this.resize_flatten_rgb;
				const fmt = flatten ? "image/jpeg" : "image/png";
				this._preview_data_url = final_canvas.toDataURL(fmt, 0.88);
			} catch (e) {
				// toDataURL can throw on huge canvases; fall back to null
				this._preview_data_url = null;
			}
		},

		// Extract the watermark composite from crop_image() so _render_preview
		// can reuse it without duplicating the pixel math.
		_composite_watermark_on_canvas(canvas, ctx) {
			const image_data = this.cropper.getImageData();
			const crop_data = this.cropper.getData();
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
				const wm_center_x = (this.wm_pos_x / 100) * full_w;
				const wm_center_y = (this.wm_pos_y / 100) * full_h;
				const wm_w_full = (this.wm_size / 100) * full_w;
				const wm_h_full = wm_w_full * (this.wm_img.naturalHeight / this.wm_img.naturalWidth);
				const draw_x = (wm_center_x - wm_w_full / 2 - crop_x) * scale_x;
				const draw_y = (wm_center_y - wm_h_full / 2 - crop_y) * scale_y;
				const draw_w = wm_w_full * scale_x;
				const draw_h = wm_h_full * scale_y;
				const rot = (this.wm_corner_rotation || 0) * Math.PI / 180;
				ctx.save();
				ctx.globalAlpha = this.wm_opacity / 100;
				if (rot) {
					// Rotate around the watermark's center, matching PIL's
					// rotate(-deg, expand=True) + recentre in _apply_watermark.
					const cx = draw_x + draw_w / 2;
					const cy = draw_y + draw_h / 2;
					ctx.translate(cx, cy);
					ctx.rotate(rot);
					ctx.translate(-cx, -cy);
				}
				ctx.drawImage(this.wm_img, draw_x, draw_y, draw_w, draw_h);
				ctx.restore();
			}
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
			const rot = (this.wm_corner_rotation || 0) * Math.PI / 180;
			const cx = r.x + r.w / 2;
			const cy = r.y + r.h / 2;

			ctx.save();
			if (rot) {
				ctx.translate(cx, cy);
				ctx.rotate(rot);
				ctx.translate(-cx, -cy);
			}
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
			ctx.restore();
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
				// Disable CropperJS drag in non-crop modes so the
				// overlay elements (watermark canvas / comment DOM
				// boxes) can capture mouse events without the crop
				// box stealing them.
				if (mode === "crop") {
					this.cropper.setDragMode("crop");
				} else {
					this.cropper.setDragMode("none");
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
							corner_rotation: Math.round(this.wm_corner_rotation || 0),
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
						corner_rotation: this.wm_corner_rotation || 0,
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
				this.wm_corner_rotation = s.corner_rotation != null ? s.corner_rotation : 0;
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
/* ── Two-column grid layout (new 2026-04) ──
   Desktop: cropper on the left, tabbed param panel on the right.
   Mobile: stacked (media query below flips to single-column). */
.cropper-grid {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 420px;
	grid-template-rows: minmax(0, 1fr) auto;
	gap: 20px;
	align-items: stretch;
	min-height: 0;
	height: 100%;
}
.cropper-grid .image-cropper-actions-bottom {
	grid-column: 1 / -1;
}
.cropper-left-col {
	display: flex;
	flex-direction: column;
	min-width: 0;
	min-height: 0;
	gap: 10px;
}
.cropper-right-col {
	display: flex;
	flex-direction: column;
	gap: 10px;
	min-width: 0;
	min-height: 0;
	max-height: 100%;
	overflow-y: auto;
}

/* ── Top toolbar (drag mode + crop ratio, above the cropper) ── */
.cropper-top-toolbar {
	display: flex;
	flex-wrap: wrap;
	gap: 16px;
	padding: 8px 12px;
	margin-bottom: 8px;
	border: 1px solid var(--border-color);
	border-radius: 8px;
	background: var(--fg-color, white);
	align-items: center;
}
.cropper-toolbar-group {
	display: inline-flex;
	align-items: center;
	gap: 8px;
}
.cropper-toolbar-label {
	font-size: 12px;
	color: #606266;
	font-weight: 500;
}

img {
	display: block;
	max-width: 100%;
	/* No longer need the 420px budget — the grid flex lets the cropper
	   grow to fill available vertical space. Just cap for legacy
	   single-column case. */
	max-height: min(600px, calc(100vh - 320px));
}

/* ── Preview inline in the top toolbar ────────────────────────────
   50×50 thumb right-aligned in the toolbar row (margin-left: auto).
   Matches the cropper workspace background (#2c2c2c) so transparent
   pixels look identical to what the user is editing. Click opens
   the Element UI image-viewer lightbox. A mini spinner replaces
   the thumb while Remove BG is processing. */
.cropper-toolbar-preview {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	margin-left: auto;
}
.cropper-preview-canvas,
.cropper-preview-elimage {
	width: 50px;
	height: 50px;
	border-radius: 6px;
	background: #2c2c2c;
	overflow: hidden;
	display: block;
	cursor: zoom-in;
	transition: box-shadow 0.15s ease, transform 0.12s ease;
	flex-shrink: 0;
}
.cropper-preview-canvas {
	/* Fallback canvas before the first data URL lands in el-image.
	   _render_preview sets internal .width/height and style.width/
	   height directly on this canvas, so we leave those auto and
	   only size the outer box. */
	max-width: 50px;
	max-height: 50px;
}
.cropper-preview-canvas.el-image-backed { display: none; }
.cropper-preview-elimage:hover {
	box-shadow: 0 0 0 2px var(--primary, #2563eb), 0 4px 10px rgba(37, 99, 235, 0.22);
	transform: scale(1.05);
}
.cropper-preview-elimage >>> .el-image__inner {
	object-fit: contain;
	width: 100%;
	height: 100%;
}
/* Mini spinner that replaces the thumb while Remove BG is running. */
.cropper-toolbar-preview-spinner {
	width: 50px;
	height: 50px;
	border-radius: 6px;
	background: #2c2c2c;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}
.cropper-spinner-sm {
	width: 22px;
	height: 22px;
	border-width: 2px;
}
.cropper-preview-chips {
	margin-top: 6px;
	display: flex;
	gap: 6px;
	flex-wrap: wrap;
}
.cropper-preview-chip {
	font-size: 11px;
	padding: 2px 10px;
	border-radius: 11px;
	background: #ecf5ff;
	color: #3b82f6;
	border: 1px solid #3b82f6;
	font-weight: 600;
}

/* ── Right-side feature tabs ── */
.cropper-feature-tabs {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
	gap: 6px;
}
.cropper-feature-tab {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 4px;
	padding: 8px 6px;
	border: 1px solid var(--border-color);
	border-radius: 6px;
	background: var(--fg-color, white);
	cursor: pointer;
	font-size: 11px;
	line-height: 1.2;
	min-height: 50px;
}
.cropper-feature-tab:hover {
	background: #f5faff;
}
.cropper-feature-tab.active {
	border: 2px solid #3b82f6;
	background: #ecf5ff;
}
.cropper-feature-tab-label {
	font-weight: 600;
	color: #303133;
	font-size: 15px;
}
.cropper-feature-tab.active .cropper-feature-tab-label {
	color: #3b82f6;
}
.cropper-feature-tab-state {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	font-size: 13px;
	font-weight: 600;
	text-transform: uppercase;
}
.cropper-feature-tab-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: #cbd5e1;
}
.cropper-feature-tab-state.on {
	color: #22c55e;
}
.cropper-feature-tab-state.on .cropper-feature-tab-dot {
	background: #22c55e;
}
.cropper-feature-tab-state.off {
	color: #94a3b8;
}

/* ── Right-side tab body ── */
.cropper-tab-body {
	flex: 1;
	padding: 12px;
	border: 1px solid var(--border-color);
	border-radius: 8px;
	background: var(--fg-color, white);
	overflow-y: auto;
	min-height: 0;
}
.cropper-tab-pane {
	display: flex;
	flex-direction: column;
	gap: 14px;
}
.cropper-tab-enable {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 8px 10px;
	border: 1px solid var(--border-color);
	border-radius: 6px;
	background: #fafbfc;
}
.cropper-tab-enable-label {
	font-size: 16px;
	font-weight: 600;
	color: #303133;
	display: inline-flex;
	align-items: center;
	gap: 8px;
}
.cropper-tab-enable-hint {
	font-size: 13px;
	font-weight: 500;
	color: var(--primary);
	background: var(--control-bg, #e6f1fc);
	padding: 3px 10px;
	border-radius: 10px;
	animation: cropper-hint-pulse 1.4s ease-in-out infinite;
}
@keyframes cropper-hint-pulse {
	0%, 100% { opacity: 0.65; }
	50% { opacity: 1; }
}
.toggle-pill-compact.processing {
	cursor: not-allowed;
	pointer-events: none;
}
.toggle-pill-compact.processing .toggle-pill-track {
	animation: cropper-hint-pulse 1.4s ease-in-out infinite;
}
.toggle-pill-compact {
	padding: 0;
	border: none;
	background: none;
}

/* Canvas tab specific */
.canvas-field {
	display: flex;
	flex-direction: column;
	gap: 6px;
}
.canvas-sublabel {
	font-size: 14px;
	color: #475569;
	font-weight: 600;
}
.canvas-segmented {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
}
.canvas-segmented .segmented-tab {
	flex: 1 0 auto;
	min-width: 48px;
}
.canvas-misc-row {
	display: flex;
	gap: 12px;
	align-items: center;
	flex-wrap: wrap;
}

/* Comments list header */
.comments-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-weight: 600;
	font-size: 15px;
}

/* Watermark slider row */
.wm-slider-row {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-bottom: 6px;
}
.wm-slider-row:last-child {
	margin-bottom: 0;
}
.wm-slider-row .wm-slider-label {
	width: 100px;
	font-size: 15px;
	font-weight: 500;
	color: #475569;
}
.wm-slider-row .wm-slider {
	flex: 1;
}
.wm-slider-row .wm-slider-value {
	width: 52px;
	font-size: 14px;
	color: #303133;
	text-align: right;
	font-variant-numeric: tabular-nums;
	font-weight: 500;
}

/* ── Mobile: stack left + right columns ──
   At ≤900px the outer grid collapses to one column. Cropper keeps
   its 50vh minimum; the right panel (feature tabs + params) and
   action bar stack below. Preview thumb stays inline in the
   toolbar at 50×50 regardless of viewport. */
@media (max-width: 900px) {
	.cropper-grid {
		grid-template-columns: 1fr;
		grid-template-rows: auto auto auto;
		height: auto;
	}
	.cropper-left-col { min-height: 0; }
	.cropper-image-wrapper {
		min-height: 50vh;
	}
	.cropper-right-col {
		max-height: none;
		overflow: visible;
	}
	.cropper-feature-tabs {
		grid-template-columns: repeat(4, 1fr);
	}
	.cropper-feature-tab-label { font-size: 14px; }
	.cropper-feature-tab-state { font-size: 12px; }
	.cropper-tab-enable-label { font-size: 15px; }
	.wm-slider-row .wm-slider-label { width: 82px; font-size: 13px; }
	.wm-slider-row .wm-slider-value { width: 44px; font-size: 12px; }
	.segmented-tab { padding: 7px 12px; font-size: 13px; }
}
@media (max-width: 480px) {
	/* Very small phones — cropper still takes most of the viewport,
	   preview thumb shrinks slightly to free toolbar width. */
	.cropper-image-wrapper { min-height: 40vh; }
	.cropper-preview-canvas,
	.cropper-preview-elimage,
	.cropper-toolbar-preview-spinner {
		width: 40px;
		height: 40px;
	}
	.cropper-preview-canvas { max-width: 40px; max-height: 40px; }
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
	font-size: 14px;
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

/* Cropper takes the full height of the left column below the toolbar.
   Preview now sits inline in the toolbar (50×50 thumb), so we don't
   need a side-by-side split anymore. Deep neutral background so both
   transparent and opaque images read clearly. */
.cropper-image-wrapper {
	position: relative;
	flex: 1 1 auto;
	min-height: 0;
	min-width: 0;
	overflow: hidden;
	background: #2c2c2c;
	border-radius: 8px;
}
.cropper-image-wrapper img {
	max-width: 100%;
	max-height: 100%;
	display: block;
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
	/* Must sit above .watermark-overlay-canvas (z-index: 5) so the
	   canvas never bleeds through the sticky bar if the panel scrolls
	   far enough for the image to overlap the bar vertically. */
	z-index: 10;
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
	font-size: 14px;
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
	font-size: 13px;
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
	gap: 8px;
	margin-top: 12px;
}

.wm-panel-actions .btn-xs {
	font-size: 13px;
	padding: 5px 14px;
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

/* Output Shape section — lives in the adjustments panel. Same visual
   language as the watermark tabs but with an extra `sublabel` column. */
.adjustments-row-resize {
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.adjustments-field-hint {
	font-weight: 400;
	color: #7f8ea3;
	font-size: 11px;
	margin-left: 6px;
}
.resize-tabs-row {
	display: flex;
	align-items: center;
	gap: 10px;
	flex-wrap: wrap;
}
.resize-sublabel {
	min-width: 60px;
	font-size: 14px;
	font-weight: 600;
	color: #475569;
}
.resize-misc-row {
	display: flex;
	gap: 14px;
	align-items: center;
	flex-wrap: wrap;
	padding-left: 52px;
}
.resize-inline-field {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: 15px;
	color: #475569;
	font-weight: 500;
}
.resize-color {
	width: 36px;
	height: 28px;
	padding: 2px;
	border: 1px solid #cbd5e1;
	border-radius: 4px;
	cursor: pointer;
	background: transparent;
}
.resize-inline-toggle {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	font-size: 15px;
	color: #475569;
	font-weight: 500;
	cursor: pointer;
}
.resize-inline-toggle input[type="checkbox"] {
	width: 18px;
	height: 18px;
	cursor: pointer;
	margin: 0;
}
.toggle-pill-sublabel {
	font-size: 10px;
	color: rgba(255, 255, 255, 0.85);
	margin-left: 4px;
	padding: 1px 4px;
	background: rgba(0, 0, 0, 0.18);
	border-radius: 6px;
	font-weight: 500;
}
.segmented-tab.disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

/* Live preview canvas (new 2026-04) — shown at the top of the
   adjustments panel whenever Resize is on, so the user can see
   exactly what the final output will look like before clicking Crop. */
.adjustments-row-preview {
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.resize-preview-wrap {
	position: relative;
	display: inline-block;
	padding: 8px;
	background: #fafbfc;
	border: 1px solid #e5edf8;
	border-radius: 6px;
	align-self: flex-start;
}
.resize-preview-canvas {
	display: block;
	background: #ffffff;
	/* checkerboard so users know where transparency is */
	background-image:
		linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
		linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
		linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
		linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
	background-size: 16px 16px;
	background-position: 0 0, 0 8px, 8px -8px, -8px 0;
	min-width: 60px;
	min-height: 60px;
	max-width: 200px;
	max-height: 200px;
	border: 1px solid #cbd5e1;
}
.resize-preview-dims {
	margin-top: 6px;
	font-size: 11px;
	color: #64748b;
	text-align: center;
	font-variant-numeric: tabular-nums;
}

/* Comments list (new 2026-04) — simple inline editor for single-item
   uploads. Full drag/resize experience lives in the Item Image Batch
   CommentBoxEditor.vue; here we just need fast textarea + position
   number inputs. */
.adjustments-row-comments {
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.comments-empty-hint {
	font-size: 12px;
	color: #94a3b8;
	font-style: italic;
	padding: 4px 0;
}
.comment-entry {
	border: 1px solid #e5edf8;
	border-radius: 6px;
	background: #fafbfc;
	padding: 8px;
	display: flex;
	flex-direction: column;
	gap: 6px;
}
.comment-entry-header {
	display: flex;
	align-items: flex-start;
	gap: 6px;
}
.comment-entry-idx {
	font-size: 14px;
	color: #64748b;
	font-weight: 600;
	padding-top: 8px;
	min-width: 28px;
}
.comment-text-input {
	flex: 1;
	padding: 8px 10px;
	border: 1px solid #cbd5e1;
	border-radius: 5px;
	font-size: 15px;
	resize: vertical;
	min-height: 42px;
	font-family: inherit;
}
.comment-text-input:focus {
	outline: none;
	border-color: #3b82f6;
	box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}
.comment-delete {
	padding: 6px 12px;
	line-height: 1;
	font-size: 16px;
}
.comment-entry-controls {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
	align-items: center;
}
.comment-control {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: 14px;
	color: #475569;
	font-weight: 500;
}
.comment-num-input {
	width: 64px;
	padding: 6px 8px !important;
	font-size: 14px !important;
	border: 1px solid #cbd5e1 !important;
	border-radius: 5px !important;
	background: #fff !important;
	color: #303133 !important;
	box-sizing: border-box;
	-moz-appearance: textfield;
}
.comment-num-input::-webkit-inner-spin-button,
.comment-num-input::-webkit-outer-spin-button {
	-webkit-appearance: none;
	margin: 0;
}
.comment-num-input:focus {
	outline: none;
	border-color: #3b82f6 !important;
	box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}
.comments-actions {
	display: flex;
	gap: 6px;
	align-items: center;
	position: relative;
}
.comment-preset-menu {
	position: absolute;
	top: calc(100% + 4px);
	left: 0;
	background: #fff;
	border: 1px solid #cbd5e1;
	border-radius: 4px;
	min-width: 220px;
	max-height: 240px;
	overflow-y: auto;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
	z-index: 10;
}
.comment-preset-item {
	padding: 6px 10px;
	font-size: 12px;
	cursor: pointer;
	border-bottom: 1px solid #f1f5f9;
}
.comment-preset-item:hover {
	background: #ecf5ff;
}
.comment-preset-item:last-child {
	border-bottom: none;
}

/* Draggable comment box overlay on the cropper image (new 2026-04) */
.comment-overlay {
	pointer-events: none;
}
.comment-overlay-box {
	position: absolute;
	border: 1px dashed rgba(59, 130, 246, 0.5);
	box-sizing: border-box;
	user-select: none;
	display: flex;
	align-items: flex-start;   /* text flows from top of the box, not centered */
	justify-content: center;
	overflow: hidden;
	background: rgba(255, 255, 255, 0.02);
}
.cropper-image-wrapper.comment-mode .comment-overlay-box {
	cursor: move;
	border-color: rgba(59, 130, 246, 0.75);
	border-style: solid;
	background: rgba(59, 130, 246, 0.04);
}
.cropper-image-wrapper.comment-mode .comment-overlay-box:hover {
	background: rgba(59, 130, 246, 0.12);
}
.comment-overlay-box.selected {
	border: 2px solid #3b82f6;
}
.comment-overlay-box.dragging {
	opacity: 0.85;
}
.comment-overlay-text {
	width: 100%;
	padding: 2px 4px;
	line-height: 1.15;
	word-break: break-word;
	white-space: pre-wrap;
	overflow: hidden;
	text-overflow: clip;
}
.comment-rotate-handle {
	position: absolute;
	top: -22px;
	left: 50%;
	margin-left: -9px;
	width: 18px;
	height: 18px;
	border-radius: 50%;
	background: #10b981;
	color: #fff;
	font-size: 11px;
	line-height: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: grab;
	user-select: none;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
	z-index: 5;
}
.comment-rotate-handle:active {
	cursor: grabbing;
}
.comment-resize-handle {
	position: absolute;
	right: -6px;
	bottom: -6px;
	width: 14px;
	height: 14px;
	border-radius: 3px;
	background: #3b82f6;
	border: 2px solid #fff;
	cursor: nwse-resize;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
	z-index: 5;
}

/* Enhanced comment entry controls */
.comment-control-wide {
	flex: 1;
	min-width: 160px;
}
.comment-font-select {
	font-size: 14px !important;
	padding: 6px 10px !important;
	width: 100%;
	border: 1px solid #cbd5e1 !important;
	border-radius: 5px !important;
	background: #fff !important;
	color: #303133 !important;
	cursor: pointer;
	box-sizing: border-box;
}
.comment-font-select:focus {
	outline: none;
	border-color: #3b82f6 !important;
	box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}
.comment-style-btn {
	width: 32px;
	height: 32px;
	padding: 0;
	border: 1px solid #cbd5e1;
	border-radius: 5px;
	background: #fff;
	cursor: pointer;
	font-size: 15px;
	line-height: 1;
	display: inline-flex;
	align-items: center;
	justify-content: center;
}
.comment-style-btn.active {
	background: #3b82f6;
	color: #fff;
	border-color: #3b82f6;
}
.comment-style-btn:hover:not(.active) {
	background: #ecf5ff;
}
.comment-color-input {
	width: 36px;
	height: 32px;
	padding: 2px;
	border: 1px solid #cbd5e1;
	border-radius: 5px;
	cursor: pointer;
}
.comment-align-group {
	display: inline-flex;
	border: 1px solid #cbd5e1;
	border-radius: 5px;
	overflow: hidden;
}
.comment-align-btn {
	width: 32px;
	height: 32px;
	padding: 0;
	border: none;
	background: #fff;
	cursor: pointer;
	font-size: 14px;
	font-weight: 600;
	border-right: 1px solid #cbd5e1;
}
.comment-align-btn:last-child {
	border-right: none;
}
.comment-align-btn.active {
	background: #3b82f6;
	color: #fff;
}
.comment-entry-selected {
	border-color: #3b82f6 !important;
	box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.2);
}
.resize-hint {
	font-size: 14px;
	color: #94a3b8;
	font-style: italic;
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

/* Element UI's <el-image> mounts its image-viewer lightbox at
   document.body — it's not inside the Vue subtree so scoped styles
   can't reach it. Bootstrap's modal uses z-index: 1055, so without
   this bump the viewer opens UNDERNEATH the upload dialog and the
   user can't interact with it. */
.el-image-viewer__wrapper {
	z-index: 2050 !important;
}
.el-image-viewer__mask {
	z-index: 2049 !important;
}
</style>
