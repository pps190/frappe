frappe.listview_settings["Email Queue"] = {
	get_indicator: function (doc) {
		var colour = {
			Sent: "green",
			Sending: "blue",
			"Not Sent": "grey",
			Error: "red",
			Expired: "orange",
		};
		return [__(doc.status), colour[doc.status], "status,=," + doc.status];
	},
	refresh: function (listview) {
		show_toggle_sending_button(listview);
		add_bulk_retry_button_to_actions(listview);
		show_daily_limit_banner(listview);
	},
	onload: function (list_view) {
		frappe.require("logtypes.bundle.js", () => {
			frappe.utils.logtypes.show_log_retention_message(list_view.doctype);
		});
	},
};

function show_toggle_sending_button(list_view) {
	if (!has_common(frappe.user_roles, ["Administrator", "System Manager"])) return;

	const sending_disabled = cint(frappe.sys_defaults.suspend_email_queue);
	const label = sending_disabled ? __("Resume Sending") : __("Suspend Sending");

	list_view.page.add_inner_button(label, async () => {
		await frappe.xcall(
			"frappe.email.doctype.email_queue.email_queue.toggle_sending",

			// enable if disabled
			{ enable: sending_disabled }
		);

		// set new value for suspend_email_queue in sys_defaults
		frappe.sys_defaults.suspend_email_queue = sending_disabled ? 0 : 1;

		// clear the button and show one with the opposite label
		list_view.page.remove_inner_button(label);
		show_toggle_sending_button(list_view);
	});
}

// Custom (not upstream Frappe): banner showing ZeptoMail daily-send-limit usage and any
// active relay-throttle pause. Renders nothing unless `zeptomail_daily_limit` is configured.
function show_daily_limit_banner(listview) {
	frappe
		.xcall("frappe.email.doctype.email_queue.email_queue.get_daily_limit_status")
		.then((s) => {
			if (!s || !s.limit) return; // feature off -> no banner
			let msg, danger;
			if (s.throttled) {
				// breaker tripped: show why + when it lifts
				let kind = s.throttle_kind === "rate_limit" ? __("rate limit") : __("daily cap");
				let until = s.throttle_until ? frappe.datetime.str_to_user(s.throttle_until) : "—";
				msg = __("Sending paused ({0}) — resumes ~{1} · sent {2}/{3} in last 24h", [
					kind,
					until,
					s.sent,
					s.limit,
				]);
				danger = true;
			} else {
				let resets = s.resets_at ? frappe.datetime.str_to_user(s.resets_at) : "—";
				msg = __("Sent {0}/{1} in last 24h · {2} remaining · resets ~{3}", [
					s.sent,
					s.limit,
					s.remaining,
					resets,
				]);
				danger = s.remaining === 0;
			}
			let $m = listview.page.add_inner_message(msg);
			// !danger already implies remaining > 0 here (remaining is max(0, ...))
			$m.toggleClass("text-danger", danger).toggleClass(
				"text-warning",
				!danger && s.remaining <= s.limit * 0.1
			);
		});
}

function add_bulk_retry_button_to_actions(list_view) {
	list_view.page.add_actions_menu_item(__("Retry Sending"), () => {
		frappe.call({
			method: "frappe.email.doctype.email_queue.email_queue.bulk_retry",
			args: {
				queues: list_view.get_checked_items(true),
			},
			callback: (r) => {
				if (!r.exc) {
					list_view.refresh();
				}
			},
		});
	});
}
