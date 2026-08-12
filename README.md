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

**satori** draws solution images without a browser. The website serves the data
directly at `/images/solutions/:track/:exercise/:handle/data`, which leaves
plain layout, and satori does layout in-process. Roughly 100-300ms instead of
~5.7s, and no headless Chrome.

Set `RENDERER=satori` to enable it. Profiles have no satori renderer yet and
always use Chrome, as does everything if the variable is unset.

### Colours without a stylesheet

highlight.js emits scope classes (`hljs-keyword`) that a stylesheet normally
colours, which is no use to a renderer that can't load stylesheets. The website
extracts the palette from its own theme CSS and includes it in the payload, so
restyling the theme moves the images with it. `tokenizer.js` turns
highlight.js's HTML back into coloured runs of text for satori to lay out.

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
| `NAVIGATION_TIMEOUT_MS` | `6000` | Page navigation timeout (Chrome only) |
| `SELECTOR_TIMEOUT_MS` | `6000` | Timeout waiting for the content selector (Chrome only) |
| `RENDERER` | unset | Set to `satori` to draw solution images without a browser |

The two timeouts must stay comfortably below the Lambda's own timeout (20s).
puppeteer defaults both to 30s, which is *longer*, meaning a hung render burned
the full 20s at 2GB instead of failing fast.

The Lambda's execution role needs `s3:GetObject` and `s3:PutObject` on
`arn:aws:s3:::${IMAGE_BUCKET}/${IMAGE_KEY_PREFIX}/*`.

[tests-badge]: https://github.com/exercism/image-generator/workflows/Test/badge.svg
