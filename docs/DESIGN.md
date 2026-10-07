# Design

## Goal

Show visitors where an image came from, on Limbo's own site and on customer sites, without sending the image to a server and without a secret in the page.

## How it works

1. A page loads one script and marks images (`data-limbo-verify`, or a selector).
2. For each image, the script fetches the file bytes and runs the C2PA verifier (WASM) in the browser.
3. If a manifest verifies, a badge appears on the image. Hovering it opens a card: summary, verdict, provenance chain with thumbnails, claims, technical details, raw JSON.
4. Images without credentials are left alone.

```
page ──script──▶ index.js ──▶ engine.js ──▶ verifier (WASM, vendored, integrity pinned)
                    │              ▲
                    │              └── trust anchors: Limbo prod CA (trust/*.pem) + official C2PA list
                    ├──▶ core.js   pure logic: chain, failures, verdict, 20 word summary
                    └──▶ ui.js     badge, hover card, styles (shadow DOM, isolated from the host page)
```

## Decisions

| Decision | Why |
|---|---|
| Verify in the browser | No API key to leak, no per image server cost, works offline of Limbo's services. |
| Shadow DOM for every piece of UI, one portal for cards | Host page CSS cannot leak in, and cards escape `overflow:hidden` and transformed ancestors. |
| Production CA is the default trust anchor | A "Trusted" badge on a live site must not rest on a development certificate. `data-trust=dev` is explicit and warns. |
| Versioned, immutable release folders (`/v1.0.0/`) | A page pins one exact build. Rollback is changing a URL. Cached for a year. |
| Integrity hash on the script tag | A compromised host cannot silently change code that runs on trylimbo.com. |
| Verifier vendored by lockfile, not committed | Reproducible, small repo, and the download is checked against `vendor.lock.json` before use. Prereleases cannot ship in a tagged release. |
| `data-limbo-signed` lazy mode | The verifier is 14.8 MB. Pages that already know an image is signed should not pay for it until someone hovers. |
| Fall back to the original file for Webflow resized copies | Webflow's `-p-500` copies are re-encoded and lose the manifest. The original is byte identical on the CDN. |
| Summary is generated from the manifest | Deterministic, instant, accurate, and no model call. A hook allows an LLM later. |

## Trust model

- **Who can make a badge say "Trusted"**: only someone holding a key chained to the Limbo production CA, or to a CA on the official C2PA trust list.
- **What the badge proves**: the manifest signature matches these bytes. It does not prove the picture is true.
- **No credentials means no badge**, never a green mark for unsigned files.
- **Supply chain**: script and verifier are served from a Limbo controlled origin, pinned by version, and referenced with a SHA-384 integrity hash. CI actions are pinned to commit SHAs. The deploy token lives in a protected GitHub environment.

## Failure modes

| Situation | Behaviour |
|---|---|
| Script host is down | Images render normally, no badge. Nothing breaks. |
| Image is cross origin without CORS | No badge (the bytes cannot be read). Webflow's CDN allows it. |
| Production CA file missing | Console warning, only the official C2PA list applies, Limbo signed images read "verified, signer not on trust list". |
| Verifier throws on a file | Recorded in `LimboVerify.results`, no badge. |
| Lazy mode and the image turns out unsigned | The card says "No Content Credentials were found on this image." |

## Out of scope for this change

- **Signing images** (the production signing pipeline and how files reach Webflow with bytes intact). Tracked separately.
- A dark theme, and localisation.
- Replacing the generated summary with a model written one.

## Open questions

1. **Production CA**: the PEM to ship in `trust/limbo-prod-ca.pem`, and its rotation plan.
2. **Verifier license and version**: `@limboai/verifox-sdk-verifier-wasm` is marked `UNLICENSED` and the pinned build is a canary. We need a stable release and sign off to serve it publicly.
3. **Host name**: this design assumes `verify.trylimbo.com` on Cloudflare Pages.
4. **Webflow Designer uploads**: the prototype was tested with API uploads, which keep original bytes. The Designer uploader and Webflow's "convert to WebP" setting need one test each.
5. **Per release hash in Webflow**: a registered Webflow script needs the new hash on each release. Automate with the Webflow API, or accept a manual step.
