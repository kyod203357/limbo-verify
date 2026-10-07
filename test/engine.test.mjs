// Runs the real WASM verifier on the fixtures. Needs `npm run vendor` first.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { before, test } from "node:test";
import { aiFacts, analyze, defaultSummary, words } from "../src/core.js";

const ready = existsSync(".vendor/verifox_sdk_verifier.js");
let mod;
before(async () => {
	if (!ready) return;
	mod = await import(new URL("../.vendor/verifox_sdk_verifier.js", import.meta.url));
	await mod.default({ module_or_path: readFileSync(".vendor/verifox_sdk_verifier_bg.wasm") });
});

const verify = async (file, anchors) => {
	const bytes = readFileSync(file);
	const verifier = mod.AssetVerifier.create({ trustAnchors: anchors });
	return (await verifier.verify({ length: bytes.length, readAt: (o, l) => bytes.subarray(o, o + l) }, [])).credentials?.[0];
};

test("a Limbo signed image is Trusted when the dev CA is trusted", { skip: !ready && "run npm run vendor" }, async () => {
	const cred = await verify("test/fixtures/limbo-dev-signed.jpg", [mod.DEV_CA()]);
	const model = analyze(cred.manifest);
	assert.equal(model.state, "Trusted");
	assert.equal(model.verdict, "trusted");
	assert.equal(model.chain.steps.length, 5);
	assert.ok(Object.keys(cred.thumbnails).length >= 5, "thumbnails come back for the chain");
	assert.ok(words(defaultSummary(model, aiFacts(model))) <= 20);
});

test("the same image is only Valid when no Limbo CA is trusted (the production default)", { skip: !ready && "run npm run vendor" }, async () => {
	const model = analyze((await verify("test/fixtures/limbo-dev-signed.jpg", [])).manifest);
	assert.equal(model.state, "Valid");
	assert.equal(model.verdict, "valid");
});

test("an image with no manifest yields no credential", { skip: !ready && "run npm run vendor" }, async () => {
	let cred;
	try {
		cred = await verify("test/fixtures/unsigned.png", [mod.DEV_CA()]);
	} catch {
		cred = undefined; // an asset the verifier cannot read counts as having no credential
	}
	assert.equal(cred?.manifest, undefined);
});
