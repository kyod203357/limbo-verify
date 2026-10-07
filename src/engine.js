import { BASE, ICA, TRUST, TRUST_PEM_URL } from "./config.js";

// The WASM verifier is loaded once, on first use.
let enginePromise;

async function trustAnchors(mod) {
	if (TRUST === "dev") {
		console.warn("[limbo-verify] data-trust=dev: trusting the Limbo DEVELOPMENT CA. Never ship this on a production page.");
		return [mod.DEV_CA()];
	}
	try {
		const pem = await (await fetch(TRUST_PEM_URL, { mode: "cors" })).text();
		if (/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/.test(pem)) return [pem];
	} catch {
		// fall through to the warning
	}
	console.warn("[limbo-verify] no Limbo production CA found at", TRUST_PEM_URL, "so only the official C2PA trust list applies.");
	return [];
}

const loadEngine = () =>
	(enginePromise ??= (async () => {
		const mod = await import(`${BASE}vendor/verifox_sdk_verifier.js`);
		await mod.default({ module_or_path: `${BASE}vendor/verifox_sdk_verifier_bg.wasm` });
		return mod.AssetVerifier.create({
			trustAnchors: await trustAnchors(mod), // the official C2PA anchors are always included by the SDK
			...(ICA.length ? { trustedIcaIssuers: ICA } : {}),
		});
	})());

/** Fetch an image and read its credential. Resolves null when the file carries no manifest. */
export async function readCredential(url) {
	// force-cache lets the browser reuse the copy the <img> already downloaded instead of fetching it twice
	const res = await fetch(url, { mode: "cors", cache: "force-cache" });
	if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
	const mime = res.headers.get("content-type") || "";
	const bytes = new Uint8Array(await res.arrayBuffer());
	const verifier = await loadEngine();
	const copy = bytes.slice(); // the wasm binding can detach the buffer it is handed
	const found = await verifier.verify({ length: copy.length, readAt: (o, l) => copy.subarray(o, o + l) }, []);
	const cred = found.credentials?.[0];
	return cred?.manifest ? { cred, mime, size: bytes.length, bytes } : null;
}
