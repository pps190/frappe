# Copyright (c) 2015, Frappe Technologies and Contributors
# License: MIT. See LICENSE

import smtplib
from unittest.mock import Mock, patch

import frappe
from frappe.tests.utils import FrappeTestCase


class TestEmailQueue(FrappeTestCase):
	def test_email_queue_deletion_based_on_modified_date(self):
		from frappe.email.doctype.email_queue.email_queue import EmailQueue

		old_record = frappe.get_doc(
			{
				"doctype": "Email Queue",
				"sender": "Test <test@example.com>",
				"show_as_cc": "",
				"message": "Test message",
				"status": "Sent",
				"priority": 1,
				"recipients": [
					{
						"recipient": "test_auth@test.com",
					}
				],
			}
		).insert()

		old_record.modified = "2010-01-01 00:00:01"
		old_record.recipients[0].modified = old_record.modified
		old_record.db_update_all()

		new_record = frappe.copy_doc(old_record)
		new_record.insert()

		EmailQueue.clear_old_logs()

		self.assertFalse(frappe.db.exists("Email Queue", old_record.name))
		self.assertFalse(frappe.db.exists("Email Queue Recipient", {"parent": old_record.name}))

		self.assertTrue(frappe.db.exists("Email Queue", new_record.name))
		self.assertTrue(frappe.db.exists("Email Queue Recipient", {"parent": new_record.name}))


# Custom (not upstream Frappe): tests for the ZeptoMail daily-send-limit gate + relay-throttle
# handling. No real email is sent here — every test is a pure-function call or a DB-seed + call;
# the __exit__ test uses a mock SMTP server and a mock queue doc, so no SMTP socket, no account
# resolution, and no commit occur.
CACHE_KEY = "zeptomail_send_paused"
_UNSET = object()


class TestZeptomailDailyLimit(FrappeTestCase):
	def setUp(self):
		self._orig_limit = frappe.conf.get("zeptomail_daily_limit", _UNSET)
		frappe.cache().delete_value(CACHE_KEY)

	def tearDown(self):
		if self._orig_limit is _UNSET:
			frappe.conf.pop("zeptomail_daily_limit", None)
		else:
			frappe.conf.zeptomail_daily_limit = self._orig_limit
		frappe.cache().delete_value(CACHE_KEY)

	def _make_eq(self, status):
		return frappe.get_doc(
			{
				"doctype": "Email Queue",
				"sender": "Test <test@example.com>",
				"message": "Test message",
				"status": status,
				"priority": 1,
				"recipients": [{"recipient": "to@test.com"}],
			}
		).insert()

	# --- classifier: pure, no DB / no framework ---------------------------------------
	def test_classify_daily_cap(self):
		from frappe.email.doctype.email_queue.email_queue import classify_relay_throttle

		exc = smtplib.SMTPDataError(-1, b"9dsn=5.1.8, stat=failure, 5.1.8 Sender Org Blocked")
		self.assertEqual(classify_relay_throttle(exc), "daily_cap")

	def test_classify_rate_limit(self):
		from frappe.email.doctype.email_queue.email_queue import classify_relay_throttle

		exc = smtplib.SMTPRecipientsRefused(
			{"x@y.com": (452, b"4.4.5 Rate limit exceeded, try again later.")}
		)
		self.assertEqual(classify_relay_throttle(exc), "rate_limit")

	def test_classify_bad_address_is_not_throttle(self):
		from frappe.email.doctype.email_queue.email_queue import classify_relay_throttle

		exc = smtplib.SMTPRecipientsRefused(
			{"x@y.com": (550, b"The account or domain may not exist ...")}
		)
		self.assertIsNone(classify_relay_throttle(exc))

	def test_classify_non_smtp_is_none(self):
		from frappe.email.doctype.email_queue.email_queue import classify_relay_throttle

		self.assertIsNone(classify_relay_throttle(ValueError("boom")))

	# --- gate: DB-seed, relative to a measured baseline -------------------------------
	def test_daily_sent_count_excludes_not_sent(self):
		from frappe.email.queue import get_daily_sent_count

		baseline = get_daily_sent_count()
		self._make_eq("Sent")
		self._make_eq("Sending")
		self._make_eq("Not Sent")  # must NOT be counted
		self.assertEqual(get_daily_sent_count(), baseline + 2)

	def test_gate_blocks_when_limit_reached(self):
		from frappe.email.queue import get_daily_sent_count, get_queue

		self._make_eq("Sent")
		self._make_eq("Not Sent")  # a candidate that would otherwise dequeue
		frappe.conf.zeptomail_daily_limit = get_daily_sent_count()  # remaining == 0
		self.assertEqual(get_queue(), [])

	def test_gate_caps_batch_to_remaining(self):
		from frappe.email.queue import get_daily_sent_count, get_queue

		for _ in range(3):
			self._make_eq("Not Sent")
		frappe.conf.zeptomail_daily_limit = get_daily_sent_count() + 2  # remaining == 2
		self.assertLessEqual(len(get_queue()), 2)

	def test_no_config_key_means_no_gate(self):
		from frappe.email.queue import get_queue

		frappe.conf.pop("zeptomail_daily_limit", None)
		self._make_eq("Not Sent")
		# no gate -> not forced empty (at least the row we just queued is dequeuable)
		self.assertGreaterEqual(len(get_queue()), 1)

	def test_breaker_flag_blocks_dequeue(self):
		from frappe.email.queue import get_queue

		frappe.conf.pop("zeptomail_daily_limit", None)
		self._make_eq("Not Sent")
		frappe.cache().set_value(CACHE_KEY, {"kind": "daily_cap", "until": "2099-01-01 00:00:00"})
		self.assertEqual(get_queue(), [])

	# --- status method: DB-seed + cache ----------------------------------------------
	def test_status_off_when_key_unset(self):
		from frappe.email.doctype.email_queue.email_queue import get_daily_limit_status

		frappe.conf.pop("zeptomail_daily_limit", None)
		self.assertEqual(get_daily_limit_status(), {"limit": 0})

	def test_status_reports_usage_and_throttle(self):
		from frappe.email.doctype.email_queue.email_queue import get_daily_limit_status
		from frappe.email.queue import get_daily_sent_count

		self._make_eq("Sent")
		sent = get_daily_sent_count()
		frappe.conf.zeptomail_daily_limit = sent + 5
		frappe.cache().set_value(CACHE_KEY, {"kind": "rate_limit", "until": "2099-01-01 00:00:00"})

		status = get_daily_limit_status()
		self.assertEqual(status["limit"], sent + 5)
		self.assertEqual(status["sent"], sent)
		self.assertEqual(status["remaining"], 5)
		self.assertIsNotNone(status["resets_at"])
		self.assertTrue(status["throttled"])
		self.assertEqual(status["throttle_kind"], "rate_limit")

	# --- __exit__ reactive branch: mock server + mock doc, no SMTP / no commit --------
	def _run_exit(self, exc, retry=0, sent_any=False):
		from frappe.email.doctype.email_queue.email_queue import SendMailContext

		ctx = SendMailContext.__new__(SendMailContext)
		ctx.queue_doc = Mock(retry=retry)
		ctx.sent_to_atleast_one_recipient = sent_any
		ctx.retain_smtp_session = True  # so __exit__ never calls .quit() on a live socket
		ctx.smtp_server = Mock()
		ctx.__exit__(type(exc), exc, None)
		return ctx.queue_doc.update_status.call_args.kwargs

	def test_exit_daily_cap_no_retry_and_trips_breaker(self):
		exc = smtplib.SMTPDataError(-1, b"9dsn=5.1.8, stat=failure, 5.1.8 Sender Org Blocked")
		kwargs = self._run_exit(exc)
		self.assertEqual(kwargs["status"], "Not Sent")
		self.assertNotIn("retry", kwargs)  # retry NOT burned
		self.assertEqual(frappe.cache().get_value(CACHE_KEY).get("kind"), "daily_cap")

	def test_exit_rate_limit_no_retry_and_trips_breaker(self):
		exc = smtplib.SMTPRecipientsRefused(
			{"x@y.com": (452, b"4.4.5 Rate limit exceeded, try again later.")}
		)
		kwargs = self._run_exit(exc)
		self.assertEqual(kwargs["status"], "Not Sent")
		self.assertNotIn("retry", kwargs)
		self.assertEqual(frappe.cache().get_value(CACHE_KEY).get("kind"), "rate_limit")

	def test_exit_bad_address_still_retries(self):
		exc = smtplib.SMTPRecipientsRefused(
			{"x@y.com": (550, b"The account or domain may not exist ...")}
		)
		kwargs = self._run_exit(exc, retry=0)
		self.assertEqual(kwargs["retry"], 1)  # normal retry semantics preserved
		self.assertIsNone(frappe.cache().get_value(CACHE_KEY))  # breaker NOT tripped

	# --- can_send_now ----------------------------------------------------------------
	def test_can_send_now_false_when_breaker_set(self):
		from frappe.email.doctype.email_queue.email_queue import EmailQueue

		eq = EmailQueue.__new__(EmailQueue)
		eq.status = "Not Sent"
		# this site has mute_emails=1; patch it off to isolate the breaker check
		with patch("frappe.are_emails_muted", return_value=False):
			frappe.cache().set_value(
				CACHE_KEY, {"kind": "daily_cap", "until": "2099-01-01 00:00:00"}
			)
			self.assertFalse(eq.can_send_now())
			frappe.cache().delete_value(CACHE_KEY)
			self.assertTrue(eq.can_send_now())
