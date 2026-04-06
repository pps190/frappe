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
	} = {}) {
		frm && frm.attachments.max_reached(true);
		this.show_remove_bg = show_remove_bg;

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

		if (files && files.length) {
			this.uploader.add_files(files);
		}

		// Sync footer toggle when cropper changes remove_bg state
		if (this.show_remove_bg) {
			this.uploader.$watch("remove_bg_checked", () => {
				this.update_remove_bg_toggle();
			});
		}
	}

	upload_files() {
		this.dialog && this.dialog.get_primary_btn().prop("disabled", true);
		this.dialog && this.dialog.get_secondary_btn().prop("disabled", true);
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
				this.uploader.wrapper_ready = true;
			},
		});

		this.wrapper = this.dialog.body;
		this.dialog.show();
		this.dialog.$wrapper.on("hidden.bs.modal", function () {
			$(this).data("bs.modal", null);
			$(this).remove();
		});

		if (this.show_remove_bg) {
			this.add_remove_bg_toggle();
		}
	}

	add_remove_bg_toggle() {
		const $toggle = $(`
			<div class="remove-bg-footer-toggle">
				<div class="remove-bg-pill active">
					<span class="remove-bg-label">${__("Remove Background")}</span>
					<span class="remove-bg-switch">
						<span class="remove-bg-track on">
							<span class="remove-bg-thumb"></span>
						</span>
					</span>
				</div>
			</div>
		`);

		this.dialog.footer.prepend($toggle);
		this.$remove_bg_toggle = $toggle;

		$toggle.on("click", () => {
			this.uploader.remove_bg_checked = !this.uploader.remove_bg_checked;
			this.update_remove_bg_toggle();
		});
	}

	update_remove_bg_toggle() {
		if (!this.$remove_bg_toggle) return;
		const active = this.uploader.remove_bg_checked;
		this.$remove_bg_toggle.find(".remove-bg-pill").toggleClass("active", active);
		this.$remove_bg_toggle.find(".remove-bg-track").toggleClass("on", active);
	}
}
