# Shared chrome POC

One header and one footer, authored in Universal Editor (UE), rendered by both the UE site and the Document Authoring (DA) site. Blocks and chrome code live in this repository. The two sites, when you register them, differ only by content source.

With `CHROME_ORIGIN` unset, header and footer load from the current host at `/fragments/header` and `/fragments/footer`. That is the same-origin fallback, and it is what you want once a CDN routes those paths to the UE origin.

## How it works

`scripts/scripts.js` still calls `loadHeader()` and `loadFooter()`. Those build empty `header` and `footer` blocks. The blocks do not contain authored chrome.

`blocks/header/header.js` and `blocks/footer/footer.js` call `getChromeFragmentUrl()` in `scripts/chrome.js`, then `loadFragment()` in `blocks/fragment/fragment.js`. `loadFragment()` fetches `{url}.plain.html`, rewrites fragment media onto the fragment host, and runs the normal section and block decoration.

The header expects three top-level sections, in this order:

| Section | Class added | What to author |
| --- | --- | --- |
| 1 | `nav-brand` | Brand link. A bold or italic link becomes the brand button. |
| 2 | `nav-sections` | A nested list. Items that contain a sub-list become dropdowns. |
| 3 | `nav-tools` | Tools such as the search icon (`:search:`). |

Fewer sections are safe: missing ones are skipped. The footer has no column contract. Every section in the footer fragment is rendered.

Published `.plain.html` for the header looks like the boilerplate nav, for example:

```html
<div>
  <p><a href="/"><strong>Brand</strong></a></p>
</div>
<div>
  <ul>
    <li>Products
      <ul>
        <li><a href="/products">All products</a></li>
      </ul>
    </li>
    <li><a href="/about">About</a></li>
  </ul>
</div>
<div>
  <p><span class="icon icon-search"></span></p>
</div>
```

Author root-relative page links (`/about`). They stay on the public domain. Do not point them at the raw `aem.live` host.

After decoration the header block exposes:

- `data-chrome-source` — path or absolute URL that was requested
- `data-chrome-status` — `loaded` or `missing`

The footer block uses the same attributes.

### Where the URL comes from

For each of header and footer, the first match wins:

1. On `localhost` or `127.0.0.1` only, `?chrome-origin=` replaces the origin used for root-relative paths. This is a local test hook. It is ignored on preview and live hosts so a query string cannot point production at another site.
2. `<meta name="chrome-origin" content="https://…">` (metadata sheet row `chrome-origin`).
3. `CHROME_ORIGIN.preview` when the page host ends with `.aem.page` or `.hlx.page`.
4. `CHROME_ORIGIN.live` when the page host ends with `.aem.live` or `.hlx.live`.
5. Empty means same-origin.

The path is `/fragments/header` or `/fragments/footer` unless page metadata overrides it:

| Metadata name | Overrides | Default |
| --- | --- | --- |
| `nav` | header path or absolute URL | `/fragments/header` |
| `footer` | footer path or absolute URL | `/fragments/footer` |

Absolute URLs are accepted only for `https` hosts ending in `.aem.page`, `.aem.live`, `.hlx.page`, or `.hlx.live`, and for `http(s)://localhost` or `127.0.0.1`. Other origins are ignored and the default path is used.

`nav` used to default to `/nav`, and `footer` to `/footer`. Those defaults are now the `/fragments/…` paths. Set the `nav` or `footer` metadata if a site still publishes chrome at the old paths.

### Media and Universal Editor attributes

`./media_…` image and source URLs are resolved against the fragment URL, including when the fragment is on another host. Cross-origin chrome also rewrites relative and root-relative `src`, `srcset`, and `poster` values onto that host. Anchor `href`s are not rewritten.

Header and footer move existing nodes into the nav and footer. `data-aue-*` and `data-richtext-*` on those nodes stay put. `moveInstrumentation()` in `scripts/scripts.js` is for the other case: decoration that throws away an element and builds a new one. The cards block does that, moving instrumentation from each row onto the new `li` and from the original image onto the optimized image. Use the same helper if a later chrome change replaces an element instead of moving it.

`scripts/aem.js` is vendored. Instrumentation lives in `scripts/scripts.js` so that file stays untouched.

## Register the two sites

This repo is the canonical code site:

- GitHub: `dharmeshrupani/eds-chrome-poc`
- Preview: `https://main--eds-chrome-poc--dharmeshrupani.aem.page/`
- Live: `https://main--eds-chrome-poc--dharmeshrupani.aem.live/`

AEM Code Sync on this repository is what publishes the code. Extra sites should be repoless: same `code.owner` and `code.repo`, different content source. Pushing to `main` updates code for every site that points here. Content publish stays per site.

Suggested site names:

| Site | Role | Content |
| --- | --- | --- |
| `eds-chrome-poc` | Canonical code site. Already registered. | Leave as-is, or use it as one of the two content mounts. |
| `eds-chrome-poc-ue` | UE / AEM authoring. Owns chrome. | AEM as a Cloud Service, Universal Editor. |
| `eds-chrome-poc-da` | Document Authoring pages. | `https://content.da.live/dharmeshrupani/eds-chrome-poc-da/` |

Create the DA site with the [repoless](https://www.aem.live/docs/repoless) Admin API call (replace the token):

```sh
curl -X PUT https://admin.hlx.page/config/dharmeshrupani/sites/eds-chrome-poc-da.json \
  -H 'x-auth-token: {token}' \
  -H 'content-type: application/json' \
  --data '{
  "code": {
    "owner": "dharmeshrupani",
    "repo": "eds-chrome-poc"
  },
  "content": {
    "source": {
      "url": "https://content.da.live/dharmeshrupani/eds-chrome-poc-da/",
      "type": "markup"
    }
  }
}'
```

The site is then served at:

- `https://main--eds-chrome-poc-da--dharmeshrupani.aem.page/`
- `https://main--eds-chrome-poc-da--dharmeshrupani.aem.live/`

Create the UE site from the AEM configuration template in the [Universal Editor authoring guide](https://www.aem.live/docs/aem-authoring). Point that site's code repository at `dharmeshrupani/eds-chrome-poc` (same shape as the `code` object above). Set the AEM path mapping so the public paths are `/fragments/header` and `/fragments/footer`. A typical language root mapping publishes `/content/<aem-site>/us/en/fragments/header` as `/fragments/header`. Confirm with the curl in [Verify](#verify); the JCR prefix is whatever the path mapping says, not a second copy of the chrome in DA.

Local preview of a repoless site:

```sh
npx -y @adobe/aem-cli up --url https://main--eds-chrome-poc-da--dharmeshrupani.aem.page
```

## Author the fragments in Universal Editor

Do this on the UE site only. Do not create a DA document at `/fragments/header` or `/fragments/footer`.

1. In AEM Sites, create and publish two pages that the path mapping exposes as `/fragments/header` and `/fragments/footer`.
2. Open the header page in Universal Editor. Add three sections:
   - Section 1: a title or text block with one bold link (the brand).
   - Section 2: a text block whose content is a list. Nested lists become the dropdowns.
   - Section 3: a text block with the search icon, written as `:search:`.
3. Open the footer page and add the sections you want (link lists, legal line). Any number of sections is fine.
4. Publish both pages from Universal Editor.
5. Confirm the delivery HTML:

```sh
curl -sS "https://main--eds-chrome-poc-ue--dharmeshrupani.aem.page/fragments/header.plain.html"
curl -sS "https://main--eds-chrome-poc-ue--dharmeshrupani.aem.live/fragments/footer.plain.html"
```

You should see one `<div>` per section and no full document wrapper. Authors edit the fragment page's main content. The site header on that same URL is the decorated copy loaded by this code, not a second source.

### Component definitions in this repo

UE reads these from the site root:

- `component-definition.json`
- `component-models.json`
- `component-filters.json`
- `xwalk.json`

They are the default Universal Editor models from [aem-boilerplate-xwalk](https://github.com/adobe-rnd/aem-boilerplate-xwalk) for the blocks this repo already has: text, title, image, button, section, hero, cards, columns, and fragment. Text is what you use for the nav list. There is no separate header component; chrome is a page, not a block dropped into every page.

This POC does not vendor `scripts/editor-support.js` or DOMPurify. Publishing still writes `.plain.html`. Live property edits inside Universal Editor that patch the DOM without a reload need the editor-support scripts from that boilerplate. See [Creating blocks for Universal Editor](https://www.aem.live/developer/universal-editor-blocks).

## Point the DA site at the UE origin

Use either approach. When more than one is set, the first match in [Where the URL comes from](#where-the-url-comes-from) wins.

### Code constant (preview and live together)

In `scripts/chrome.js`:

```js
export const CHROME_ORIGIN = {
  preview: 'https://main--eds-chrome-poc-ue--dharmeshrupani.aem.page',
  live: 'https://main--eds-chrome-poc-ue--dharmeshrupani.aem.live',
};
```

No trailing slash and no path. A DA page on `.aem.page` then requests `https://main--eds-chrome-poc-ue--dharmeshrupani.aem.page/fragments/header.plain.html`. A page on `.aem.live` uses the live host. The UE site, when it is one of those hosts, requests its own origin.

`CHROME_ORIGIN` is chosen from the page hostname. A custom public domain does not end in `.aem.page` or `.aem.live`, so both constants stay unused and the browser requests same-origin `/fragments/…` paths. That is the CDN setup below. Localhost ignores the constants too.

Leave both strings empty to keep the same-origin fallback on the EDS hosts as well.

To pin a single fragment to a full URL, set `CHROME_FRAGMENTS.header` or `.footer` to an absolute `aem.page` / `aem.live` URL, or set the `nav` / `footer` metadata to that URL.

### DA metadata (no code fork)

On the DA metadata sheet add a `chrome-origin` row. For a preview check, set it to `https://main--eds-chrome-poc-ue--dharmeshrupani.aem.page`, preview the sheet, reload a DA preview page, and confirm `data-chrome-source`. For live, publish the value `https://main--eds-chrome-poc-ue--dharmeshrupani.aem.live`. Preview content and published content can hold different values, which is how one cell covers both tiers. Do not also set `nav` or `footer` unless the paths are not the defaults.

The UE site's metadata should omit `chrome-origin` so UE pages keep loading their own `/fragments/header` and `/fragments/footer`.

## CDN: one public domain

Production traffic should use one hostname. The customer CDN routes by path. Send chrome to the UE origin and everything else to the DA origin. With that routing in place, leave `CHROME_ORIGIN` empty so the browser requests same-origin `/fragments/header.plain.html` and `/fragments/footer.plain.html`. The CDN, not the page, chooses the origin.

Reserve these paths for the UE origin, including query strings:

- `/fragments/header`
- `/fragments/header.html`
- `/fragments/header.plain.html`
- `/fragments/footer`
- `/fragments/footer.html`
- `/fragments/footer.plain.html`
- `/fragments/media_*` (images referenced from those pages)

Code (`/scripts/*`, `/blocks/*`, `/styles/*`) is identical on both origins. Either origin can serve it. Do not let the DA content source publish documents at the reserved paths; those responses would win whenever a request hits the DA origin directly.

## CORS on split hosts

`aem.page` and `aem.live` do not send `Access-Control-Allow-Origin` on `.plain.html` by default. A page on the DA host cannot read a fetch of the UE host until the UE site adds a response header. Same-origin CDN routing does not need this.

On the UE site, set a header for the fragment paths only ([custom headers](https://www.aem.live/docs/custom-headers)). One header value is one origin. Use the DA origin you are testing, not `*`:

```json
{
  "/fragments/**": [
    {
      "key": "access-control-allow-origin",
      "value": "https://main--eds-chrome-poc-da--dharmeshrupani.aem.live"
    }
  ]
}
```

Apply it with the config service `headers.json` for `dharmeshrupani` / `eds-chrome-poc-ue`, or the headers editor on [tools.aem.live](https://tools.aem.live). Repeat for the preview DA origin if preview is also cross-host. A wildcard `*` is unsafe on preview and live because Sidekick cookies can be read cross-site; the header docs call that out.

Images in a cross-origin fragment are absolute URLs on the UE host. `<img>` does not need CORS. CSS masks and canvas reads of those assets still do.

## Verify

1. Publish the UE fragments and curl both `.plain.html` URLs. You want `200` and the section markup above, not an HTML document shell.
2. Set `CHROME_ORIGIN` or the DA `chrome-origin` metadata.
3. If you are still on two hosts, add the CORS header, then open a DA page.
4. In the DOM, `header .header` has `data-chrome-status="loaded"` and `data-chrome-source` starting with the UE origin. The footer block matches.
5. The network log shows `GET` `{UE origin}/fragments/header.plain.html` and `…/fragments/footer.plain.html`.
6. Change a nav label in Universal Editor, publish, and reload the DA page. The label updates and the DA source has no header document.
7. Clear `CHROME_ORIGIN` and remove the metadata. Reload. `data-chrome-source` is `/fragments/header` (same origin). A missing document sets `data-chrome-status="missing"` and does not throw.
8. On localhost, `npx -y @adobe/aem-cli up` follows step 7. To try a remote or fixture origin without editing the constant, open `http://localhost:3000/?chrome-origin=https://main--eds-chrome-poc-ue--dharmeshrupani.aem.page`.

Branch preview for this change:

`https://cursor-shared-chrome-poc-b11d--eds-chrome-poc--dharmeshrupani.aem.page/`
