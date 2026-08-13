const fs = require("fs");
const path = require("path");
const satori = require("satori").default;
const { Resvg } = require("@resvg/resvg-js");
const { highlight } = require("./tokenizer");

// Draws the solution share image without a browser.
//
// Chrome was only ever here as a JavaScript runtime: the page is a React mount
// point, so it had to boot a browser, hydrate, and wait on an XHR before there
// was anything to photograph. The website now serves the same data directly,
// which leaves plain layout - and satori does layout without a browser.

// Rendered at 2x, matching the deviceScaleFactor the Chrome path used.
const SCALE = 2;
const WIDTH = 800 * SCALE;
const PADDING = 32 * SCALE;
const RADIUS = 16 * SCALE;
// These mirror app/css/components/code-pane.css on the website, which is what
// the Chrome path was photographing:
//
//   li        text-15 font-mono leading-huge   (leading-huge = 170%)
//   li .idx   width: 64px, text-center         (the line-number gutter)
//   li .loc   pr-24
//   code      py-8
//
// They were previously eyeballed - 14px text on a 21px line in a 46px
// right-aligned gutter - which is what made the output read as tighter than the
// real thing.
const CODE_FONT_SIZE = 15 * SCALE;
const LINE_HEIGHT = Math.round(15 * 1.7) * SCALE;
const GUTTER_WIDTH = 64 * SCALE;
const CODE_TRAILING_PADDING = 24 * SCALE;
const CODE_PADDING = 16 * SCALE;
const CODE_VERTICAL_PADDING = 8 * SCALE;

// Only used when a payload arrives without one; every track config sets it.
const DEFAULT_INDENT_SIZE = 2;

// Given explicitly rather than left to flexGrow: satori sizes a wrapping line
// from its content, so a long string literal would otherwise set the width and
// run off the edge of the card.
// The gutter and .loc's own pr-24 are the only horizontal insets, matching the
// CSS - the code block itself is padded vertically only.
const CODE_WIDTH = WIDTH - 2 * PADDING - GUTTER_WIDTH - CODE_TRAILING_PADDING;

// The Chrome path clipped the code pane at max-h-[450px]; keep the same shape
// so images don't suddenly get taller.
const MAX_LINES = Math.floor((450 * SCALE) / LINE_HEIGHT);

// The Chrome layout watermarks the code pane with the Exercism mark:
//   image_tag "favicon.png", class: "absolute top-[20px] right-[20px]
//                                    z-[100] opacity-[0.3] h-[80px]"
// (app/views/images/solution.html.haml)
//
// Inlined as a data URI rather than fetched: satori resolves image sources over
// the network at render time, and the whole point of dropping Chrome was to
// stop a remote fetch being able to stall or fail an image. Vendored here
// because the Lambda image can't read the website's asset pipeline.
const WATERMARK_SIZE = 80 * SCALE;
const WATERMARK_INSET = 20 * SCALE;
const WATERMARK_OPACITY = 0.3;

let watermarkCache;
function watermark() {
  watermarkCache ||= `data:image/png;base64,${fs.readFileSync(path.join(__dirname, "assets", "watermark.png")).toString("base64")}`;

  return watermarkCache;
}

// app/css/ui-kit/colors.css, theme-dark
const PURPLE = "rgb(112, 42, 244)";
const CARD_BACKGROUND = "#211D2F";
const BORDER = "#433f56";
// .idx is text-textColor6. The image renders under .theme-dark, where that
// resolves to --c-A9A6BD - not the .theme-light #5c5589, which is a much
// darker, more purple grey and reads as wrong against the dark card.
const GUTTER_COLOUR = "#a9a6bd";
const FOOTER_MUTED = "#a8a3c4";
const FOOTER_STRONG = "#ffffff";

const fontFile = (pkg, file) =>
  fs.readFileSync(path.join(require.resolve(`${pkg}/package.json`), "..", "files", file));

const assetFont = (file) => fs.readFileSync(path.join(__dirname, "assets", "fonts", file));

// satori picks a font file per (family, weight, style) and silently renders
// nothing for a combination that isn't registered - no error, just missing
// glyphs. Every combination the theme can ask for has to be loaded, so both
// weights are registered in both styles: hljs-comment and friends are italic,
// hljs-strong is bold.
//
// Code can be in any language, and fontsource splits Source Code Pro into
// per-script files, so every subset has to be registered or anything outside
// latin renders as tofu - silently, since satori never errors on a missing
// glyph.
//
// How they're named matters, and the obvious spellings both fail:
//
//   - All under one family name: satori uses the first face registered for a
//     given (family, weight, style) and never consults the rest, so latin wins
//     and every other script is tofu.
//   - One family per subset: satori falls back across families, but matches
//     candidates on style too. An italic span finds the italic face of the
//     primary family, and that match stops it looking further - so italic text
//     is tofu even though the glyph exists in a registered fallback.
//
// Naming each (subset, style) separately leaves an italic span with no
// same-family italic competitor, so the fallback resolves. Only the primary
// latin family is referenced by name; satori discovers the rest on its own.
const MONO_SUBSETS = ["cyrillic", "greek", "vietnamese"];
const MONO_FAMILY = "Source Code Pro";

const monoFace = (subset, weight, style, name) => ({
  name,
  weight,
  style,
  data: fontFile("@fontsource/source-code-pro", `source-code-pro-${subset}-${weight}-${style}.woff`)
});

const eachWeightAndStyle = (fn) =>
  [400, 600].flatMap((weight) => ["normal", "italic"].map((style) => fn(weight, style)));

// Source Code Pro has no CJK or emoji glyphs in any subset, so no amount of
// registering fontsource files covers them - they need different faces
// entirely, or Japanese, Chinese, Korean and emoji all render as tofu boxes.
// Silently, again: satori never errors on a missing glyph, and the S3
// write-through means one bad render is cached and served for that URL forever.
//
// These are built by dev/build-fonts.sh and committed under assets/fonts,
// rather than pulled from @fontsource at install time, because:
//
//   - satori cannot read woff2, only woff/ttf/otf. fontsource's woff copies of
//     a whole CJK face are far too big to ship in the Lambda image.
//   - fontsource splits CJK into ~125 numbered subsets per weight, and the
//     common ideographs are spread across most of them. That is too many faces
//     to register, so the script merges them and re-cuts the ranges we need.
//
//   cjk-400.woff     2.6M   kana, CJK punctuation, fullwidth forms and the
//                           CJK Unified Ideographs block. Japanese and
//                           Simplified Chinese share that block, so one face
//                           serves both.
//   hangul-400.woff  904K   Hangul syllables and jamo.
//   emoji-400.woff   455K   Noto Emoji, which is monochrome. Colour emoji fonts
//                           are CBDT/COLR and resvg won't draw them, so emoji
//                           come out as black-and-white glyphs rather than not
//                           at all.
//
// Only one weight and style each. These are fallbacks: a bold or italic CJK
// span gets the regular face rather than nothing, which is the right trade for
// several megabytes an image. They follow the same per-style naming rule as the
// mono subsets above - registering them under one name would let an italic span
// match the primary family and stop the fallback search, tofuing italic CJK.
const FALLBACK_FILES = ["cjk-400.woff", "hangul-400.woff", "emoji-400.woff"];

const fallbackFaces = () =>
  FALLBACK_FILES.flatMap((file) => {
    const data = assetFont(file);

    return ["normal", "italic"].map((style) => ({
      name: `Fallback ${file} ${style}`,
      weight: 400,
      style,
      data
    }));
  });

const monoFaces = () => [
  ...eachWeightAndStyle((weight, style) => monoFace("latin", weight, style, MONO_FAMILY)),
  ...MONO_SUBSETS.flatMap((subset) =>
    eachWeightAndStyle((weight, style) =>
      monoFace(subset, weight, style, `${MONO_FAMILY} ${subset} ${style}`)
    )
  ),
  ...fallbackFaces()
];

let fontCache;
function fonts() {
  fontCache ||= [
    { name: "Poppins", weight: 400, style: "normal", data: fontFile("@fontsource/poppins", "poppins-latin-400-normal.woff") },
    { name: "Poppins", weight: 600, style: "normal", data: fontFile("@fontsource/poppins", "poppins-latin-600-normal.woff") },
    ...monoFaces()
  ];

  return fontCache;
}

// satori takes React-element-shaped objects. Building them by hand keeps this a
// plain Node project - no JSX, so no build step in the Lambda image.
const el = (type, props, ...children) => ({
  type,
  props: { ...props, children: children.length > 1 ? children : children[0] }
});

function codeLine(tokens, number, theme, indentSize) {
  const spans = tokens.map(({ text, scope }) => {
    const style = theme[scope] || {};

    return el("span", {
      style: {
        color: style.colour || theme.default?.colour || FOOTER_STRONG,
        fontStyle: style.italic ? "italic" : "normal",
        fontWeight: style.bold ? 600 : 400,
        // pre-wrap, not pre: indentation has to survive, but a long string
        // literal still needs to break rather than run off the card.
        whiteSpace: "pre-wrap",
        // The track's configured width for a literal tab. The website sets
        // this as `style={{ tabSize: indentSize }}` on the code element
        // (FileViewer.tsx), so tab-indented tracks - Go, Nim, Zig - line up
        // the way their track intends rather than at a default width.
        tabSize: indentSize
      }
    }, text);
  });

  return el("div", { style: { display: "flex", flexDirection: "row", width: "100%" } },
    el("div", {
      style: {
        display: "flex",
        width: GUTTER_WIDTH,
        flexShrink: 0,
        // .idx is text-center, not right-aligned against the code.
        justifyContent: "center",
        color: GUTTER_COLOUR
      }
    }, String(number)),
    el("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        width: CODE_WIDTH,
        paddingRight: CODE_TRAILING_PADDING
      }
    }, ...(spans.length ? spans : [el("span", { style: { whiteSpace: "pre" } }, " ")]))
  );
}

function footer({ handle, avatar_url, exercise_title, track_title }) {
  const text = (content, colour, weight) =>
    el("span", { style: { color: colour, fontWeight: weight, whiteSpace: "pre" } }, content);

  // A missing avatar shouldn't cost us the whole image.
  const avatar = avatar_url
    ? el("img", {
        src: avatar_url,
        width: 32 * SCALE,
        height: 32 * SCALE,
        style: { borderRadius: 32 * SCALE, marginRight: 8 * SCALE }
      })
    : null;

  return el("div", {
    style: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderTop: `1px solid ${BORDER}`,
      padding: 16 * SCALE,
      fontFamily: "Poppins",
      fontSize: 16 * SCALE
    }
  },
    ...(avatar ? [avatar] : []),
    el("div", { style: { display: "flex", flexDirection: "row" } },
      text(`${handle}'s `, FOOTER_STRONG, 600),
      text("solution to ", FOOTER_MUTED, 600),
      text(exercise_title, FOOTER_STRONG, 600),
      text(" on Exercism's ", FOOTER_MUTED, 600),
      text(`${track_title} Track.`, FOOTER_STRONG, 600)
    )
  );
}

function card(data) {
  const file = data.code.files[0];
  if (!file) throw new Error("Solution has no published files to render.");

  const lines = highlight(file.content, data.code.language).slice(0, MAX_LINES);
  const theme = data.highlight_theme || {};
  // Space-indented tracks never hit this; it only matters where the source
  // carries literal tabs.
  const indentSize = data.code.indent_size || DEFAULT_INDENT_SIZE;

  return el("div", {
    style: {
      display: "flex",
      width: "100%",
      height: "100%",
      backgroundColor: PURPLE,
      padding: PADDING
    }
  },
    el("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        backgroundColor: CARD_BACKGROUND,
        borderRadius: RADIUS,
        overflow: "hidden"
      }
    },
      el("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          // The watermark is positioned against this, matching the
          // `flex-grow relative` wrapper it sits in on the Chrome layout.
          position: "relative",
          // .c-iteration-pane is py-16 and the code block inside it py-8; the
          // horizontal inset has no direct equivalent, the gutter provides it.
          paddingTop: CODE_PADDING + CODE_VERTICAL_PADDING,
          paddingBottom: CODE_PADDING + CODE_VERTICAL_PADDING,
          fontFamily: "Source Code Pro",
          fontSize: CODE_FONT_SIZE,
          lineHeight: `${LINE_HEIGHT}px`
        }
      },
        el("img", {
          src: watermark(),
          width: WATERMARK_SIZE,
          height: WATERMARK_SIZE,
          style: {
            position: "absolute",
            top: WATERMARK_INSET,
            right: WATERMARK_INSET,
            opacity: WATERMARK_OPACITY
          }
        }),
        ...lines.map((tokens, idx) => codeLine(tokens, idx + 1, theme, indentSize))
      ),
      footer(data.footer)
    )
  );
}

async function fetchData(dataUrl) {
  const response = await fetch(dataUrl);

  if (!response.ok) {
    throw new Error(`Fetching ${dataUrl} failed with ${response.status}`);
  }

  return response.json();
}

// dataUrl points at the internal ALB, so this never leaves the VPC. Fetching
// from the public site meant going out through Cloudflare and needing the NAT
// address allowlisted to get back in - the coupling that left every image
// timing out for four days when bot mitigation was turned on.
//
// Built in index.js so the rawPath -> URL mapping stays in one place.
async function generate({ dataUrl }) {
  const data = await fetchData(dataUrl);

  const svg = await satori(card(data), { width: WIDTH, fonts: fonts() });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng();

  return { body: png, contentType: "image/png" };
}

// fonts is exported for fonts.test.js, which renders strings through the real
// face list to check nothing tofus.
module.exports = { generate, fonts };
