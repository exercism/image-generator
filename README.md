# Exercism's Image Generator

![Tests][tests-badge]

Generates the social/OG preview images for solutions and profiles.

A request for e.g. `/tracks/ruby/exercises/bob/solutions/ihid-1720000000.jpg`
arrives via CloudFront at this Lambda's Function URL.

## Renderers

**Chrome** (default) runs headless Chrome against the corresponding page on
exercism.org (`/images/solutions/ruby/bob/ihid`), screenshots the
`#image-content` element, and returns a JPEG.

That page is a React mount point, so Chrome is here purely as a JavaScript
runtime: it has to boot a browser, hydrate, and wait on an XHR before there's
anything to photograph. It costs a few seconds at 2GB per image, and because it
fetches our own public site from a datacentre IP it looks like a bot - which is
how enabling Cloudflare's bot mitigation broke image generation for four days.

**satori** draws both solution and profile images without a browser. The
website serves the data directly over the internal ALB, which leaves plain
layout, and satori does layout in-process. Roughly 100-300ms instead of ~5.7s,
and no headless Chrome.

unset.

Profiles are the harder of the two, because the page they replace isn't just
text in a box:

- The **radar chart** is Chart.js on a `<canvas>`. satori has neither, so it's
  redrawn as inline SVG from the same six numbers — `padReputation()` and the
  12-o'clock start are carried over from `use-chart.ts` so the polygon matches.
- **Header and category icons** — the reputation shield, the flair beside the
  handle, the `{~}` in the founder tag, and the six hexagonal category icons —
  are the website's own SVGs, vendored under `assets/profile-icons` by
  `dev/sync-profile-icons.sh ../website`. The hexagon behind each category
  glyph isn't an icon file upstream but `--backgroundImageHex`, a data URI in
  `app/css/ui-kit/colors.css`; the script extracts the dark-theme one of the
  two. Nothing is fetched at render time — satori resolves image sources over
  the network, and a profile draws a dozen of them, so a live fetch would be a
  dozen more ways for an image to hang.

  The icons are recoloured by rewriting their fills, since there's no CSS
  filter here to do it. Most of them carry `fill="none"` on the `<svg>` element
  and leave their paths to inherit it, so that root fill is re-applied to the
  group that replaces the stripped root — without it the outlines fall back to
  SVG's default black and flood.
- **Badge medallions** are the website's own artwork, lifted out of the base64
  data URIs in `app/css/components/badge.css` and vendored under
  `assets/medallions`. Their rarity glows are CSS filters; satori has no
  filters, but these are SVG handed to resvg, which does support
  `feGaussianBlur`, so the glow survives.
- **Badge icons** are vendored too, under `assets/badge-icons`, along with the
  badge→icon mapping — which is *not* derivable from the badge name
  (`ContributorBadge` uses `contributors`, `RookieBadge` uses `editor`). Run
  `dev/sync-badge-icons.sh ../website` when a badge is added or its icon
  changes.

### Colours without a stylesheet

highlight.js emits scope classes (`hljs-keyword`) that a stylesheet normally
colours, which is no use to a renderer that can't load stylesheets. The website
extracts the palette from its own theme CSS and includes it in the payload, so
restyling the theme moves the images with it. `tokenizer.js` turns
highlight.js's HTML back into coloured runs of text for satori to lay out.

### Fonts

satori fails silently on a missing glyph: no error, no log line, just tofu
boxes in an image that then gets written through to S3 and served for that URL
indefinitely. Two things follow from that.

The first is that the face list has to be complete. Source Code Pro covers
latin, Cyrillic, Greek and Vietnamese, but ships no CJK or emoji glyphs in any
subset, so those need separate faces. They live in `assets/fonts` and are built
by `dev/build-fonts.sh`:

| File | Size | Covers |
| --- | --- | --- |
| `cjk-400.woff` | 2.6M | Kana, CJK punctuation, fullwidth forms, CJK Unified Ideographs — Japanese and Simplified Chinese both |
| `hangul-400.woff` | 904K | Hangul syllables and jamo |
| `emoji-400.woff` | 455K | Monochrome emoji |

They're committed rather than pulled from `@fontsource` at install time, for
two reasons worth knowing before changing any of this:

- **satori cannot read woff2**, only woff/ttf/otf. woff2 is the small format;
  fontsource's `.woff` copies of a full CJK face are far too big to ship.
- **fontsource splits CJK into ~125 numbered subsets per weight**, and the
  common ideographs are spread across most of them — that's too many faces to
  register. The script merges them back into one face and re-cuts the ranges we
  need.

Emoji come out monochrome. Colour emoji fonts use CBDT/COLR tables that resvg
won't draw, so the choice is black-and-white glyphs or none.

The second is that this needs testing, and the obvious test doesn't work. "Did
it draw anything?" passes on tofu, because a box is geometry too. `fonts.test.js`
counts *distinct* glyph shapes instead: tofu is one box repeated, so a string of
five different characters collapses to a handful of shapes however long it gets.
`dev/fixtures/solution-mixed-scripts.json` is the same ground in a form you can
look at:

```bash
node dev/render.js --fixture dev/fixtures/solution-mixed-scripts.json
```

## Caching

Generated images are written through to S3, so any given URL is only ever
rendered once. This matters because rendering costs a few seconds of headless
Chrome at 2GB, while serving a stored copy costs an S3 GET — around 300x less.

CDN edge caches alone don't give us that guarantee: they're per-PoP, they evict
the long tail (most images are fetched only a handful of times ever), and a
flood of requests for *distinct* URLs misses them entirely. Writing through to
S3 makes cost a function of how many images exist rather than how many times
they're requested.

URLs ending in `-${timestamp}.jpg` address a version that will never change, so
their stored copy is used indefinitely. Legacy URLs without a timestamp address
mutable content, so a stored copy is only reused for 24 hours — matching the
`Cache-Control` we hand back to the CDN.

If S3 is unreachable or the Lambda lacks permission, both reads and writes fail
soft and the image is generated as normal.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `IMAGE_BUCKET` | `exercism-v3-assets` | Bucket holding generated images |
| `IMAGE_KEY_PREFIX` | `generated-images` | Key prefix within that bucket |

The two timeouts must stay comfortably below the Lambda's own timeout (20s).
puppeteer defaults both to 30s, which is *longer*, meaning a hung render burned
the full 20s at 2GB instead of failing fast.

The Lambda's execution role needs `s3:GetObject` and `s3:PutObject` on
`arn:aws:s3:::${IMAGE_BUCKET}/${IMAGE_KEY_PREFIX}/*`.

[tests-badge]: https://github.com/exercism/image-generator/workflows/Test/badge.svg
