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
		show_watermark,
		watermark_settings,
	} = {}) {
		frm && frm.attachments.max_reached(true);
		this.show_remove_bg = show_remove_bg;
		this.remove_bg_disabled_hint = remove_bg_disabled_hint;
		this.remove_bg_disabled_link = remove_bg_disabled_link;
		this.show_watermark = show_watermark;
		this.watermark_settings = watermark_settings;

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
						show_watermark,
						watermark_settings,
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

		// Add footer toggles after uploader is ready
		if (this.dialog && this.show_remove_bg) {
			this.add_footer_toggle(
				"remove_bg",
				__("Remove Background"),
				"remove_bg_checked",
				!this.remove_bg_disabled_hint,
				this.remove_bg_disabled_hint || null,
				this.remove_bg_disabled_link || null,
			);
		}
		if (this.dialog && this.show_watermark) {
			const has_config = this.watermark_settings && this.watermark_settings.watermark_image;
			this.add_footer_toggle(
				"watermark",
				__("Watermark"),
				"wm_enabled",
				has_config && this.watermark_settings.enabled ? true : false,
				has_config ? null : __("Click to configure watermark"),
				has_config ? null : "/app/watermark-settings",
			);
		}
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
		this.dialog.show();
		this.dialog.$wrapper.on("hidden.bs.modal", function () {
			$(this).data("bs.modal", null);
			$(this).remove();
		});
	}

	add_footer_toggle(key, label, uploader_field, initial_active, disabled_hint, disabled_link) {
		const disabled = !!disabled_hint;
		const $toggle = $(`
			<div class="footer-toggle" data-key="${key}">
				<div class="footer-toggle-pill ${disabled ? "disabled" : (initial_active ? "active" : "")}">
					<span class="footer-toggle-label">${label}</span>
					${disabled
						? `<span class="footer-toggle-hint">${disabled_hint}</span>`
						: `<span class="footer-toggle-switch">
							<span class="footer-toggle-track ${initial_active ? "on" : ""}">
								<span class="footer-toggle-thumb"></span>
							</span>
						</span>`
					}
				</div>
			</div>
		`);

		this.dialog.footer.prepend($toggle);

		if (disabled) {
			$toggle.on("click", () => {
				if (disabled_link) {
					window.open(disabled_link, "_blank");
				}
			});
		} else {
			$toggle.on("click", () => {
				this.uploader[uploader_field] = !this.uploader[uploader_field];
				const active = this.uploader[uploader_field];
				$toggle.find(".footer-toggle-pill").toggleClass("active", active);
				$toggle.find(".footer-toggle-track").toggleClass("on", active);
			});

			// Sync when uploader state changes (e.g. from ImageCropper)
			this.uploader.$watch(uploader_field, (val) => {
				$toggle.find(".footer-toggle-pill").toggleClass("active", val);
				$toggle.find(".footer-toggle-track").toggleClass("on", val);
			});
		}
	}
}
