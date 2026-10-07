# Using limbo-verify on Webflow

## Install

Register the script once, then apply it to the pages that need it.

**Preferred: a registered hosted script** (Site settings, or the Webflow API `register_hosted_script`)

- Location: `https://verify.trylimbo.com/v1.0.0/limbo-verify.js`
- Integrity: the `sha384-...` value from `integrity.json` for that version
- Version: the same `1.0.0`
- Attributes: `crossorigin="anonymous"`, `defer`, plus any `data-*` options below

**Alternative: freeform custom code** in a page's footer:

```html
<script src="https://verify.trylimbo.com/v1.0.0/limbo-verify.js"
        integrity="sha384-..." crossorigin="anonymous"
        data-selector=".w-richtext img" defer></script>
```

For the blog, apply it to the **Blog Posts template page** so it covers every post. `.w-richtext img` limits it to images inside article text.

## Marking images

- **Rich text (blog):** use `data-selector=".w-richtext img"` on the script. No attribute per image.
- **Elsewhere:** select the Image element, Element settings, Custom attributes, add `data-limbo-verify`.
- **Known signed images:** also add `data-limbo-signed`. The badge shows at once and the verifier only loads on hover. Use it on any page where most visitors will not hover.

Webflow rejects custom attribute names that end in `src`, so use `data-limbo-orig` (not `data-limbo-src`) if you need to point at another file.

## Uploading signed images

The signature lives in the file's bytes, so anything that re-encodes the file removes it.

- Upload the file exactly as the Limbo signer produced it. Do not resize, compress or export it again.
- Webflow's API upload and original files keep the bytes (tested: byte identical on the CDN, and inside rich text where Webflow copies the file into the CMS item).
- Webflow generates resized copies (`...-p-500.jpg`) for responsive images. Those lose the manifest. The script detects this and verifies the original file instead.
- Not yet tested: the Designer's own uploader, and the site setting that converts images to WebP. Test both before relying on them (checklist below).

## Test checklist for a new page

1. Upload a signed image, add it to the page, publish to the staging subdomain.
2. Open the page. The badge appears on the signed image and not on an unsigned one.
3. Hover: the card shows the verdict you expect (Trusted for Limbo production signed images).
4. Compare the image URL Webflow serves against the original: `md5` of both must match.
5. Console shows no `[limbo-verify]` warnings.
6. Resize the window past a breakpoint and reload, in case Webflow serves a resized copy there.
