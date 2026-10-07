// Read once, synchronously, while this file's <script> tag is still `document.currentScript`.
const script = document.currentScript;
const d = script?.dataset ?? {};

/** Folder that holds `vendor/` and `trust/`: the script's own folder unless data-base says otherwise. */
export const BASE = (d.base || new URL(".", script?.src || location.href).href).replace(/\/?$/, "/");
export const SELECTOR = d.selector || "img[data-limbo-verify]";
/** "prod" (default) trusts the Limbo production CA plus the official C2PA list. "dev" trusts the Limbo DEVELOPMENT CA. */
export const TRUST = d.trust || "prod";
export const TRUST_PEM_URL = d.trustPem || `${BASE}trust/limbo-prod-ca.pem`;
export const ICA = (d.icaIssuers || "").split(",").map((s) => s.trim()).filter(Boolean);
// eslint-disable-next-line no-undef
export const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "dev";
