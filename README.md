# limbo-verify

Browser-side Content Credentials (C2PA) badge for any `<img>`. Hover the badge for the AI summary, verdict,
provenance chain, claims and technical details. Verification runs in the visitor's browser via WASM:
no API key and no server call.

```html
<script src="https://kyod203357.github.io/limbo-verify/limbo-verify.js" defer></script>
<img src="photo.jpg" data-limbo-verify>
```

Options (`data-*` on the script tag): `data-trust` (`dev` default | `prod`), `data-ica-issuers`, `data-selector`, `data-base`.
Per image: `data-limbo-src` (verify a different URL), `data-limbo-missing="show"`.

`vendor/` contains `@limboai/verifox-sdk-verifier-wasm@0.1.0-canary.80.1.8a9f9dba` as published on npm
(license field: UNLICENSED). Demo: open `index.html`.
