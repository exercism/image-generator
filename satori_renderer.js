const fs = require("fs");
const path = require("path");
const satori = require("satori").default;
const { Resvg } = require("@resvg/resvg-js");
const { highlight } = require("./tokenizer");

// Draws the solution share image without a browser. Chrome was only ever here
// as a JavaScript runtime, to boot and hydrate a React page before there was
// anything to photograph; the website now serves the same data directly.

// Rendered at 2x, matching the deviceScaleFactor the Chrome path used.
const SCALE = 2;
const WIDTH = 800 * SCALE;
const PADDING = 32 * SCALE;
const RADIUS = 16 * SCALE;
// These mirror app/css/components/code-pane.css, which is what the Chrome path
// was photographing.
const CODE_FONT_SIZE = 15 * SCALE;
const LINE_HEIGHT = Math.round(15 * 1.7) * SCALE;
const GUTTER_WIDTH = 64 * SCALE;
const CODE_TRAILING_PADDING = 24 * SCALE;
const CODE_PADDING = 16 * SCALE;
const CODE_VERTICAL_PADDING = 8 * SCALE;

// Only used when a payload arrives without one; every track config sets it.
const DEFAULT_INDENT_SIZE = 2;

// Explicit rather than flexGrow: satori sizes a wrapping line from its content,
// so a long string literal would otherwise set the width and run off the card.
const CODE_WIDTH = WIDTH - 2 * PADDING - GUTTER_WIDTH - CODE_TRAILING_PADDING;

// The Chrome path clipped the code pane at max-h-[450px]; keep the same shape
// so images don't suddenly get taller.
const MAX_LINES = Math.floor((450 * SCALE) / LINE_HEIGHT);

// Inlined as a data URI rather than fetched: satori resolves image sources over
// the network, and dropping Chrome was about stopping a remote fetch stalling
// an image.
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
// .idx is text-textColor6 as .theme-dark resolves it; the light-theme value
// reads as wrong against the dark card.
const GUTTER_COLOUR = "#a9a6bd";
const FOOTER_MUTED = "#a8a3c4";
const FOOTER_STRONG = "#ffffff";

const fontFile = (pkg, file) =>
  fs.readFileSync(path.join(require.resolve(`${pkg}/package.json`), "..", "files", file));

const assetFont = (file) => fs.readFileSync(path.join(__dirname, "assets", "fonts", file));

// satori renders an unregistered (family, weight, style) as tofu without
// erroring, so every combination a theme can ask for is registered across every
// fontsource subset. The naming is load-bearing, and both obvious spellings
// fail: under one family name satori keeps the first face registered and latin
// wins, while one family per subset lets an italic span match the primary
// family's italic face and stop the fallback search. Naming each (subset,
// style) separately leaves no same-family competitor, so the fallback resolves.
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

// Source Code Pro ships no CJK or emoji glyphs in any subset, so these cover
// them. They're built by dev/build-fonts.sh and committed rather than pulled
// from @fontsource, which only has them as woff2 (satori can't read it) split
// across ~125 subsets per weight (too many faces to register). Emoji are
// monochrome Noto: resvg won't draw the CBDT/COLR colour fonts. One weight and
// style each - a bold or italic CJK span gets the regular face rather than
// nothing - under the same per-style naming rule as the mono subsets above.
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

// satori takes React-element-shaped objects. Built by hand to keep this a plain
// Node project - no JSX, so no build step in the Lambda image.
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
        // What FileViewer.tsx sets, so tab-indented tracks line up as intended.
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

function footer({ handle, avatar_data, avatar_url, exercise_title, track_title }) {
  const text = (content, colour, weight) =>
    el("span", { style: { color: colour, fontWeight: weight, whiteSpace: "pre" } }, content);

  // Prefer the inlined avatar. avatar_url points at assets.exercism.org, which
  // is Cloudflare-fronted, so fetching it takes us out through the NAT gateway
  // and back into our own account for a file Rails could hand us directly. The
  // SPI sends both; avatar_url stays as the fallback for users whose avatar
  // isn't an attachment we can inline (an external GitHub URL, usually).
  //
  // A missing avatar shouldn't cost us the whole image.
  const avatarSrc = avatar_data || avatar_url;
  const avatar = avatarSrc
    ? el("img", {
        src: avatarSrc,
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
          // The watermark is positioned against this.
          position: "relative",
          // .c-iteration-pane's py-16 plus the code block's own py-8.
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

// dataUrl points at the internal ALB, so this never leaves the VPC. It's built
// in index.js, so the rawPath -> URL mapping stays in one place.
async function generate({ dataUrl }) {
  const data = await fetchData(dataUrl);

  const svg = await satori(card(data), { width: WIDTH, fonts: fonts() });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng();

  return { body: png, contentType: "image/png" };
}

// fonts is exported for fonts.test.js, which checks nothing tofus.
module.exports = { generate, fonts };
