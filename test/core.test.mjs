import assert from "node:assert/strict";
import { test } from "node:test";
import { aiFacts, analyze, defaultSummary, failureMessage, originalsOf, words } from "../src/core.js";

// A minimal manifest store: `chain` lists manifests oldest to newest, each parentOf the previous one.
const store = ({ state = "Trusted", chain, failures = [] }) => {
	const manifests = {};
	chain.forEach((m, i) => {
		const label = `urn:c2pa:${i}:limbo`;
		manifests[label] = {
			title: m.title ?? "image",
			claim_generator_info: [{ name: m.tool ?? "Limbo Integrity", version: "1.0" }],
			signature_info: { issuer: m.issuer ?? "Limbo AI, LLC", time: `2026-10-0${i + 1}T10:00:00Z` },
			assertions: [{ label: "c2pa.actions.v2", data: { actions: (m.actions ?? ["c2pa.created"]).map((a) => (typeof a === "string" ? { action: a } : a)) } }],
			ingredients: i ? [{ relationship: "parentOf", active_manifest: `urn:c2pa:${i - 1}:limbo`, title: "parent" }] : [],
		};
	});
	return { active_manifest: `urn:c2pa:${chain.length - 1}:limbo`, manifests, validation_state: state, validation_results: { activeManifest: { failure: failures } } };
};

const summarize = (s) => {
	const model = analyze(s);
	return defaultSummary(model, aiFacts(model));
};

test("the summary never exceeds 20 words, however much history there is", () => {
	const long = store({
		state: "Invalid",
		chain: Array.from({ length: 9 }, (_, i) => ({ issuer: "A Very Long Organisation Name Incorporated International", tool: "Some Generative Tool", actions: ["c2pa.created", "c2pa.edited", "c2pa.resized", "c2pa.cropped", "c2pa.filtered"].slice(0, 1 + (i % 5)) })),
	});
	for (const s of [long, store({ chain: [{}] }), store({ state: "Valid", chain: [{}, {}, {}] })]) assert.ok(words(summarize(s)) <= 20, summarize(s));
});

test("an untrusted or invalid signer is called out first", () => {
	assert.match(summarize(store({ state: "Valid", chain: [{}] })), /^Signer not on trust list\./);
	assert.match(summarize(store({ state: "Invalid", chain: [{}] })), /^Not fully verified\./);
	assert.doesNotMatch(summarize(store({ chain: [{}] })), /trust list|verified/i);
});

test("AI involvement is detected from the tool or the digital source type", () => {
	const byTool = analyze(store({ chain: [{ tool: "Adobe Firefly" }] }));
	assert.equal(aiFacts(byTool).has, true);
	const bySource = analyze(store({ chain: [{ actions: [{ action: "c2pa.created", digitalSourceType: "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia" }] }] }));
	assert.equal(aiFacts(bySource).has, true);
	assert.match(summarize(store({ chain: [{ tool: "Adobe Firefly" }] })), /AI-generated/);
	assert.equal(aiFacts(analyze(store({ chain: [{}] }))).has, false);
});

test("the chain is walked newest first through parentOf ingredients", () => {
	const m = analyze(store({ chain: [{ title: "v1" }, { title: "v2" }, { title: "v3" }] }));
	assert.deepEqual(m.chain.steps.map((s) => s.title), ["v3", "v2", "v1"]);
	assert.deepEqual(m.chain.steps.map((s) => s.depth), [0, 1, 2]);
	assert.equal(m.chain.unlinked.length, 0);
});

test("a hash mismatch reads as tampered, any other failure as invalid", () => {
	const mismatch = analyze(store({ state: "Invalid", chain: [{}], failures: [{ code: "assertion.dataHash.mismatch" }] }));
	assert.equal(mismatch.verdict, "tampered");
	assert.match(mismatch.failures[0].message, /changed after signing/);
	assert.equal(analyze(store({ state: "Invalid", chain: [{}], failures: [{ code: "claim.missing" }] })).verdict, "invalid");
	assert.equal(analyze(store({ state: "Valid", chain: [{}] })).verdict, "valid");
});

test("trust list codes do not show up as faults", () => {
	assert.equal(failureMessage("signingCredential.untrusted"), "The signer isn't on the verifier's trust list.");
	assert.match(failureMessage("something.unknown"), /couldn't be validated/);
});

test("Webflow resized copies map back to their original files", () => {
	const base = "https://cdn.prod.website-files.com/site/abc_photo";
	assert.deepEqual(originalsOf(`${base}-p-500.jpg`), [`${base}.jpg`, `${base}.jpeg`, `${base}.png`]);
	assert.deepEqual(originalsOf(`${base}-p-1600.png`), [`${base}.png`, `${base}.jpg`, `${base}.jpeg`]);
	assert.deepEqual(originalsOf(`${base}.jpg`), []);
	assert.deepEqual(originalsOf("https://example.com/a-p-b.jpg"), []);
});
