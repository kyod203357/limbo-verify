# Operations

## One time setup (Cloudflare)

1. **Pages project.** In the Limbo Cloudflare account create a Pages project named `limbo-verify` (direct upload, no Git integration). The deploy workflow uploads `dist/` with Wrangler.
2. **Custom domain.** Add `verify.trylimbo.com` to the project. If `trylimbo.com` DNS is on this Cloudflare account it adds the CNAME for you. Otherwise add `CNAME verify -> limbo-verify.pages.dev` where DNS lives.
3. **API token.** Create a token with the permission *Account, Cloudflare Pages, Edit*, scoped to this account only.
4. **GitHub secrets.** In the repo settings add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Put them on two environments: `production` (add required reviewers) and `preview`.
5. **Size limit.** Cloudflare Pages allows 25 MiB per file. The WASM is 14.8 MB. Re-check this whenever the verifier is upgraded.

`site/_headers` sets, for every `/v*/*` file: a one year `immutable` cache, `Access-Control-Allow-Origin: *` (needed for the module and WASM fetches from other origins), and `application/wasm` for the WASM.

## Production CA

The script must trust the Limbo production signing CA for a "Trusted" badge to mean anything.

1. Put the CA certificate in `trust/limbo-prod-ca.pem` as PEM. The file is public by design: it is a trust anchor, not a secret.
2. `npm run build:release` refuses to run while the file is still the placeholder.
3. To rotate: add the new certificate to the same file (a PEM file may hold several) in a new release, keep the old one until images signed with it are no longer in use.

## Releasing

```sh
npm version minor          # bumps package.json and tags vX.Y.Z
git push --follow-tags     # the deploy workflow runs on the tag
```

The workflow checks the tag equals `package.json`, vendors the verifier with `--release` (a canary or prerelease verifier **fails the release**), runs the tests, runs `build:release` (a placeholder CA fails it), then deploys.

After a deploy, read the hash from `https://verify.trylimbo.com/vX.Y.Z/integrity.json` and update the Webflow script (see WEBFLOW.md).

Folders `dist/v*/` are **immutable**. Never edit a published version: ship a new one.

## Rollback

Every released version stays served. To roll back, point the Webflow script URL and its integrity hash at the previous version. Nothing needs redeploying.

## Upgrading the verifier

1. `npm view @limboai/verifox-sdk-verifier-wasm dist-tags` and pick a **stable** version.
2. `npm view @limboai/verifox-sdk-verifier-wasm@<version> dist.integrity`
3. Edit `vendor.lock.json` (`version`, `integrity`), run `npm run vendor && npm test`.
4. Check the WASM stays under 25 MiB, then release.

## Cutover from the prototype

The prototype is served from GitHub Pages (`kyod203357.github.io/limbo-verify`) and the Limbo blog template currently loads it with `data-selector=".w-richtext img"`. Switch it without a gap:

1. Deploy `v1.0.0` to Cloudflare and open `https://verify.trylimbo.com/` to check the demo.
2. Confirm `trust/limbo-prod-ca.pem` is real and the signed images in use verify as Trusted with the default `data-trust=prod`.
3. In Webflow, register the script as a hosted script with the version and integrity hash, then apply it to the blog post template (footer) with `data-selector=".w-richtext img"` in place of the freeform code.
4. Publish to the staging subdomain first, check a post, then publish to production.
5. Once production serves the new script: delete the legacy root files in this repo, then delete the personal GitHub Pages site and repo copy.
6. Delete the `/verifier-test` page and the three test assets from Webflow (the page can only be deleted in the Designer).

## Monitoring

The script records one entry per image in `window.LimboVerify.results` and fires a `limbo:verified` event on each image. For production, add a Cloudflare Web Analytics or a log of 4xx on `verify.trylimbo.com` to notice a broken deploy. There is no telemetry from visitors' browsers by design.
