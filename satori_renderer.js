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
const CODE_FONT_SIZE = 14 * SCALE;
const LINE_HEIGHT = 21 * SCALE;
const GUTTER_WIDTH = 46 * SCALE;
const CODE_PADDING = 16 * SCALE;

// Given explicitly rather than left to flexGrow: satori sizes a wrapping line
// from its content, so a long string literal would otherwise set the width and
// run off the edge of the card.
const CODE_WIDTH = WIDTH - 2 * PADDING - 2 * CODE_PADDING - GUTTER_WIDTH;

// The Chrome path clipped the code pane at max-h-[450px]; keep the same shape
// so images don't suddenly get taller.
const MAX_LINES = Math.floor((450 * SCALE) / LINE_HEIGHT);

// app/css/ui-kit/colors.css, theme-dark
const PURPLE = "rgb(112, 42, 244)";
const CARD_BACKGROUND = "#211D2F";
const BORDER = "#433f56";
const GUTTER_COLOUR = "#6b6785";
const FOOTER_MUTED = "#a8a3c4";
const FOOTER_STRONG = "#ffffff";

const fontFile = (pkg, file) =>
  fs.readFileSync(path.join(require.resolve(`${pkg}/package.json`), "..", "files", file));

let fontCache;
function fonts() {
  fontCache ||= [
    { name: "Poppins", weight: 400, style: "normal", data: fontFile("@fontsource/poppins", "poppins-latin-400-normal.woff") },
    { name: "Poppins", weight: 600, style: "normal", data: fontFile("@fontsource/poppins", "poppins-latin-600-normal.woff") },
    { name: "Source Code Pro", weight: 400, style: "normal", data: fontFile("@fontsource/source-code-pro", "source-code-pro-latin-400-normal.woff") }
  ];

  return fontCache;
}

// satori takes React-element-shaped objects. Building them by hand keeps this a
// plain Node project - no JSX, so no build step in the Lambda image.
const el = (type, props, ...children) => ({
  type,
  props: { ...props, children: children.length > 1 ? children : children[0] }
});

function codeLine(tokens, number, theme) {
  const spans = tokens.map(({ text, scope }) => {
    const style = theme[scope] || {};

    return el("span", {
      style: {
        color: style.colour || theme.default?.colour || FOOTER_STRONG,
        fontStyle: style.italic ? "italic" : "normal",
        fontWeight: style.bold ? 600 : 400,
        // pre-wrap, not pre: indentation has to survive, but a long string
        // literal still needs to break rather than run off the card.
        whiteSpace: "pre-wrap"
      }
    }, text);
  });

  return el("div", { style: { display: "flex", flexDirection: "row", width: "100%" } },
    el("div", {
      style: {
        display: "flex",
        width: GUTTER_WIDTH,
        flexShrink: 0,
        justifyContent: "flex-end",
        paddingRight: 12 * SCALE,
        color: GUTTER_COLOUR
      }
    }, String(number)),
    el("div", {
      style: { display: "flex", flexWrap: "wrap", width: CODE_WIDTH }
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
          padding: CODE_PADDING,
          fontFamily: "Source Code Pro",
          fontSize: CODE_FONT_SIZE,
          lineHeight: `${LINE_HEIGHT}px`
        }
      }, ...lines.map((tokens, idx) => codeLine(tokens, idx + 1, theme))),
      footer(data.footer)
    )
  );
}

async function fetchData(pageUrl) {
  const url = `${pageUrl}/data`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Fetching ${url} failed with ${response.status}`);
  }

  return response.json();
}

// Takes the same page URL the Chrome path would have navigated to, so the
// rawPath -> URL mapping stays in one place.
async function generate({ url }) {
  const data = await fetchData(url);

  const svg = await satori(card(data), { width: WIDTH, fonts: fonts() });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng();

  return { body: png, contentType: "image/png" };
}

module.exports = { generate };
