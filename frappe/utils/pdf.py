# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
import io
import os
import re
import subprocess
from distutils.version import LooseVersion

import pdfkit
from bs4 import BeautifulSoup
from PyPDF2 import PdfReader, PdfWriter

import frappe
from frappe import _
from frappe.utils import scrub_urls
from frappe.utils.jinja_globals import bundled_asset, is_rtl

PDF_CONTENT_ERRORS = [
	"ContentNotFoundError",
	"ContentOperationNotPermittedError",
	"UnknownContentError",
	"RemoteHostClosedError",
	"ConnectionRefusedError",
]


def convert_urls_to_local_paths(html: str) -> str:
	"""
	Convert HTTP URLs and relative paths pointing to local assets to file:// paths.
	This prevents wkhtmltopdf from making network requests that may fail.
	"""
	# Get the site URL and sites path
	from frappe.utils import get_url
	site_url = get_url()
	if site_url.endswith("/"):
		site_url = site_url[:-1]

	sites_path = frappe.local.sites_path

	# Replace URLs like http://localhost:8000/assets/... or /assets/... with file paths
	def replace_url(match):
		full_match = match.group(0)
		url = match.group(1)

		# Skip data: URLs, mailto:, tel:, javascript:, #anchors
		if url.startswith(("data:", "mailto:", "tel:", "javascript:", "#")):
			return full_match

		path = None

		# Handle full URLs pointing to our site
		if url.startswith(site_url):
			path = url[len(site_url):]
		# Handle relative URLs starting with /
		elif url.startswith("/") and not url.startswith("//"):
			path = url

		if path and path.startswith("/"):
			# Convert to local file path
			# /files/... maps to {sites_path}/{site}/public/files/...
			# /assets/... maps to {sites_path}/assets/...
			if path.startswith("/files/") or path.startswith("/private/files/"):
				local_path = os.path.join(sites_path, frappe.local.site, "public" if path.startswith("/files/") else "", path.lstrip("/"))
			else:
				local_path = os.path.join(sites_path, path.lstrip("/"))
			local_path = os.path.abspath(local_path)
			if os.path.exists(local_path):
				return full_match.replace(url, f"file://{local_path}")

		return full_match

	# Match src="...", href="...", url('...'), url("...")
	patterns = [
		r'src=["\']([^"\']+)["\']',
		r'href=["\']([^"\']+)["\']',
		r"url\(['\"]?([^)\"']+)['\"]?\)",
	]

	for pattern in patterns:
		html = re.sub(pattern, replace_url, html)

	return html


def get_pdf(html, options=None, output: PdfWriter | None = None):
	# Remove action-banner (Print/Get PDF links) that should be hidden in PDF
	html = re.sub(r'<div class="action-banner[^"]*"[^>]*>.*?</div>', '', html, flags=re.DOTALL)

	# Convert URLs to local file paths for wkhtmltopdf to avoid network requests
	html = convert_urls_to_local_paths(html)
	html, options = prepare_options(html, options)

	options.update({
		"disable-javascript": "",
		"enable-local-file-access": "",  # Allow file:// URLs for local assets
		"disable-external-links": "",
		"no-stop-slow-scripts": "",
	})

	filedata = ""
	if LooseVersion(get_wkhtmltopdf_version()) > LooseVersion("0.12.3"):
		options.update({"disable-smart-shrinking": ""})

	# Use a temporary file to capture PDF output even if wkhtmltopdf reports errors
	temp_pdf_path = f"/tmp/frappe-pdf-{frappe.generate_hash()}.pdf"

	try:
		# Write to temp file instead of returning bytes directly
		# This allows us to get partial output even if there are errors
		pdfkit.from_string(html, temp_pdf_path, options=options or {}, verbose=True)
	except OSError as e:
		# Check if PDF was created despite the error
		if not os.path.exists(temp_pdf_path) or os.path.getsize(temp_pdf_path) == 0:
			if any([error in str(e) for error in PDF_CONTENT_ERRORS]):
				frappe.log_error(f"PDF generation warning: {str(e)}", "PDF Content Error")
				# Re-raise only if no file was created
				frappe.throw(_("PDF generation failed because of broken image links"))
			else:
				raise

	try:
		# Read the generated PDF file
		if os.path.exists(temp_pdf_path) and os.path.getsize(temp_pdf_path) > 0:
			with open(temp_pdf_path, "rb") as f:
				filedata = f.read()
			reader = PdfReader(io.BytesIO(filedata))
		else:
			frappe.throw(_("PDF generation failed - no output file created"))
	finally:
		# Clean up temp PDF file
		if os.path.exists(temp_pdf_path):
			os.remove(temp_pdf_path)
		cleanup(options)

	if "password" in options:
		password = options["password"]

	if output:
		output.append_pages_from_reader(reader)
		return output

	writer = PdfWriter()
	writer.append_pages_from_reader(reader)

	if "password" in options:
		writer.encrypt(password)

	filedata = get_file_data_from_writer(writer)

	return filedata


def get_file_data_from_writer(writer_obj):

	# https://docs.python.org/3/library/io.html
	stream = io.BytesIO()
	writer_obj.write(stream)

	# Change the stream position to start of the stream
	stream.seek(0)

	# Read up to size bytes from the object and return them
	return stream.read()


def prepare_options(html, options):
	if not options:
		options = {}

	options.update(
		{
			"print-media-type": None,
			"background": None,
			"images": None,
			"quiet": None,
			# 'no-outline': None,
			"encoding": "UTF-8",
			"load-error-handling": "ignore",
			"load-media-error-handling": "ignore",
		}
	)

	if not options.get("margin-right"):
		options["margin-right"] = "15mm"

	if not options.get("margin-left"):
		options["margin-left"] = "15mm"

	html, html_options = read_options_from_html(html)
	options.update(html_options or {})

	# cookies
	options.update(get_cookie_options())

	# page size
	pdf_page_size = (
		options.get("page-size") or frappe.db.get_single_value("Print Settings", "pdf_page_size") or "A4"
	)

	if pdf_page_size == "Custom":
		options["page-height"] = options.get("page-height") or frappe.db.get_single_value(
			"Print Settings", "pdf_page_height"
		)
		options["page-width"] = options.get("page-width") or frappe.db.get_single_value(
			"Print Settings", "pdf_page_width"
		)
	else:
		options["page-size"] = pdf_page_size

	return html, options


def get_cookie_options():
	options = {}
	if frappe.session and frappe.session.sid and hasattr(frappe.local, "request"):
		# Use wkhtmltopdf's cookie-jar feature to set cookies and restrict them to host domain
		cookiejar = f"/tmp/{frappe.generate_hash()}.jar"

		# Remove port from request.host
		# https://werkzeug.palletsprojects.com/en/0.16.x/wrappers/#werkzeug.wrappers.BaseRequest.host
		domain = frappe.utils.get_host_name().split(":", 1)[0]
		with open(cookiejar, "w") as f:
			f.write(f"sid={frappe.session.sid}; Domain={domain};\n")

		options["cookie-jar"] = cookiejar

	return options


def read_options_from_html(html):
	options = {}
	soup = BeautifulSoup(html, "html5lib")

	options.update(prepare_header_footer(soup))

	toggle_visible_pdf(soup)

	# use regex instead of soup-parser
	for attr in (
		"margin-top",
		"margin-bottom",
		"margin-left",
		"margin-right",
		"page-size",
		"header-spacing",
		"orientation",
		"page-width",
		"page-height",
	):
		try:
			pattern = re.compile(r"(\.print-format)([\S|\s][^}]*?)(" + str(attr) + r":)(.+)(mm;)")
			match = pattern.findall(html)
			if match:
				options[attr] = str(match[-1][3]).strip()
		except Exception:
			pass

	return str(soup), options


def prepare_header_footer(soup):
	options = {}

	head = soup.find("head").contents
	styles = soup.find_all("style")

	print_css = bundled_asset("print.bundle.css").lstrip("/")
	css = frappe.read_file(os.path.join(frappe.local.sites_path, print_css))

	# extract header and footer
	for html_id in ("header-html", "footer-html"):
		content = soup.find(id=html_id)
		if content:
			# there could be multiple instances of header-html/footer-html
			for tag in soup.find_all(id=html_id):
				tag.extract()

			toggle_visible_pdf(content)
			html = frappe.render_template(
				"templates/print_formats/pdf_header_footer.html",
				{
					"head": head,
					"content": content,
					"styles": styles,
					"html_id": html_id,
					"css": css,
					"lang": frappe.local.lang,
					"layout_direction": "rtl" if is_rtl() else "ltr",
				},
			)

			# create temp file
			fname = os.path.join("/tmp", f"frappe-pdf-{frappe.generate_hash()}.html")
			with open(fname, "wb") as f:
				f.write(html.encode("utf-8"))

			# {"header-html": "/tmp/frappe-pdf-random.html"}
			options[html_id] = fname
		else:
			if html_id == "header-html":
				options["margin-top"] = "15mm"
			elif html_id == "footer-html":
				options["margin-bottom"] = "15mm"

	return options


def cleanup(options):
	for key in ("header-html", "footer-html", "cookie-jar"):
		if options.get(key) and os.path.exists(options[key]):
			os.remove(options[key])


def toggle_visible_pdf(soup):
	for tag in soup.find_all(attrs={"class": "visible-pdf"}):
		# remove visible-pdf class to unhide
		tag.attrs["class"].remove("visible-pdf")

	for tag in soup.find_all(attrs={"class": "hidden-pdf"}):
		# remove tag from html
		tag.extract()


def get_wkhtmltopdf_version():
	wkhtmltopdf_version = frappe.cache().hget("wkhtmltopdf_version", None)

	if not wkhtmltopdf_version:
		try:
			res = subprocess.check_output(["wkhtmltopdf", "--version"])
			wkhtmltopdf_version = res.decode("utf-8").split(" ")[1]
			frappe.cache().hset("wkhtmltopdf_version", None, wkhtmltopdf_version)
		except Exception:
			pass

	return wkhtmltopdf_version or "0"
