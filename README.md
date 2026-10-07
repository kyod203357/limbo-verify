# limbo-verify

A Content Credentials badge for any `<img>`. Hover it to see who signed the image, the full history of edits, and whether the file still verifies. Verification runs in the visitor's browser with a WebAssembly verifier, so there is no API key and no server call.

```html
<script src="https://VERIFY_HOST/v1.0.0/limbo-verify.js"
        integrity="sha384-..." crossorigin="anonymous" defer></script>
<img src="photo.jpg" data-limbo-verify>
```

`npm run build` prints the exact tag, with its integrity hash, for the version you built.

## Options

On the script tag:

| Attribute | Default | Meaning |
|---|---|---|
| `data-trust` | `prod` | `prod` trusts the Limbo production CA (`trust/limbo-prod-ca.pem`) plus the official C2PA list. `dev` trusts the Limbo **development** CA and warns in the console. |
| `data-selector` | `img[data-limbo-verify]` | Which images to badge. On a Webflow blog template, use `.w-richtext img`. |
| `data-base` | the script's folder | Where `vendor/` and `trust/` live. |
| `data-trust-pem` | `<base>trust/limbo-prod-ca.pem` | Override the production CA location. |
| `data-ica-issuers` | none | Comma separated issuer DIDs whose CAWG identity credentials count as validated. |

On an image:

| Attribute | Meaning |
|---|---|
| `data-limbo-verify` | Badge this image. Verified when it scrolls into view. |
| `data-limbo-signed` | The page knows this image is signed. The badge shows at once and the 15 MB verifier only loads on first hover or tap. |
| `data-limbo-src` / `data-limbo-orig` | Verify this URL instead of the displayed one (Webflow refuses attribute names ending in `src` on images, hence the alias). |
| `data-limbo-missing="show"` | Show a small "No credentials" pill when nothing is found. |

Hook: `window.LimboVerify.summarize = async (ctx) => "text"` replaces the built in summary (at most 20 words by default).

## Develop

```sh
npm ci
npm run vendor    # fetch the pinned verifier, check its integrity
npm test          # unit tests plus the real verifier on fixtures
npm run build     # dist/v<version>/
npm run preview   # serve dist/ on http://localhost:8788
```

Layout: `src/core.js` is pure logic (chain, failures, summary), `src/ui.js` is the card and styles, `src/engine.js` loads the verifier, `src/index.js` wires the page. `esbuild` bundles them into one script.

## Docs

- [docs/DESIGN.md](docs/DESIGN.md): why it is built this way, trust model, risks, open questions
- [docs/OPERATIONS.md](docs/OPERATIONS.md): Cloudflare setup, releasing, rollback, the cutover from the prototype
- [docs/WEBFLOW.md](docs/WEBFLOW.md): installing it on a Webflow site, uploading signed images

## Legacy files

`limbo-verify.js`, `vendor/`, `index.html` and `demo-signed.jpg` at the repo root are the **prototype currently served from GitHub Pages**. Production pages still load them. Leave them until the Webflow template has been switched to the Cloudflare URL, then delete them (see OPERATIONS, Cutover).
