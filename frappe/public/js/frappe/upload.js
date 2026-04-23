// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
// MIT License. See license.txt

import FileUploader from "./file_uploader";
import ElImage from "element-ui/lib/image";

frappe.provide("frappe.ui");
frappe.ui.FileUploader = FileUploader;

// Register Element UI's <el-image> on the GLOBAL Vue so any component
// mounted through Frappe's upload flow (ImageCropper etc.) can render
// <el-image :preview-src-list="[url]"> — el-image itself lazy-mounts
// its internal el-image-viewer when the user clicks, so we don't need
// to import the viewer separately. element-ui resolves via esbuild's
// NODE_PATHS (apps/*/node_modules), which picks it up from the next
// app where it's a direct dependency. Duplicate registrations from
// later bundles (item_image_batch.bundle) are no-ops thanks to the
// exists-check below.
if (typeof window !== "undefined" && window.Vue) {
	if (!window.Vue.component("ElImage")) {
		window.Vue.component("ElImage", ElImage);
	}
}

// Load Element UI's theme-chalk CSS from CDN so <el-image> and its
// image-viewer render with the proper chrome (close button, prev/next
// arrows, zoom/rotate toolbar, icon font). The Next/POSB/Packing List
// modules do the same thing; the upload dialog needs it because the
// Item form doesn't load any of those bundles. Guarded so duplicate
// <link> tags don't accumulate across page transitions.
if (typeof document !== "undefined"
	&& !document.getElementById("frappe-element-ui-theme")) {
	const link = document.createElement("link");
	link.id = "frappe-element-ui-theme";
	link.rel = "stylesheet";
	link.href = "https://unpkg.com/element-ui/lib/theme-chalk/index.css";
	document.head.appendChild(link);
}
