// Bundle src/ into one script and assemble a versioned, immutable release folder: dist/v<version>/.
// Usage: node scripts/build.mjs [--release]
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const release = process.argv.includes("--release");
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const out = `dist/v${version}`;

for (const f of [".vendor/verifox_sdk_verifier.js", ".vendor/verifox_sdk_verifier_bg.wasm"]) {
	if (!existsSync(f)) {
		console.error(`${f} is missing. Run: npm run vendor`);
		process.exit(1);
	}
}

// The production CA is required for a release, because "Trusted" on a live site must not depend on a development certificate.
const pem = readFileSync("trust/limbo-prod-ca.pem", "utf8");
const hasProdCa = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/.test(pem);
if (release && !hasProdCa) {
	console.error("trust/limbo-prod-ca.pem is still the placeholder. Add the Limbo production CA before releasing (see docs/OPERATIONS.md).");
	process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/vendor`, { recursive: true });
mkdirSync(`${out}/trust`, { recursive: true });

await build({
	entryPoints: ["src/index.js"],
	bundle: true,
	minify: true,
	format: "iife",
	target: "es2020",
	outfile: `${out}/limbo-verify.js`,
	define: { __VERSION__: JSON.stringify(version) },
	loader: { ".png": "dataurl", ".txt": "text" },
	banner: { js: `/*! limbo-verify v${version} */` },
	logLevel: "warning",
});

copyFileSync(".vendor/verifox_sdk_verifier.js", `${out}/vendor/verifox_sdk_verifier.js`);
copyFileSync(".vendor/verifox_sdk_verifier_bg.wasm", `${out}/vendor/verifox_sdk_verifier_bg.wasm`);
copyFileSync("trust/limbo-prod-ca.pem", `${out}/trust/limbo-prod-ca.pem`);

const sri = (f) => `sha384-${createHash("sha384").update(readFileSync(`${out}/${f}`)).digest("base64")}`;
const files = ["limbo-verify.js", "vendor/verifox_sdk_verifier.js", "vendor/verifox_sdk_verifier_bg.wasm", "trust/limbo-prod-ca.pem"];
const integrity = Object.fromEntries(files.map((f) => [f, sri(f)]));
writeFileSync(`${out}/integrity.json`, `${JSON.stringify({ version, prodCa: hasProdCa, integrity }, null, 2)}\n`);

// Site level files: cache and CORS headers, and the demo page.
cpSync("site", "dist", { recursive: true });
copyFileSync("test/fixtures/limbo-dev-signed.jpg", "dist/demo-signed.jpg");
writeFileSync("dist/index.html", readFileSync("site/index.html", "utf8").replaceAll("__VERSION__", version));

console.log(`built ${out}  limbo-verify.js ${(readFileSync(`${out}/limbo-verify.js`).length / 1024).toFixed(1)} KB`);
console.log(`<script src="https://VERIFY_HOST/v${version}/limbo-verify.js" integrity="${integrity["limbo-verify.js"]}" crossorigin="anonymous" defer></script>`);
