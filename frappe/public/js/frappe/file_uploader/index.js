import FileUploaderComponent from "./FileUploader.vue";

export default class FileUploader {
	constructor({
		wrapper,
		method,
		on_success,
		doctype,
		docname,
		fieldname,
		files,
		folder,
		restrictions = {},
		upload_notes,
		allow_multiple,
		as_dataurl,
		disable_file_browser,
		dialog_title,
		attach_doc_image,
		frm,
		make_attachments_public,
		show_remove_bg,
		remove_bg_default,
		remove_bg_disabled_hint,
		remove_bg_disabled_link,
		remove_bg_padding_pct,
		default_crop_aspect,
		default_solid_background,
		default_background_color,
		show_watermark,
		watermark_settings,
		show_comments,
		comment_defaults,
		comment_presets,
	} = {}) {
		frm && frm.attachments.max_reached(true);
		this.show_remove_bg = show_remove_bg;
		this.remove_bg_disabled_hint = remove_bg_disabled_hint;
		this.remove_bg_disabled_link = remove_bg_disabled_link;
		this.remove_bg_padding_pct = remove_bg_padding_pct;
		this.show_watermark = show_watermark;
		this.watermark_settings = watermark_settings;
		this.show_comments = show_comments;
		this.comment_defaults = comment_defaults;
		this.comment_presets = comment_presets;

		if (!wrapper) {
			this.make_dialog(dialog_title);
		} else {
			this.wrapper = wrapper.get ? wrapper.get(0) : wrapper;
		}

		this.$fileuploader = new Vue({
			el: this.wrapper,
			render: (h) =>
				h(FileUploaderComponent, {
					props: {
						show_upload_button: !Boolean(this.dialog),
						doctype,
						docname,
						fieldname,
						method,
						folder,
						on_success,
						restrictions,
						upload_notes,
						allow_multiple,
						as_dataurl,
						disable_file_browser,
						attach_doc_image,
						make_attachments_public,
						show_remove_bg,
						remove_bg_default,
						remove_bg_disabled_hint,
						remove_bg_padding_pct,
						default_crop_aspect,
						default_solid_background,
						default_background_color,
						show_watermark,
						watermark_settings,
						show_comments,
						comment_defaults,
						comment_presets,
					},
				}),
		});

		this.uploader = this.$fileuploader.$children[0];

		if (!this.dialog) {
			this.uploader.wrapper_ready = true;
		}

		this.uploader.$watch(
			"files",
			(files) => {
				let all_private = files.every((file) => file.private);
				if (this.dialog) {
					this.dialog.set_secondary_action_label(
						all_private ? __("Set all public") : __("Set all private")
					);
				}
			},
			{ deep: true }
		);

		this.uploader.$watch("trigger_upload", (trigger_upload) => {
			if (trigger_upload) {
				this.upload_files();
			}
		});

		this.uploader.$watch("close_dialog", (close_dialog) => {
			if (close_dialog) {
				this.dialog && this.dialog.hide();
			}
		});

		this.uploader.$watch("hide_dialog_footer", (hide_dialog_footer) => {
			if (hide_dialog_footer) {
				this.dialog && this.dialog.footer.addClass("hide");
				this.dialog.$wrapper.data("bs.modal")._config.backdrop = "static";
			} else {
				this.dialog && this.dialog.footer.removeClass("hide");
				this.dialog.$wrapper.data("bs.modal")._config.backdrop = true;
			}
		});

		// Disable Upload/Set all private only while an upload is actually
		// in-flight (currently_uploading >= 0). Re-enable when idle (-1) so
		// users can retry after a failed upload or after cancelling a crop.
		this.uploader.$watch("currently_uploading", (val) => {
			if (!this.dialog) return;
			const uploading = val >= 0;
			this.dialog.get_primary_btn().prop("disabled", uploading);
			this.dialog.get_secondary_btn().prop("disabled", uploading);
		});

		if (files && files.length) {
			this.uploader.add_files(files);
		}

		// Note: the footer-toggle pills (Remove BG / Watermark / Comments /
		// Canvas) have been removed. They are now rendered as tabs + toggle
		// switches inside the uploader body's right-side panel, which keeps
		// one source of truth for feature state across all 3 steps (file
		// picker, cropper, post-crop list).
	}

	upload_files() {
		// Guard against clicking Upload before a file is selected. Without this,
		// the no-op upload would still trigger the disable path below and leave
		// users stuck. Special modes (file_browser, web_link) handle their own
		// no-selection case downstream.
		const uploader = this.uploader;
		const has_files = uploader && uploader.files && uploader.files.length > 0;
		const in_special_mode =
			uploader && (uploader.show_file_browser || uploader.show_web_link);
		if (!has_files && !in_special_mode) {
			frappe.show_alert({
				message: __("Please select a file first"),
				indicator: "orange",
			});
			return;
		}

		// Button state is managed by the currently_uploading watcher below —
		// only really disable while an upload is in-flight, so users can still
		// re-click Upload after cropping or after a failed attempt.
		return this.uploader.upload_files();
	}

	make_dialog(title) {
		this.dialog = new frappe.ui.Dialog({
			title: title || __("Upload"),
			primary_action_label: __("Upload"),
			primary_action: () => this.upload_files(),
			secondary_action_label: __("Set all private"),
			secondary_action: () => {
				this.uploader.toggle_all_private();
			},
			on_page_show: () => {
				if (this.uploader) {
					this.uploader.wrapper_ready = true;
				}
			},
		});

		this.wrapper = this.dialog.body;
		// Tag the dialog so CSS can size it larger for the image features.
		this.dialog.$wrapper.addClass("file-uploader-dialog");
		this.dialog.show();
		this.dialog.$wrapper.on("hidden.bs.modal", function () {
			$(this).data("bs.modal", null);
			$(this).remove();
		});
	}

	add_footer_toggle(key, label, uploader_field, initial_active, disabled_hint, disabled_link) {
		// Disabled state: the pill itself renders with the same shape + switch
		// chrome as a normal pill (just in a "grey/off" visual state so the
		// footer layout stays uniform). The pill is non-interactive. A separate
		// red ⓘ button sits to the right of the pill — clicking it opens a
		// frappe.confirm dialog that shows the reason and asks whether to jump
		// to the admin settings page.
		const disabled = !!disabled_hint;
		// A11y — the pill is functionally a switch, not a plain div.
		// Exposing role="switch" + aria-checked + tabindex + keyboard
		// activation makes it reachable and operable via keyboard and
		// readable by screen readers. Disabled pills mark themselves
		// with aria-disabled + aria-label carrying the reason so AT
		// users hear the "why" without clicking the ⓘ.
		const pill_aria = disabled
			? `role="switch" aria-checked="false" aria-disabled="true" aria-label="${frappe.utils.escape_html(
				`${label} — ${disabled_hint}`
			)}" tabindex="-1"`
			: `role="switch" aria-checked="${initial_active ? "true" : "false"}" tabindex="0" aria-label="${frappe.utils.escape_html(label)}"`;
		const $toggle = $(`
			<div class="footer-toggle" data-key="${key}">
				<div class="footer-toggle-pill ${disabled ? "is-disabled" : (initial_active ? "active" : "")}" ${pill_aria}>
					<span class="footer-toggle-label">${label}</span>
					<span class="footer-toggle-switch">
						<span class="footer-toggle-track ${!disabled && initial_active ? "on" : ""}">
							<span class="footer-toggle-thumb"></span>
						</span>
					</span>
				</div>
				${disabled
					? `<button type="button" class="footer-toggle-info-btn" aria-label="${__("Why is this disabled?")}">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
					</button>`
					: ""
				}
			</div>
		`);

		this.dialog.footer.prepend($toggle);

		if (disabled) {
			// Info button: open a modern info popover explaining why the
			// feature is disabled. Only System Managers see the actionable
			// "Open settings" button — everyone else gets a read-only notice
			// telling them to ask a System Manager.
			$toggle.find(".footer-toggle-info-btn").on("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				show_disabled_feature_notice({
					feature_label: label,
					reason: disabled_hint,
					settings_link: disabled_link,
				});
			});
		} else {
			const $pill = $toggle.find(".footer-toggle-pill");
			const $track = $toggle.find(".footer-toggle-track");
			const flip = () => {
				this.uploader[uploader_field] = !this.uploader[uploader_field];
				const active = this.uploader[uploader_field];
				$pill.toggleClass("active", active).attr("aria-checked", active ? "true" : "false");
				$track.toggleClass("on", active);
			};
			$toggle.on("click", flip);
			// Keyboard activation — role="switch" should respond to
			// Space and Enter. Without this the pill is focusable but
			// can't be toggled without a mouse.
			$pill.on("keydown", (e) => {
				if (e.key === " " || e.key === "Enter") {
					e.preventDefault();
					flip();
				}
			});

			// Sync when uploader state changes (e.g. from ImageCropper)
			this.uploader.$watch(uploader_field, (val) => {
				$pill.toggleClass("active", val).attr("aria-checked", val ? "true" : "false");
				$track.toggleClass("on", val);
			});
		}
	}
}

// ── Disabled feature notice ─────────────────────────────────────────────
//
// Shown when the user clicks the red ⓘ button next to a disabled footer
// toggle pill (e.g. Remove Background turned off in Image Processing
// Settings, or Watermark not configured).
//
// UX rules:
//   - Every user sees the reason text
//   - System Managers also see a primary "Open settings" button
//   - Non-System-Managers see a read-only note asking them to contact a
//     System Manager — no actionable link
//
// The dialog is a custom Bootstrap modal rather than frappe.confirm /
// frappe.msgprint so we can style it consistently with the new Upload
// dialog header (rounded card, warning icon, muted reason paragraph,
// grouped action buttons).
function show_disabled_feature_notice({ feature_label, reason, settings_link }) {
	const is_system_manager =
		Array.isArray(frappe.user_roles) && frappe.user_roles.includes("System Manager");

	// Build a minimal Bootstrap modal that matches the Upload dialog style.
	const $modal = $(`
		<div class="modal fade feature-disabled-modal" tabindex="-1" role="dialog">
			<div class="modal-dialog modal-sm modal-dialog-centered" role="document">
				<div class="modal-content">
					<div class="feature-disabled-body">
						<div class="feature-disabled-icon">
							<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
								<line x1="12" y1="9" x2="12" y2="13"/>
								<line x1="12" y1="17" x2="12.01" y2="17"/>
							</svg>
						</div>
						<h4 class="feature-disabled-title">${__("{0} unavailable", [frappe.utils.escape_html(feature_label)])}</h4>
						<p class="feature-disabled-reason">${frappe.utils.escape_html(reason)}</p>
						${!is_system_manager
							? `<div class="feature-disabled-note">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
								${__("Only a System Manager can change this setting.")}
							</div>`
							: ""
						}
					</div>
					<div class="feature-disabled-actions">
						<button type="button" class="btn btn-default btn-sm" data-action="close">${__("Got it")}</button>
						${is_system_manager && settings_link
							? `<button type="button" class="btn btn-primary btn-sm" data-action="open-settings">
								${__("Open Settings")}
							</button>`
							: ""
						}
					</div>
				</div>
			</div>
		</div>
	`);

	$("body").append($modal);
	$modal.modal({ backdrop: true, keyboard: true });
	$modal.on("hidden.bs.modal", () => $modal.remove());

	$modal.find('[data-action="close"]').on("click", () => $modal.modal("hide"));
	$modal.find('[data-action="open-settings"]').on("click", () => {
		$modal.modal("hide");
		window.open(settings_link, "_blank");
	});
}
