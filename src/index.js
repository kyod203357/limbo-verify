/*!
 * Limbo Verify: drop-in Content Credentials badge for any <img>.
 * Verifies C2PA manifests in the browser (WASM). No API key, no server call.
 *
 *   <script src="https://<host>/v1.0.0/limbo-verify.js" integrity="sha384-..." crossorigin="anonymous" defer></script>
 *   <img src="..." data-limbo-verify>
 *
 * Script options (data-* on the <script> tag):
 *   data-base         URL of the folder that contains vendor/ and trust/ (default: this script's folder)
 *   data-selector     CSS selector for images (default: img[data-limbo-verify])
 *   data-trust        prod (default) | dev. dev trusts the Limbo DEVELOPMENT CA and warns in the console.
 *   data-trust-pem    URL of the production CA PEM (default: <base>trust/limbo-prod-ca.pem)
 *   data-ica-issuers  comma separated issuer DIDs whose CAWG identity credentials count as validated
 * Image options:
 *   data-limbo-signed   known to be signed: show the badge at once and only load the verifier on first hover or tap
 *   data-limbo-src      verify this URL instead of the displayed one (alias: data-limbo-orig, since Webflow refuses attribute names ending in "src" on images)
 *   data-limbo-missing  "show" renders a small "No credentials" pill when nothing is found
 * Hook:
 *   window.LimboVerify.summarize = async (ctx) => "text"   // replace the built-in summary text
 */
import { BASE, SELECTOR, VERSION } from "./config.js";
import { analyze, originalsOf } from "./core.js";
import { readCredential } from "./engine.js";
import { mountBadge, mountMissing } from "./ui.js";

const results = (window.LimboVerify = Object.assign(window.LimboVerify || {}, { version: VERSION, results: [], BASE }));

// Everything the card renders, including the browser only parts (thumbnail blobs, the download link).
function buildModel(read, selfSrc) {
	const thumbs = new Map();
	for (const [id, bytes] of Object.entries(read.cred.thumbnails || {})) thumbs.set(id, URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" })));
	return {
		...analyze(read.cred.manifest),
		thumbs,
		selfSrc,
		mime: read.mime,
		size: read.size,
		typed: false,
		assetUrl: URL.createObjectURL(new Blob([read.bytes], { type: read.mime || "application/octet-stream" })),
		filename: decodeURIComponent(selfSrc.split("?")[0].split("/").pop() || "asset"),
	};
}

const imageLoaded = (img) => (img.complete ? Promise.resolve() : new Promise((r) => (img.addEventListener("load", r, { once: true }), img.addEventListener("error", r, { once: true }))));

/** Verify one image. Resolves { model, rec }: model is null when there are no credentials. */
async function verifyImage(img) {
	await imageLoaded(img);
	const shown = img.currentSrc || img.src;
	const explicit = img.dataset.limboSrc || img.dataset.limboOrig;
	const url = explicit || shown;
	const rec = { url };
	try {
		// Webflow's resized copies (…-p-500.jpg) are re-encoded and lose the manifest: when the displayed file is one, fall back to its original.
		const attempts = [url, ...(explicit ? [] : originalsOf(url))];
		let read = null;
		let lastErr = null;
		for (const u of attempts) {
			try {
				read = await readCredential(u);
				if (read) {
					rec.url = u;
					break;
				}
			} catch (err) {
				lastErr = err;
			}
		}
		if (!read && lastErr && attempts.length === 1) throw lastErr;
		if (!read) {
			rec.status = "no-credentials";
			return { model: null, rec };
		}
		const model = buildModel(read, shown);
		rec.status = model.state;
		rec.issuer = model.signer?.issuer;
		rec.versions = model.chain.steps.length;
		return { model, rec };
	} catch (err) {
		rec.status = "error";
		rec.error = String(err?.message || err);
		console.warn("[limbo-verify]", url, err);
		return { model: null, rec };
	}
}

function record(img, rec) {
	results.results.push(rec);
	img.dispatchEvent(new CustomEvent("limbo:verified", { bubbles: true, detail: rec }));
}

async function processEager(img) {
	const { model, rec } = await verifyImage(img);
	if (model) mountBadge(img, model);
	else if (rec.status === "no-credentials" && img.dataset.limboMissing === "show") mountMissing(img);
	record(img, rec);
}

// The page says this image is signed: show the badge now, verify on first hover or tap.
function mountLazy(img) {
	mountBadge(img, async () => {
		const { model, rec } = await verifyImage(img);
		record(img, rec);
		return model;
	});
}

function init() {
	const imgs = [...document.querySelectorAll(SELECTOR)].filter((i) => !i.dataset.limboDone);
	for (const img of imgs) img.dataset.limboDone = "1";
	const lazy = imgs.filter((i) => i.hasAttribute("data-limbo-signed"));
	for (const img of lazy) mountLazy(img);
	const eager = imgs.filter((i) => !lazy.includes(i));
	if (!eager.length) return;
	if (!("IntersectionObserver" in window)) return eager.forEach(processEager);
	const io = new IntersectionObserver(
		(entries) =>
			entries.forEach((e) => {
				if (e.isIntersecting) (io.unobserve(e.target), processEager(e.target));
			}),
		{ rootMargin: "200px" },
	);
	for (const img of eager) io.observe(img);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
