import PIN_PATHS from "../assets/cr-pin.txt";
import LIMBO_LOGO from "../assets/limbo-logo.png";
import { EMPTY, RELATIONSHIP, STATUS, VERDICT, aiFacts, defaultSummary, failureMessage, fmtBytes, fmtDate, truncateMiddle } from "./core.js";

const HIDE_DELAY = 300;
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

// The Content Credentials pin. `currentColor` carries the tone.
const pin = (size, extra = "") =>
	`<svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Content Credentials" ${extra}>${PIN_PATHS}</svg>`;
const ICONS = {
	sparkles: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.94 14.34 8.5 18l-1.44-3.66L3.4 12.9l3.66-1.44L8.5 7.8l1.44 3.66 3.66 1.44z"/><path d="M18 3v4M20 5h-4M19 15v4M21 17h-4"/></svg>`,
	chevron: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`,
	check: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
	shield: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4M12 16h.01"/></svg>`,
	image: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/></svg>`,
	link: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8"/></svg>`,
	copy: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-5A1.5 1.5 0 0 0 3 3.5v5A1.5 1.5 0 0 0 4.5 10H6"/></svg>`,
	braces: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/></svg>`,
	download: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>`,
	tick: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5L6.5 12L13 4.5"/></svg>`,
};

// ---------- tiny DOM helpers (manifest strings never go through innerHTML) ----------
const h = (tag, attrs, ...kids) => {
	const el = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs || {})) {
		if (v == null || v === false) continue;
		if (k === "class") el.className = v;
		else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
		else el.setAttribute(k, v === true ? "" : v);
	}
	for (const kid of kids.flat()) {
		if (kid == null || kid === false) continue;
		el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
	}
	return el;
};
const svg = (markup) => {
	// static, trusted constants only
	const t = document.createElement("template");
	t.innerHTML = markup;
	return t.content.firstElementChild;
};

const summaryText = (model, ai) => {
	const custom = window.LimboVerify?.summarize;
	const ctx = { verdict: model.verdict, state: model.state, signer: model.signer, steps: model.chain.steps, ai, manifest: model.store };
	return custom ? Promise.resolve(custom(ctx)).catch(() => defaultSummary(model, ai)) : Promise.resolve(defaultSummary(model, ai));
};

// ---------- styles (shadow roots keep Webflow CSS out and ours in) ----------
const INK = "#000933", SOFT = "#545a73", MUTE = "#8a8fa1", RULE = "#e3e6ee", BRAND = "#000080";
const OK = "#047857", DANGER = "#b91c1c", WARN = "#b45309";
const CSS = `
:host{all:initial}*{box-sizing:border-box}button{font-family:inherit}
.badge{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:center;cursor:pointer;color:${INK};font-size:1.5rem;line-height:0;border-radius:6px}
.badge svg{transition:transform .15s;filter:drop-shadow(0 1px 2px rgb(0 0 0/.35))}.badge:hover svg{transform:scale(1.05)}
.badge:focus-visible{outline:2px solid ${BRAND};outline-offset:2px}
.pill{font:600 11px Inter,system-ui,sans-serif;background:rgba(17,24,39,.8);color:#fff;border-radius:9999px;padding:4px 10px}

.panel{display:flex;flex-direction:column;width:440px;max-width:calc(100vw - 20px);max-height:calc(100vh - 120px);margin:10px;overflow:hidden;
 background:#fff;color:${INK};border:1px solid ${RULE};border-radius:16px;line-height:normal;
 font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:14px;box-shadow:0 20px 40px -12px rgb(0 9 51/.25),0 4px 10px -4px rgb(0 9 51/.12)}
.hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid ${RULE};flex:0 0 auto}
.hdr .t{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500}.hdr svg{display:block}
.x{all:unset;cursor:pointer;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;font-size:13px;color:${MUTE}}
.x:hover{background:rgba(227,230,238,.6);color:${INK}}.x:focus-visible{outline:2px solid ${BRAND}}
.scroll{flex:1 1 auto;overflow-y:auto;min-height:0;scrollbar-width:thin;scrollbar-color:${RULE} transparent}
.scroll>section{padding:20px;border-top:1px solid ${RULE}}.scroll>section:first-child{border-top:0}
h2{margin:0;font-size:16px;font-weight:600;color:${INK}}
p{margin:0}.soft{color:${SOFT}}.mute{color:${MUTE}}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}

.ai{background:linear-gradient(135deg,rgba(0,0,128,.05),rgba(0,0,128,.02) 55%,transparent)}
.ai .top{all:unset;box-sizing:border-box;width:100%;display:flex;align-items:center;justify-content:space-between;cursor:pointer}
.ai .ttl{display:flex;align-items:center;gap:8px;color:${BRAND};font-size:14px;font-weight:600}
.ai .ttl i{font-style:italic;font-weight:400;font-size:12px;color:rgba(0,0,128,.6)}
.ai .sp{display:flex;color:${BRAND}}.ai .sp.busy{animation:pulse 1.2s ease-in-out infinite}
.ai .chev{display:flex;color:${MUTE};transition:transform .2s}.ai.open .chev{transform:rotate(90deg)}
.ai .body{margin-top:10px;font-size:14px;line-height:1.55;color:${INK}}.ai:not(.open) .body,.ai:not(.open) .tools{display:none}
.tools{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:12px}
.tools .lb{font-size:11px;color:${MUTE};margin-right:2px}
.chip{font-size:11px;font-weight:500;border-radius:9999px;padding:2px 9px;background:#fff;border:1px solid ${RULE};color:${SOFT}}
.chip.ai-y{background:#fffbeb;border-color:#fde68a;color:#92400e}.chip.ai-n{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}
@keyframes pulse{50%{opacity:.4}}

.hero{display:flex;gap:12px;align-items:flex-start}.hero>svg{flex:0 0 auto;margin-top:2px}
.hero.ok>svg{color:${OK}}.hero.danger>svg{color:${DANGER}}
.hero .row1{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:12px}.hero.danger h2{color:${DANGER}}
.hero .when{font-size:12px;color:${MUTE}}.hero .lede{font-size:14px;margin-top:6px;color:${SOFT}}
.hero .by{font-size:14px;margin-top:6px}.hero .by b{font-weight:500}
.hero ul{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
.hero li{display:flex;gap:8px}.hero li .d{width:6px;height:6px;border-radius:50%;background:${DANGER};margin-top:7px;flex:0 0 auto}
.hero li code{display:block;font:10px ui-monospace,Menlo,monospace;color:${MUTE};word-break:break-word}

.blk{display:flex;flex-direction:column;gap:16px}.blk .hd{display:flex;flex-direction:column;gap:4px}.blk .hd p{font-size:14px;color:${SOFT}}
ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.step{position:relative;display:flex;gap:12px;padding-bottom:24px}.step:last-child{padding-bottom:0}
.step .spine{position:absolute;left:21px;top:48px;bottom:4px;width:1px;background:${RULE}}
.frame{position:relative;flex:0 0 auto;display:flex;align-items:center;justify-content:center;color:${MUTE}}
.frame .img{width:100%;height:100%;border-radius:inherit;overflow:hidden;background:rgba(0,9,51,.05);box-shadow:inset 0 0 0 1px ${RULE};display:flex;align-items:center;justify-content:center}
.frame img{width:100%;height:100%;object-fit:cover;display:block}
.frame .pinm{position:absolute;right:-6px;top:-6px;display:flex;line-height:0;color:${INK};filter:drop-shadow(0 1px 1px rgb(0 0 0/.25))}
.frame .pinm.danger{color:${DANGER}}.frame .pinm.muted{color:${MUTE}}
.step .frame{width:44px;height:44px;border-radius:12px}.ing .frame{width:32px;height:32px;border-radius:6px}
.step .main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
.step .r1{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.step .ti{font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.step .key{font:10px ui-monospace,Menlo,monospace;color:${MUTE};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.eyebrow{flex:0 0 auto;padding-top:4px;font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:${MUTE}}
.stat{display:flex;flex-wrap:wrap;align-items:center;gap:2px 6px;font-size:10px}
.stat .s{font-weight:500}.s.solid{color:${OK}}.s.danger{color:${DANGER}}.s.muted{color:${MUTE}}
.stat .g{font-family:ui-monospace,Menlo,monospace;color:${MUTE};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.step .acts{font-size:12px;color:${SOFT}}.step .fail{font-size:12px;color:${DANGER};margin:0;padding:0;list-style:none}
.step .signed{font:10px ui-monospace,Menlo,monospace;color:${MUTE}}
.ings{list-style:none;margin:4px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}
.ing{border:1px solid ${RULE};border-radius:8px;background:#fff}
.ing summary{display:flex;align-items:center;gap:10px;padding:8px 10px;cursor:pointer;list-style:none}.ing summary::-webkit-details-marker{display:none}
.ing summary .ch{display:flex;color:${MUTE};transition:transform .15s}.ing[open] summary .ch{transform:rotate(90deg)}
.ing .tx{display:flex;flex-direction:column;min-width:0;flex:1}.ing .tx b{font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ing .tx span{font-size:10px;color:${MUTE};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ing .det{display:flex;flex-direction:column;gap:8px;border-top:1px solid ${RULE};padding:8px 10px}
.ing dl{margin:0;display:flex;flex-direction:column;gap:6px}.ing dt{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:${MUTE}}
.ing dd{margin:0;font:10px ui-monospace,Menlo,monospace;color:${SOFT};word-break:break-all}
.ing .desc{font-size:12px;color:${SOFT};line-height:1.35}.ing a{font-size:10px;color:${BRAND};text-decoration:none;word-break:break-all}
.unl{border-top:1px solid ${RULE};padding-top:16px;display:flex;flex-direction:column;gap:8px}
.unl h3{margin:0;font-size:10px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:${MUTE}}
.unl li{font:10px ui-monospace,Menlo,monospace;color:${SOFT};list-style:none}.unl ul{margin:0;padding:0;display:flex;flex-direction:column;gap:4px}

dl.grid{margin:0;display:grid;grid-template-columns:1fr 1fr;gap:12px 24px}
.f{display:flex;flex-direction:column;gap:2px;min-width:0}.f.span{grid-column:span 2}
.f dt{font-size:12px;color:${MUTE}}.f dd{margin:0;font-size:14px;color:${INK};overflow-wrap:anywhere}.f dd.mono{font:12px ui-monospace,SFMono-Regular,Menlo,monospace}
.f ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:2px}.f li .m{color:${MUTE}}
.f a{color:${BRAND};text-decoration:none}.f a:hover{text-decoration:underline}
.codes{display:flex;flex-direction:column;gap:16px;border-top:1px solid ${RULE};padding-top:16px}
.codes .ct{display:flex;gap:8px;align-items:center;font-size:12px;font-weight:600}.codes .ct span.n{font:10px ui-monospace,Menlo,monospace;color:${MUTE};font-weight:400}
.codes ul{margin:8px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}.codes li{display:flex;gap:8px;align-items:flex-start}
.codes .d{width:6px;height:6px;border-radius:50%;flex:0 0 auto;margin-top:7px}.codes .pm{font-size:14px}.codes .sc{font:10px ui-monospace,Menlo,monospace;color:${MUTE};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.btn{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;font-weight:500;color:${INK};border:1px solid ${RULE};border-radius:8px;padding:6px 12px;background:#fff}
.btn:hover{background:rgba(227,230,238,.4)}.btn:focus-visible{outline:2px solid ${BRAND}}
.notice{padding:28px 20px;font-size:14px;color:${SOFT}}
.btns{display:flex;flex-wrap:wrap;gap:8px}
a.btn{text-decoration:none}
.json{margin-top:12px;border:1px solid ${RULE};border-radius:10px;overflow:hidden}.json[hidden]{display:none}
.json .jh{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid ${RULE};font-size:12px;font-weight:500}
.mini{all:unset;display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;font-weight:400;color:${SOFT};border:1px solid ${RULE};border-radius:6px;padding:2px 10px}
.mini:hover{border-color:${BRAND};color:${BRAND}}
.json pre{margin:0;padding:12px;max-height:260px;overflow:auto;font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:${SOFT};background:#fafbfd;white-space:pre}
.ftr{padding:14px 20px;display:flex;align-items:center;justify-content:center;gap:6px;flex:0 0 auto;border-top:1px solid ${RULE};background:linear-gradient(to right,transparent,rgba(0,0,128,.06))}
.ftr span{font-size:10px;font-style:italic;color:rgba(0,9,51,.5)}.ftr img{width:28px;height:28px;display:block}
`;

// ---------- UI pieces ----------
const mark = (status, size) => {
	const tone = STATUS[status]?.tone ?? "solid";
	return h("span", { class: `pinm ${tone === "danger" ? "danger" : tone === "muted" ? "muted" : ""}`, title: STATUS[status]?.label }, svg(pin(size)));
};
const thumbFrame = (model, ref, status, markSize) => {
	const src = ref?.identifier ? model.thumbs.get(ref.identifier) || (/^(data:|blob:|https?:)/.test(ref.identifier) ? ref.identifier : null) : null;
	return h("div", { class: "frame" }, h("div", { class: "img" }, src ? h("img", { src, alt: "" }) : svg(ICONS.image)), mark(status, markSize));
};

function aiSection(model) {
	const ai = aiFacts(model);
	const body = h("p", { class: "body" });
	const sparkle = h("span", { class: "sp busy" }, svg(ICONS.sparkles));
	const status = h("i", {}, " Analyzing…");
	const root = h(
		"section",
		{ class: "ai open" },
		h(
			"button",
			{ class: "top", type: "button", "aria-expanded": "true", onclick: (e) => e.currentTarget.setAttribute("aria-expanded", String(root.classList.toggle("open"))) },
			h("span", { class: "ttl" }, sparkle, "AI Summary", status),
			h("span", { class: "chev" }, svg(ICONS.chevron)),
		),
		body,
		h(
			"div",
			{ class: "tools" },
			h("span", { class: "chip " + (ai.has ? "ai-y" : "ai-n") }, ai.has ? "AI-modified" : "No AI edits recorded"),
			ai.tools.length ? h("span", { class: "lb" }, "Tools used:") : null,
			ai.tools.map((t) => h("span", { class: "chip" }, t)),
		),
	);
	summaryText(model, ai).then((text) => {
		sparkle.classList.remove("busy");
		status.textContent = "";
		if (model.typed || REDUCED) return void (body.textContent = text);
		model.typed = true;
		let i = 0;
		const iv = setInterval(() => {
			body.textContent = text.slice(0, ++i);
			if (i >= text.length || !body.isConnected) (clearInterval(iv), (body.textContent = text));
		}, 8);
	});
	return root;
}

function heroSection(model) {
	const v = VERDICT[model.verdict] ?? VERDICT.invalid;
	const sig = model.signer;
	return h(
		"section",
		{},
		h(
			"div",
			{ class: `hero ${v.tone}` },
			svg(v.tone === "ok" ? ICONS.check : ICONS.shield),
			h(
				"div",
				{},
				h("div", { class: "row1" }, h("h2", {}, v.label), sig?.time ? h("span", { class: "when mono" }, fmtDate(sig.time)) : null),
				h("p", { class: "lede" }, v.lede),
				v.tone === "ok" && (sig?.common_name || sig?.issuer)
					? h("p", { class: "by" }, "Signed by ", h("b", {}, sig.common_name || sig.issuer), sig.common_name && sig.issuer ? h("span", { class: "mute" }, ` · ${sig.issuer}`) : null)
					: null,
				v.tone === "danger" && model.failures.length
					? h("ul", {}, model.failures.map((f) => h("li", {}, h("span", { class: "d" }), h("div", {}, h("p", {}, f.message), h("code", {}, f.code)))))
					: null,
			),
		),
	);
}

function ingredientRow(model, ing) {
	const st = STATUS[ing.status] ?? STATUS.valid;
	const details = [
		ing.format && ["Format", ing.format],
		ing.documentId && ["Document ID", ing.documentId],
		ing.instanceId && ["Instance ID", ing.instanceId],
		ing.hash && ["Hash", ing.hash],
		ing.manifestLabel && ["Manifest", ing.manifestLabel],
		ing.dataTypes.length && ["Data types", ing.dataTypes.join(", ")],
	].filter(Boolean);
	return h(
		"li",
		{ class: "ing" },
		h(
			"details",
			{},
			h(
				"summary",
				{},
				h("span", { class: "ch" }, svg(ICONS.chevron)),
				thumbFrame(model, ing.thumbnail, ing.status, 15),
				h("span", { class: "tx" }, h("b", {}, ing.title), h("span", {}, `${RELATIONSHIP[ing.relationship] ?? ing.relationship} · ${st.label}`)),
				ing.resolved ? h("span", { class: "mute", style: "display:flex" }, svg(ICONS.link)) : null,
			),
			h(
				"div",
				{ class: "det" },
				ing.description ? h("p", { class: "desc" }, ing.description) : null,
				details.length
					? h("dl", {}, details.map(([k, v]) => h("div", {}, h("dt", {}, k), h("dd", {}, v || EMPTY))))
					: h("p", { class: "mute", style: "font-size:10px" }, "The signer recorded no identifiers for this input."),
				ing.failures.length ? h("ul", { style: `font-size:10px;color:${DANGER};list-style:none;margin:0;padding:0` }, ing.failures.map((f) => h("li", {}, f.message))) : null,
				ing.informationalUri && /^https?:/i.test(ing.informationalUri) ? h("a", { href: ing.informationalUri, target: "_blank", rel: "noreferrer" }, ing.informationalUri) : null,
			),
		),
	);
}

function chainSection(model) {
	const { steps, unlinked } = model.chain;
	if (!steps.length) return h("section", {}, h("div", { class: "blk" }, h("div", { class: "hd" }, h("h2", {}, "Provenance chain"), h("p", {}, "No chain to draw. This asset carries no readable manifest."))));
	const inputs = steps.reduce((n, s) => n + s.ingredients.length, 0);
	return h(
		"section",
		{},
		h(
			"div",
			{ class: "blk" },
			h(
				"div",
				{ class: "hd" },
				h("h2", {}, "Provenance chain"),
				h("p", {}, `${steps.length} ${steps.length === 1 ? "version" : "versions"}${inputs ? `, ${inputs} ${inputs === 1 ? "input" : "inputs"}` : ""} recorded in this manifest store.`),
			),
			h(
				"ol",
				{},
				steps.map((s, i) => {
					const st = STATUS[s.status] ?? STATUS.valid;
					// the displayed image is the best thumbnail for the head when the store carries none
					const frame = thumbFrame(model, s.thumbnail, s.status, 15);
					if (i === 0 && !frame.querySelector("img") && model.selfSrc) frame.querySelector(".img").replaceChildren(h("img", { src: model.selfSrc, alt: "" }));
					return h(
						"li",
						{ class: "step" },
						i < steps.length - 1 ? h("span", { class: "spine", "aria-hidden": "true" }) : null,
						frame,
						h(
							"div",
							{ class: "main" },
							h(
								"div",
								{ class: "r1" },
								h("div", { style: "display:flex;flex-direction:column;min-width:0" }, h("p", { class: "ti" }, s.title), h("p", { class: "key", title: s.key }, truncateMiddle(s.key, 16))),
								h("span", { class: "eyebrow" }, s.depth === 0 ? "active manifest" : "parentOf"),
							),
							h(
								"p",
								{ class: "stat" },
								h("span", { class: `s ${st.tone}` }, st.label),
								s.signer?.common_name ? [h("span", { class: "mute" }, "·"), h("span", { class: "soft" }, s.signer.common_name)] : null,
								s.generator ? [h("span", { class: "mute" }, "·"), h("span", { class: "g" }, s.generator)] : null,
							),
							s.actions.length ? h("p", { class: "acts" }, s.actions.join(" · ")) : null,
							s.failures.length ? h("ul", { class: "fail" }, s.failures.map((f) => h("li", {}, f.message))) : null,
							s.signer?.time ? h("p", { class: "signed" }, `Signed ${s.signer.time}`) : null,
							s.ingredients.length ? h("ul", { class: "ings" }, s.ingredients.map((ing) => ingredientRow(model, ing))) : null,
						),
					);
				}),
			),
			unlinked.length ? h("div", { class: "unl" }, h("h3", {}, "Not on the chain"), h("ul", {}, unlinked.map((s) => h("li", { title: s.key }, truncateMiddle(s.key, 18))))) : null,
		),
	);
}

function claimsSection(model) {
	const asserts = model.head?.assertions || [];
	const idv = asserts.find((a) => a.label === "cawg.identity")?.data;
	const ids = idv?.verifiedIdentities ?? idv?.identities ?? idv?.credentialSubject?.verifiedIdentities ?? [];
	const tm = asserts.find((a) => a.label === "cawg.training-mining")?.data?.entries;
	const entries = tm && typeof tm === "object" ? Object.entries(tm).map(([k, e]) => ({ label: k.replace(/^cawg\.ai_/, "AI ").replace(/^cawg\./, "").replace(/_/g, " "), use: e?.use })) : [];
	const prohibits = entries.filter((e) => e.use === "notAllowed").map((e) => e.label);
	const allows = entries.filter((e) => e.use === "allowed").map((e) => e.label);
	const acts = model.chain.steps[0]?.actions ?? [];
	const fields = [
		ids.length && ["Identities", h("ul", {}, ids.map((id) => {
			const main = id.name ?? id.username ?? id.provider?.name ?? EMPTY;
			const link = id.uri && /^https?:/i.test(id.uri) ? h("a", { href: id.uri, target: "_blank", rel: "noopener noreferrer" }, main) : h("span", { style: "font-weight:500" }, main);
			return h("li", {}, link, id.provider?.name && id.provider.name !== main ? h("span", { class: "m" }, ` · ${id.provider.name}`) : null);
		}))],
		(prohibits.length || allows.length) && ["AI use", h("div", { style: "display:flex;flex-direction:column;gap:2px" },
			prohibits.length ? h("span", {}, h("span", { class: "mute" }, "Prohibits "), prohibits.join(", ")) : null,
			allows.length ? h("span", {}, h("span", { class: "mute" }, "Allows "), allows.join(", ")) : null)],
		acts.length && ["Actions", acts.join(" · ")],
	].filter(Boolean);
	return h(
		"section",
		{},
		h("div", { class: "blk" }, h("h2", {}, "What it claims"),
			fields.length
				? h("dl", { class: "grid" }, fields.map(([k, v]) => h("div", { class: "f" }, h("dt", {}, k), h("dd", {}, v))))
				: h("p", { class: "mute" }, "No identity or content claims on this manifest.")),
	);
}

function codesList(title, codes, danger) {
	if (!codes.length) return null;
	return h(
		"div",
		{},
		h("div", { class: "ct", style: `color:${danger ? DANGER : WARN}` }, h("span", {}, title), h("span", { class: "n" }, String(codes.length))),
		h("ul", {}, codes.map((c) =>
			h("li", {},
				h("span", { class: "d", style: `background:${danger ? DANGER : WARN}` }),
				h("div", { style: "min-width:0" },
					h("p", { class: "pm" }, danger ? c.message ?? failureMessage(c.code) : c.explanation ?? c.code),
					h("p", { class: "sc", title: c.url || "" }, danger && c.explanation ? `${c.code} · ${c.explanation}` : c.code))))),
	);
}

function techSection(model) {
	const sig = model.signer;
	const row = (label, val, o = {}) => h("div", { class: `f${o.span ? " span" : ""}` }, h("dt", {}, label), h("dd", { class: o.mono ? "mono" : "" }, val ?? EMPTY));
	const failures = codesList("Failures", model.failures, true);
	return h(
		"section",
		{},
		h(
			"div",
			{ class: "blk" },
			h("h2", {}, "Technical details"),
			h("dl", { class: "grid" },
				row("Validation state", model.state),
				row("Trust list", model.state === "Trusted" ? "Anchored" : "Not anchored"),
				row("Signature alg", sig?.alg, { mono: true }),
				row("Format", model.head?.format ?? model.mime, { mono: true }),
				row("Size", fmtBytes(model.size), { mono: true }),
				row("Cert serial", sig?.cert_serial_number, { mono: true }),
				row("Active manifest", model.store.active_manifest, { mono: true, span: true })),
			failures ? h("div", { class: "codes" }, failures) : null,
		),
	);
}

function actionsSection(model) {
	const json = JSON.stringify(model.store, (_, v) => (typeof v === "bigint" ? String(v) : v), 2);
	const pre = h("pre", {}, json);
	const copy = h("button", { class: "mini", type: "button" }, svg(ICONS.copy), "Copy");
	copy.addEventListener("click", () => {
		navigator.clipboard?.writeText(json).then(
			() => {
				copy.replaceChildren(svg(ICONS.tick), "Copied");
				setTimeout(() => copy.replaceChildren(svg(ICONS.copy), "Copy"), 1500);
			},
			() => {},
		);
	});
	const panel = h("div", { class: "json", hidden: true }, h("div", { class: "jh" }, h("span", {}, "Manifest JSON"), copy), pre);
	const view = h("button", { class: "btn", type: "button", "aria-expanded": "false" }, svg(ICONS.braces), "View JSON");
	view.addEventListener("click", () => {
		panel.hidden = !panel.hidden;
		view.setAttribute("aria-expanded", String(!panel.hidden));
		if (!panel.hidden) panel.scrollIntoView({ block: "nearest", behavior: REDUCED ? "auto" : "smooth" });
	});
	const dl = h("a", { class: "btn", href: model.assetUrl, download: model.filename }, svg(ICONS.download), "Download asset");
	return h("section", {}, h("div", { class: "btns" }, view, dl), panel);
}

function buildNotice(text, onClose) {
	return h(
		"div",
		{ class: "panel", role: "tooltip" },
		h("div", { class: "hdr" }, h("div", { class: "t" }, "Content Credentials"), h("button", { class: "x", type: "button", "aria-label": "Close", onclick: onClose }, "✕")),
		h("div", { class: "notice" }, text),
		h("div", { class: "ftr" }, h("span", {}, "powered by"), h("img", { src: LIMBO_LOGO, alt: "Limbo" })),
	);
}

function buildPanel(model, onClose) {
	return h(
		"div",
		{ class: "panel", role: "tooltip" },
		h("div", { class: "hdr" }, h("div", { class: "t" }, "Content Credentials"), h("button", { class: "x", type: "button", "aria-label": "Close", onclick: onClose }, "✕")),
		h("div", { class: "scroll" }, aiSection(model), heroSection(model), chainSection(model), claimsSection(model), techSection(model), actionsSection(model)),
		h("div", { class: "ftr" }, h("span", {}, "powered by"), h("img", { src: LIMBO_LOGO, alt: "Limbo" })),
	);
}


// ---------- one global portal for the cards (escapes overflow:hidden / transforms) ----------
let portal;
function getPortal() {
	if (portal) return portal;
	const host = h("div", { id: "limbo-verify-root", style: "all:initial;position:absolute;top:0;left:0;z-index:2147483000" });
	const root = host.attachShadow({ mode: "open" });
	root.append(h("style", {}, CSS));
	document.body.append(host);
	return (portal = root);
}

// ---------- hover card ----------
// `source` is a ready model, or an async function that produces one (resolving null when the image carries no credentials).
// The function form lets a page mark images as signed ahead of time so the 15 MB engine only loads when someone hovers.
function makeHoverCard(source, anchorEl) {
	let model = typeof source === "function" ? undefined : source;
	let pending = null;
	let failed = false;
	const root = getPortal();
	let hideTimer = null;
	const wrap = h("div", { style: "position:absolute;visibility:hidden;z-index:1" });
	const isOpen = () => wrap.style.visibility === "visible";
	const place = () => {
		const r = anchorEl.getBoundingClientRect();
		const cw = wrap.offsetWidth || 460;
		const ch = wrap.offsetHeight || 400;
		let left = r.right + scrollX - cw + 10; // the panel keeps a 10px margin
		left = Math.max(scrollX, Math.min(left, scrollX + innerWidth - cw));
		let top = r.bottom + scrollY + 4;
		if (r.bottom + 4 + ch > innerHeight && r.top - 4 - ch > 0) top = r.top + scrollY - 4 - ch;
		top = Math.max(scrollY, Math.min(top, scrollY + innerHeight - ch)); // always keep the whole card (footer included) on screen
		wrap.style.left = `${left}px`;
		wrap.style.top = `${top}px`;
	};
	const hide = () => {
		clearTimeout(hideTimer);
		hideTimer = setTimeout(() => (wrap.style.visibility = "hidden"), HIDE_DELAY);
	};
	const render = () =>
		wrap.replaceChildren(
			model
				? buildPanel(model, hide)
				: buildNotice(model === null ? "No Content Credentials were found on this image." : failed ? "Couldn't verify this image right now." : "Verifying Content Credentials…", hide),
		);
	const show = () => {
		clearTimeout(hideTimer);
		if (isOpen()) return;
		render();
		wrap.style.visibility = "visible";
		place();
		if (model === undefined && !pending) {
			pending = source()
				.then((m) => ((model = m ?? null), (failed = false)), () => (failed = true))
				.then(() => {
					pending = null;
					if (isOpen()) (render(), place());
				});
		}
	};
	root.append(wrap);
	wrap.addEventListener("mouseenter", () => clearTimeout(hideTimer));
	wrap.addEventListener("mouseleave", hide);
	addEventListener("scroll", () => isOpen() && place(), { passive: true });
	addEventListener("resize", () => isOpen() && place());
	return { show, hide, toggle: () => (isOpen() ? ((wrap.style.visibility = "hidden"), clearTimeout(hideTimer)) : show()) };
}

// ---------- badge + wiring ----------
function wrapImage(img) {
	const wrap = h("span", { "data-limbo-wrap": "" });
	const disp = getComputedStyle(img).display;
	const fluid = /%$/.test(img.style.width || "") || getComputedStyle(img.parentElement).display.includes("flex");
	wrap.style.cssText = `position:relative;display:${disp === "block" || fluid ? "block" : "inline-block"};max-width:100%;line-height:0;vertical-align:top`;
	img.replaceWith(wrap);
	wrap.append(img);
	return wrap;
}

export function mountBadge(img, source) {
	const wrap = wrapImage(img);
	const host = h("span", { style: "all:initial;position:absolute;top:8px;right:8px;z-index:2" });
	const root = host.attachShadow({ mode: "open" });
	const btn = h("button", { class: "badge", type: "button", "aria-label": "View content credentials" }, svg(pin(24)));
	root.append(h("style", {}, CSS), btn);
	wrap.append(host);
	const card = makeHoverCard(source, btn);
	btn.addEventListener("mouseenter", card.show);
	btn.addEventListener("mouseleave", card.hide);
	btn.addEventListener("focus", card.show);
	btn.addEventListener("blur", card.hide);
	btn.addEventListener("click", card.toggle); // touch devices have no hover
}

export function mountMissing(img) {
	const wrap = wrapImage(img);
	const host = h("span", { style: "all:initial;position:absolute;top:8px;right:8px" });
	host.attachShadow({ mode: "open" }).append(h("style", {}, CSS), h("span", { class: "pill" }, "No credentials"));
	wrap.append(host);
}