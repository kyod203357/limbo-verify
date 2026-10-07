// Pure domain logic: no DOM, no browser globals. Unit tested in test/core.test.mjs.

export const EMPTY = "—";
export const truncateMiddle = (s, n) => (s && s.length > n * 2 + 1 ? `${s.slice(0, n)}…${s.slice(-n)}` : s);
export const fmtDate = (s) =>
	new Date(s).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export const fmtBytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
export const fmtHash = (v) => (typeof v === "string" ? v : Array.isArray(v) || v instanceof Uint8Array ? [...v].map((b) => b.toString(16).padStart(2, "0")).join("") : null);
export const list = (a) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);

// ---------- domain: failures, actions, verdict ----------
export const FRIENDLY = {
	"cawg.ica.signature_mismatch": "The identity credential's signature couldn't be verified.",
	"cawg.ica.validation_failed": "The verified-identity assertion didn't validate.",
	"assertion.dataHash.mismatch": "The signed bytes don't match the manifest, the asset changed after signing.",
	"assertion.hashedURI.mismatch": "A referenced asset doesn't match its hash.",
	"assertion.hashedURI.missing": "A referenced asset is missing from the file.",
	"signingCredential.untrusted": "The signer isn't on the verifier's trust list.",
	"signingCredential.expired": "The signing certificate has expired.",
	"signingCredential.revoked": "The signing certificate was revoked.",
	"timeStamp.mismatch": "The trusted timestamp couldn't be verified.",
};
export const failureMessage = (code) => FRIENDLY[code] ?? "This part of the credential couldn't be validated.";
export const toFailure = (s) => ({ code: s.code, message: failureMessage(s.code) });
export const legacyFailures = (st) => (st || []).filter((s) => s.success === false);
export const failuresIn = (results, legacy) =>
	results
		? [...(results.activeManifest?.failure || []), ...(results.ingredientDeltas || []).flatMap((d) => d.validationDeltas?.failure || [])]
		: legacyFailures(legacy);
export const TAMPER = /hash.*mismatch|dataHash|timeStamp\.mismatch/i;
export const statusFromFailures = (failures, signed) => (!signed ? "unsigned" : !failures.length ? "valid" : failures.some((f) => TAMPER.test(f.code)) ? "tampered" : "invalid");

export const ACTION_LABEL = {
	"c2pa.created": "Created", "c2pa.opened": "Opened", "c2pa.placed": "Placed", "c2pa.published": "Published", "c2pa.edited": "Edited",
	"c2pa.cropped": "Cropped", "c2pa.adjustedColor": "Color adjusted", "c2pa.color_adjustments": "Color adjusted", "c2pa.resized": "Resized",
	"c2pa.transcoded": "Transcoded", "c2pa.repackaged": "Repackaged",
};
export const actionLabel = (raw) => {
	if (ACTION_LABEL[raw]) return ACTION_LABEL[raw];
	const tail = raw.replace(/^c2pa\./, "").replace(/^cawg\./, "");
	return tail.charAt(0).toUpperCase() + tail.slice(1).replace(/_/g, " ");
};
export const actionEntries = (m) => {
	for (const label of ["c2pa.actions.v2", "c2pa.actions"]) {
		const a = (m.assertions || []).find((x) => x.label === label)?.data;
		if (a && Array.isArray(a.actions)) return a.actions.filter((x) => x && typeof x.action === "string");
	}
	return [];
};
export const agentName = (a) => (!a ? undefined : typeof a === "string" ? a : a.name ? (a.version ? `${a.name}/${a.version}` : a.name) : undefined);

export const VERDICT = {
	trusted: { tone: "ok", label: "Credentials trusted", lede: "The signature matches these bytes and the signer is on the verifier's trust list." },
	valid: { tone: "ok", label: "Credentials verified", lede: "The signature matches these bytes. The signer isn't on the verifier's trust list. Confirm who they are before relying on it." },
	tampered: { tone: "danger", label: "Doesn't verify", lede: "The signature doesn't match the delivered bytes. This asset changed after it was signed." },
	invalid: { tone: "danger", label: "Verification found problems", lede: "The Content Credentials on this asset didn't fully verify:" },
};
export const STATUS = {
	trusted: { label: "Trusted", tone: "solid" },
	valid: { label: "Verified", tone: "solid" },
	tampered: { label: "Tampered", tone: "danger" },
	invalid: { label: "Invalid", tone: "danger" },
	unsigned: { label: "Not signed yet", tone: "muted" },
};
export const RELATIONSHIP = { parentOf: "Parent", componentOf: "Component", inputTo: "Input" };

// ---------- domain: the provenance chain (port of ProvenanceChain) ----------
export function toIngredient(ing, label, index, store) {
	const own = ing.active_manifest ?? null;
	const failures = failuresIn(ing.validation_results, ing.validation_status).map(toFailure);
	return {
		key: `${label}::${index}`,
		title: ing.title ?? ing.format ?? "Untitled input",
		format: ing.format ?? null,
		relationship: ing.relationship ?? "inputTo",
		thumbnail: ing.thumbnail ?? null,
		documentId: ing.document_id ?? null,
		instanceId: ing.instance_id ?? null,
		description: ing.description ?? null,
		informationalUri: ing.informational_URI ?? null,
		hash: fmtHash(ing.hash),
		dataTypes: (ing.data_types || []).map((t) => t.type),
		manifestLabel: own,
		resolved: own !== null && own in store,
		status: statusFromFailures(failures, own !== null),
		failures,
	};
}
export function toStep(label, m, store, depth, failures, status) {
	const all = (m.ingredients || []).map((ing, i) => toIngredient(ing, label, i, store));
	const spine = all.find((i) => i.relationship === "parentOf" && i.resolved);
	const acts = actionEntries(m);
	return {
		key: label,
		title: m.title ?? label,
		format: m.format ?? null,
		generator: agentName(m.claim_generator_info?.[0]) ?? (typeof m.claim_generator === "string" ? m.claim_generator : null),
		signer: m.signature_info ?? null,
		thumbnail: m.thumbnail ?? null,
		actions: acts.map((a) => actionLabel(a.action)),
		actionEntries: acts,
		ingredients: all.filter((i) => i !== spine),
		status,
		failures,
		depth,
		parentKey: spine?.manifestLabel ?? null,
	};
}
export function walkStore(store, headStatus) {
	const ms = store?.manifests;
	const active = store?.active_manifest ?? null;
	if (!ms || !active || !ms[active]) return { steps: [], unlinked: [] };
	let failures = [...(store.validation_results?.activeManifest?.failure || []), ...legacyFailures(store.validation_status)].map(toFailure);
	const steps = [];
	const seen = new Set();
	let label = active, depth = 0, status = headStatus;
	while (label && !seen.has(label) && depth < 32) {
		const m = ms[label];
		if (!m) break;
		seen.add(label);
		const step = toStep(label, m, ms, depth, failures, status);
		steps.push(step);
		const next = step.parentKey;
		if (!next) break;
		const via = (m.ingredients || []).find((i) => i.active_manifest === next);
		failures = via ? failuresIn(via.validation_results, via.validation_status).map(toFailure) : [];
		status = statusFromFailures(failures, true);
		label = next;
		depth += 1;
	}
	const unlinked = Object.entries(ms).filter(([k]) => !seen.has(k)).map(([k, m]) => toStep(k, m, ms, 0, [], "valid"));
	return { steps, unlinked };
}


// ---------- the AI summary (hook-able) ----------
export const AI_SOURCE = /trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia|algorithmicMedia/i;
export const AI_TOOL = /generative|firefly|dall-?e|midjourney|stable ?diffusion|imagen|gemini|openai|gpt|sora|runway|veo/i;
export function aiFacts(model) {
	const tools = new Set();
	let has = false;
	for (const step of [...model.chain.steps, ...model.chain.unlinked]) {
		const gen = step.generator?.replace(/\/.*$/, "");
		if (gen) tools.add(gen);
		if (gen && AI_TOOL.test(gen)) has = true;
		for (const a of step.actionEntries) {
			const sa = agentName(a.softwareAgent)?.replace(/\/.*$/, "");
			if (sa) tools.add(sa);
			if (sa && AI_TOOL.test(sa)) has = true;
			const dst = a.digitalSourceType ?? a.parameters?.digitalSourceType;
			if (typeof dst === "string" && AI_SOURCE.test(dst)) has = true;
		}
	}
	return { has, tools: [...tools] };
}
// At most 20 words: say what happened and where it came from, nothing the verdict card already says.
export const MAX_WORDS = 20;
export const words = (t) => t.trim().split(/\s+/).filter(Boolean).length;
export function defaultSummary(model, ai) {
	const sig = model.signer;
	const who = sig?.issuer || sig?.common_name || "an unknown signer";
	const day = sig?.time ? new Date(sig.time).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
	const steps = model.chain.steps;
	const verbs = [...new Set([...steps].reverse().flatMap((s) => s.actions.map((a) => a.toLowerCase())))].filter((v) => v !== "opened");
	const warn = model.verdict === "trusted" ? "" : model.verdict === "valid" ? "Signer not on trust list." : "Not fully verified.";
	const by = `Signed by ${who}${day ? ` on ${day}` : ""}.`;
	const byShort = `Signed by ${who}.`;
	const history = steps.length > 1 ? `${steps.length} versions${verbs.length ? `: ${verbs.slice(0, 3).join(", ")}` : ""}.` : verbs.length ? `${verbs[0].charAt(0).toUpperCase()}${verbs[0].slice(1)}.` : "";
	const aiNote = ai.has ? "Includes AI-generated content." : "";
	// least important parts are dropped first until it fits
	for (const parts of [
		[warn, by, history, aiNote],
		[warn, by, history.replace(/:.*$/, "."), aiNote],
		[warn, by, aiNote],
		[warn, byShort, aiNote],
	]) {
		const text = parts.filter(Boolean).join(" ");
		if (words(text) <= MAX_WORDS) return text;
	}
	return `${warn || byShort}`.split(/\s+/).slice(0, MAX_WORDS).join(" ");
}

export const originalsOf = (u) => {
	const m = u.match(/^(.*)-p-\d+(\.\w+)$/i);
	return m ? [...new Set([m[1] + m[2], m[1] + ".jpg", m[1] + ".jpeg", m[1] + ".png"])].filter((x) => x !== u) : [];
};

// Everything the card needs from a verified manifest store, minus browser objects (thumbnail blobs, download URLs).
export function analyze(store) {
	const state = store.validation_state;
	const headFailures = [...(store.validation_results?.activeManifest?.failure || []), ...legacyFailures(store.validation_status)].map(toFailure);
	const tampered = headFailures.some((f) => TAMPER.test(f.code));
	const verdict = tampered ? "tampered" : state === "Trusted" ? "trusted" : state === "Valid" ? "valid" : "invalid";
	const head = store.manifests[store.active_manifest];
	return {
		store,
		state,
		verdict,
		chain: walkStore(store, verdict),
		head,
		signer: head?.signature_info ?? null,
		failures: failuresIn(store.validation_results, store.validation_status).map(toFailure),
	};
}
