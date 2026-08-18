const fs = require("fs");
const path = require("path");
const satori = require("satori").default;
const { Resvg } = require("@resvg/resvg-js");
const { fonts } = require("./satori_renderer");

// Draws the profile share image without a browser, the same way
// satori_renderer.js draws solutions. The Chart.js radar chart the page uses is
// redrawn as inline SVG below, since satori has no canvas.

const SCALE = 2;
const WIDTH = 800 * SCALE;

// app/css/ui-kit/colors.css, theme-dark
const BACKGROUND = "#211D2F";
const HEADER_BACKGROUND = "#302b42";
const BORDER = "#433f56";
const TEXT_STRONG = "#ffffff";
const TEXT_MUTED = "#f0f3f9";
const TEXT_DIM = "#a9a6bd";
const TEXT_NAME = "#cbc9d9";

// The .border-gradient the reputation pill and the founder tag share.
const GRADIENT_FROM = "#2200ff";
const GRADIENT_TO = "#9e00ff";
const PILL_BACKGROUND = "#130b43";
const TAG_BACKGROUND = "#191525";
// --chartBorderColor under theme-dark. The light-theme value disappears
// against the dark card.
const CHART_BORDER = "#6a6781";
// The gradient Chart.js builds in createBluePurpleGradient(), bottom to top.
const CHART_FROM = "rgb(34, 0, 255)";
const CHART_TO = "rgb(158, 0, 255)";

const HEADER_PADDING = 32 * SCALE;
const AVATAR_SIZE = 80 * SCALE;
// The medallion SVG pads its 64-unit artwork out to 88 to give the glow room,
// so the <img> is scaled by that ratio to leave the hexagon itself at 40px.
const MEDALLION_ARTWORK = 64;
const MEDALLION_CANVAS = 88;
const BADGE_SIZE = 40 * SCALE * (MEDALLION_CANVAS / MEDALLION_ARTWORK);
// .ml-8 is measured between the hexagons, and the glow padding above already
// contributes more than that, so the shortfall goes back as a negative margin.
const BADGE_GAP = 8 * SCALE - (BADGE_SIZE - 40 * SCALE);

// The order ContributionsSummary.tsx lists them in. The chart's axes follow it,
// so reordering here silently rotates the polygon.
const CATEGORIES = ["publishing", "mentoring", "authoring", "building", "maintaining", "other"];

const CATEGORY_TITLES = {
  publishing: "Publishing",
  mentoring: "Mentoring",
  authoring: "Authoring",
  building: "Building",
  maintaining: "Maintaining",
  other: "Other"
};

let watermarkCache;
function watermark() {
  watermarkCache ||= `data:image/png;base64,${fs.readFileSync(path.join(__dirname, "assets", "watermark.png")).toString("base64")}`;

  return watermarkCache;
}

const el = (type, props, ...children) => ({
  type,
  props: { ...props, children: children.length > 1 ? children : children[0] }
});

// ---------------------------------------------------------------------------
// The radar chart
//
// Two details are carried over from use-chart.ts rather than invented, because
// without them the shape comes out wrong: padReputation() adds total/8 to every
// value so an empty category still gets a short arm, and Chart.js puts the
// first axis at 12 o'clock, -90 degrees from where atan2 would start.
// ---------------------------------------------------------------------------

// The SVG's own coordinate space. The radius stops short of the half-width so
// the outermost ring and its vertex dots aren't clipped.
const CHART_SIZE = 520;
const CHART_RADIUS = 232;
const CHART_RINGS = 5;

// Sized to the space left of the category list rather than to the website's own
// canvas, which is measured against a full-width page.
const CHART_RENDER = 400 * SCALE;

// Chart.js's line widths are CSS pixels, so they're converted into the SVG's
// own units - otherwise the web gets fainter the larger the chart is drawn.
const CHART_UNIT = CHART_SIZE / (CHART_RENDER / SCALE);
const CHART_LINE = CHART_UNIT.toFixed(3);
const CHART_STROKE = (3 * CHART_UNIT).toFixed(3);
const CHART_DOT = (5 * CHART_UNIT).toFixed(3);

const padReputation = (reputation) => {
  const min = reputation.reduce((sum, value) => sum + value, 0) / 8;

  return reputation.map((value) => min + value);
};

const vertex = (index, count, radius) => {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;

  return [
    CHART_SIZE / 2 + Math.cos(angle) * radius,
    CHART_SIZE / 2 + Math.sin(angle) * radius
  ];
};

const points = (list) => list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

function radarChartSvg(reputation) {
  const values = padReputation(reputation);
  const count = values.length;
  // Chart.js scales to the largest value, so the widest category always touches
  // the outer ring.
  const max = Math.max(...values);
  const plotted = values.map((value, index) =>
    vertex(index, count, max === 0 ? 0 : (value / max) * CHART_RADIUS)
  );

  const web = Array.from({ length: CHART_RINGS }, (_, ring) => {
    const radius = (CHART_RADIUS * (ring + 1)) / CHART_RINGS;
    const ringPoints = Array.from({ length: count }, (_, index) => vertex(index, count, radius));

    return `<polygon points="${points(ringPoints)}" fill="none" stroke="${CHART_BORDER}" stroke-width="${CHART_LINE}"/>`;
  }).join("");

  const spokes = Array.from({ length: count }, (_, index) => {
    const [x, y] = vertex(index, count, CHART_RADIUS);

    return `<line x1="${CHART_SIZE / 2}" y1="${CHART_SIZE / 2}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" stroke="${CHART_BORDER}" stroke-width="${CHART_LINE}"/>`;
  }).join("");

  const dots = plotted
    .map(([x, y]) => `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${CHART_DOT}" fill="url(#stroke)"/>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CHART_SIZE}" height="${CHART_SIZE}" viewBox="0 0 ${CHART_SIZE} ${CHART_SIZE}">
  <defs>
    <linearGradient id="stroke" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="${CHART_FROM}"/>
      <stop offset="100%" stop-color="${CHART_TO}"/>
    </linearGradient>
    <linearGradient id="fill" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="${CHART_FROM}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${CHART_TO}" stop-opacity="0.3"/>
    </linearGradient>
  </defs>
  ${web}${spokes}
  <polygon points="${points(plotted)}" fill="url(#fill)" stroke="url(#stroke)" stroke-width="${CHART_STROKE}"/>
  ${dots}
</svg>`;
}

const svgDataUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

// ---------------------------------------------------------------------------
// Vendored icons
//
// Everything drawn here that isn't text is an SVG lifted out of the website by
// dev/sync-profile-icons.sh. Nothing is fetched at render time: satori resolves
// image sources over the network, which is a dozen more ways for a profile
// image to hang.
// ---------------------------------------------------------------------------

const iconCache = new Map();

function icon(name) {
  if (!iconCache.has(name)) {
    iconCache.set(
      name,
      fs.readFileSync(path.join(__dirname, "assets", "profile-icons", `${name}.svg`), "utf8")
    );
  }

  return iconCache.get(name);
}

const viewBoxOf = (source) => {
  const explicit = source.match(/viewBox="([^"]*)"/);
  if (explicit) return explicit[1].split(/[\s,]+/).map(Number);

  // A couple of the icons size themselves with width/height instead.
  const width = source.match(/\bwidth="([\d.]+)"/);
  const height = source.match(/\bheight="([\d.]+)"/);

  return [0, 0, width ? Number(width[1]) : 24, height ? Number(height[1]) : 24];
};

const innerOf = (source) =>
  source.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

// The website recolours icons with a CSS filter; there's none here, so fills and
// strokes are rewritten directly. fill="none" is structural and has to survive.
const recolour = (markup, colour) =>
  markup
    .replace(/fill="(?!none)[^"]*"/g, `fill="${colour}"`)
    .replace(/stroke="(?!none)[^"]*"/g, `stroke="${colour}"`);

// Scales an icon to fit a box of `size` units and centres it. The root <svg>'s
// fill is re-applied to the group replacing it, since most of these icons leave
// their paths inheriting it and would otherwise fall back to black.
function placeIcon(name, size, colour, { scale = 1 } = {}) {
  const source = icon(name);
  const [minX, minY, width, height] = viewBoxOf(source);
  const factor = (size / Math.max(width, height)) * scale;
  const markup = colour ? recolour(innerOf(source), colour) : innerOf(source);
  const rootFill = source.match(/<svg[^>]*\sfill="([^"]*)"/);
  const inherited = rootFill ? ` fill="${rootFill[1] === "none" ? "none" : colour || rootFill[1]}"` : "";

  return `<g${inherited} transform="translate(${((size - width * factor) / 2).toFixed(2)} ${((size - height * factor) / 2).toFixed(2)}) scale(${factor.toFixed(4)}) translate(${-minX} ${-minY})">${markup}</g>`;
}

// The hexagon is --backgroundImageHex from the dark theme; the glyph sits at
// 37% of it, the size .c-icon.--hex gives it in contributions-summary.css.
const HEX_ICON_SIZE = 48 * SCALE;
const HEX_GLYPH_RATIO = 0.37;

// Sized so the longest metric in practice wraps rather than running up against
// the reputation column beside it.
const METRIC_WIDTH = 230 * SCALE;

const CATEGORY_ICONS = {
  publishing: "community-solutions",
  mentoring: "mentoring",
  authoring: "authoring",
  building: "building",
  maintaining: "maintaining",
  other: "more-horizontal"
};

function hexIconSvg(id) {
  const hex = icon("hex");
  const [, , size] = viewBoxOf(hex);
  const glyphBox = size * HEX_GLYPH_RATIO;
  const offset = (size - glyphBox) / 2;
  const glyph = placeIcon(CATEGORY_ICONS[id] || CATEGORY_ICONS.other, glyphBox, TEXT_MUTED);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${innerOf(hex)}
  <g transform="translate(${offset.toFixed(2)} ${offset.toFixed(2)})">${glyph}</g>
</svg>`;
}

// A standalone icon rendered into its own <img>, since satori draws inline SVG
// as an image source rather than as markup.
const iconDataUri = (name, size, colour, options) =>
  svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${placeIcon(name, size, colour, options)}</svg>`
  );

// The drop-shadow and text-#{rarity}BadgeFill each rarity gets in
// app/css/components/badge.css. These SVGs go to resvg rather than satori, and
// resvg supports feGaussianBlur, so the glow is real rather than faked.
const RARITY_GLOWS = {
  common: { colour: "rgb(200, 200, 200)", opacity: 0.6, fill: "#505359" },
  rare: { colour: "rgb(219, 240, 255)", opacity: 0.6, fill: "#00144B" },
  ultimate: { colour: "rgb(255, 230, 0)", opacity: 0.6, fill: "#560000" },
  legendary: { colour: "rgb(255, 0, 0)", opacity: 0.8, fill: "#4B0000" }
};

// The icon a badge uses isn't derivable from its name - ContributorBadge uses
// `contributors` - so the mapping is vendored by dev/sync-badge-icons.sh.
let badgeIconIndex;
function badgeIcons() {
  badgeIconIndex ||= JSON.parse(
    fs.readFileSync(path.join(__dirname, "assets", "badge-icons", "badge-icons.json"), "utf8")
  );

  return badgeIconIndex;
}

// .c-badge-medallion .c-icon is 45% of the medallion.
const BADGE_ICON_RATIO = 0.45;

// Normalises an icon into the medallion's coordinate space and recolours it to
// the rarity's fill. The payload names the icon directly so a new badge draws
// without a re-sync; the slug is only accepted for payloads that predate that.
function badgeIconMarkup({ icon, slug }, fill) {
  const name = icon || badgeIcons()[slug]?.icon;
  if (!name) return "";

  const file = path.join(__dirname, "assets", "badge-icons", `${name}.svg`);
  if (!fs.existsSync(file)) return "";

  const source = fs.readFileSync(file, "utf8");
  // The monthly challenge badges carry no viewBox at all, so this leans on
  // viewBoxOf's width/height fallback rather than reading the attribute.
  const [minX, minY, width, height] = viewBoxOf(source);
  const size = MEDALLION_ARTWORK * BADGE_ICON_RATIO;
  const scale = size / Math.max(width, height);
  // Centred on its own aspect, so a tall icon isn't pushed off toward a corner.
  const offsetX = (MEDALLION_ARTWORK - width * scale) / 2;
  const offsetY = (MEDALLION_ARTWORK - height * scale) / 2;

  const inner = recolour(innerOf(source), fill);
  const rootFill = source.match(/<svg[^>]*\sfill="([^"]*)"/);
  const inherited = rootFill ? ` fill="${rootFill[1] === "none" ? "none" : fill}"` : "";

  // The trailing translate undoes a viewBox with a non-zero origin.
  return `<g${inherited} transform="translate(${offsetX.toFixed(2)} ${offsetY.toFixed(2)}) scale(${scale.toFixed(4)}) translate(${-minX} ${-minY})">${inner}</g>`;
}

const medallionCache = new Map();

function medallionSvg({ rarity, icon, slug }) {
  const key = RARITY_GLOWS[rarity] ? rarity : "common";
  // Keyed on both, since a payload may carry only one of them.
  const cacheKey = `${key}:${icon || ""}:${slug || ""}`;

  if (!medallionCache.has(cacheKey)) {
    const source = fs.readFileSync(path.join(__dirname, "assets", "medallions", `${key}.svg`), "utf8");
    const glow = RARITY_GLOWS[key];

    const inner = source
      .replace(/^<svg[^>]*>/, "")
      .replace(/<\/svg>\s*$/, "");

    // The 64-unit artwork is centred in an 88-unit canvas so the blur has
    // somewhere to fall off instead of being clipped at the edge.
    medallionCache.set(
      cacheKey,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${MEDALLION_CANVAS}" height="${MEDALLION_CANVAS}" viewBox="0 0 ${MEDALLION_CANVAS} ${MEDALLION_CANVAS}">
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4"/>
    </filter>
  </defs>
  <g transform="translate(${(MEDALLION_CANVAS - MEDALLION_ARTWORK) / 2} ${(MEDALLION_CANVAS - MEDALLION_ARTWORK) / 2})">
    <g filter="url(#glow)" opacity="${glow.opacity}">
      ${inner.replace(/fill="(?!none)[^"]*"/g, `fill="${glow.colour}"`)}
    </g>
    ${inner}
    ${badgeIconMarkup({ icon, slug }, glow.fill)}
  </g>
</svg>`
    );
  }

  return medallionCache.get(cacheKey);
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

// HandleWithFlair ICONS, at the `xlarge` size SIZES puts at 28px.
const FLAIR_ICONS = {
  insider: "insiders",
  lifetime_insider: "lifetime-insiders",
  founder: "staff-flair",
  staff: "staff-flair"
};

const FLAIR_SIZE = 28;

// The founder tag is the only one the HAML draws with an icon of its own. Tags
// arrive as plain strings, so it's recognised by the title config/locales sets.
const TAG_ICONS = {
  "Exercism Founder": "logo"
};

function header({ handle, name, avatar_data, avatar_url, reputation, flair, badges = [], tags = [] }) {
  // See satori_renderer.js: the inlined avatar saves a round trip out through
  // the NAT gateway, with avatar_url as the fallback.
  const avatarSrc = avatar_data || avatar_url;
  const avatar = avatarSrc
    ? el("img", {
        src: avatarSrc,
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        style: { borderRadius: AVATAR_SIZE, marginRight: 32 * SCALE }
      })
    : el("div", {
        style: {
          display: "flex",
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          marginRight: 32 * SCALE,
          borderRadius: AVATAR_SIZE,
          backgroundColor: BORDER
        }
      });

  // .c-primary-reputation. satori has no background-clip, so the gradient
  // border is a gradient-filled wrapper with the pill's background inset in it.
  const reputationPill = el("div", {
    style: {
      display: "flex",
      padding: 3 * SCALE,
      borderRadius: 100,
      backgroundImage: `linear-gradient(${GRADIENT_TO}, ${GRADIENT_FROM})`
    }
  },
    el("div", {
      style: {
        display: "flex",
        alignItems: "center",
        paddingLeft: 16 * SCALE,
        paddingRight: 16 * SCALE,
        paddingTop: 2 * SCALE,
        paddingBottom: 2 * SCALE,
        borderRadius: 100,
        backgroundColor: PILL_BACKGROUND,
        // Hard-coded in the CSS too, so the number stays legible in any theme.
        color: "#fbfcfe",
        fontSize: 20 * SCALE,
        fontWeight: 600
      }
    },
      el("img", {
        src: iconDataUri("reputation", 24 * SCALE, "#fbcc4c"),
        width: 24 * SCALE,
        height: 24 * SCALE,
        style: { marginRight: 8 * SCALE }
      }),
      Number(reputation).toLocaleString("en-US")
    )
  );

  const flairIcon = FLAIR_ICONS[flair]
    ? el("img", {
        // Not recoloured: every flair icon carries its own colours.
        src: iconDataUri(FLAIR_ICONS[flair], FLAIR_SIZE * SCALE),
        width: FLAIR_SIZE * SCALE,
        height: FLAIR_SIZE * SCALE,
        style: { marginLeft: Math.ceil(FLAIR_SIZE / 4) * SCALE }
      })
    : null;

  return el("div", {
    style: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      padding: HEADER_PADDING,
      borderBottom: `1px solid ${BORDER}`,
      backgroundColor: HEADER_BACKGROUND
    }
  },
    avatar,
    el("div", { style: { display: "flex", flexDirection: "column" } },
      el("div", { style: { display: "flex", flexDirection: "row", alignItems: "center", marginBottom: 4 * SCALE } },
        el("div", {
          style: { display: "flex", flexDirection: "row", alignItems: "center", marginRight: 20 * SCALE }
        },
          el("div", { style: { color: TEXT_STRONG, fontSize: 34 * SCALE, fontWeight: 600 } }, handle),
          flairIcon
        ),
        reputationPill
      ),
      name
        ? el("div", { style: { display: "flex", color: TEXT_NAME, fontSize: 24 * SCALE, marginTop: 4 * SCALE } }, name)
        : null
    ),
    // Pushes the badges and tags to the right, the way .ml-auto does.
    el("div", { style: { display: "flex", flexGrow: 1 } }),
    el("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end" } },
      badges.length
        ? el("div", { style: { display: "flex", flexDirection: "row" } },
            ...badges.slice(0, 5).map((badge) =>
              el("img", {
                src: svgDataUri(medallionSvg(badge)),
                width: BADGE_SIZE,
                height: BADGE_SIZE,
                style: { marginLeft: BADGE_GAP }
              })
            )
          )
        : null,
      tags.length
        ? el("div", { style: { display: "flex", flexDirection: "row", marginTop: 12 * SCALE } },
            ...tags.map((tag) => {
              const tagIcon = TAG_ICONS[tag];

              // .tag.founder is .border-gradient, built the same way as the pill.
              return el("div", {
                style: {
                  display: "flex",
                  marginLeft: 8 * SCALE,
                  padding: 1 * SCALE,
                  borderRadius: 100,
                  backgroundImage: `linear-gradient(${GRADIENT_FROM}, ${GRADIENT_TO})`
                }
              },
                el("div", {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: 16 * SCALE,
                    paddingRight: 16 * SCALE,
                    paddingTop: 6 * SCALE,
                    paddingBottom: 6 * SCALE,
                    borderRadius: 100,
                    backgroundColor: TAG_BACKGROUND,
                    color: TEXT_STRONG,
                    fontSize: 14 * SCALE,
                    fontWeight: 600
                  }
                },
                  tagIcon
                    ? el("img", {
                        // .tag .c-icon is 16px, filtered to textColor6.
                        src: iconDataUri(tagIcon, 16 * SCALE, TEXT_DIM),
                        width: 16 * SCALE,
                        height: 16 * SCALE,
                        style: { marginRight: 10 * SCALE }
                      })
                    : null,
                  tag
                )
              );
            })
          )
        : null
    )
  );
}

function categoryRow({ id, metric, reputation }) {
  return el("div", {
    style: { display: "flex", flexDirection: "row", alignItems: "center", marginBottom: 16 * SCALE }
  },
    el("img", {
      src: svgDataUri(hexIconSvg(id)),
      width: HEX_ICON_SIZE,
      height: HEX_ICON_SIZE,
      style: { marginRight: 16 * SCALE }
    }),
    // Both this column and the metric inside it need an explicit width: without
    // one the metric lays out as a single unbroken flex item and collides with
    // the reputation column instead of wrapping.
    el("div", { style: { display: "flex", flexDirection: "column", width: METRIC_WIDTH } },
      el("div", { style: { display: "flex", color: TEXT_STRONG, fontSize: 22 * SCALE, fontWeight: 600 } },
        CATEGORY_TITLES[id]),
      metric
        ? el("div", {
            style: {
              display: "flex",
              width: METRIC_WIDTH,
              color: TEXT_MUTED,
              fontSize: 15 * SCALE,
              lineHeight: 1.4
            }
          }, metric)
        : null
    ),
    el("div", {
      style: {
        display: "flex",
        marginLeft: 24 * SCALE,
        color: TEXT_DIM,
        fontSize: 15 * SCALE
      }
    },
      reputation === 0 ? "No rep" : `${Number(reputation).toLocaleString("en-US")} rep`)
  );
}

function card(data) {
  const byId = new Map((data.categories || []).map((category) => [category.id, category]));
  // A missing category is a zero, not a missing row - the chart's axes have to
  // line up with the list beside it.
  const categories = CATEGORIES.map(
    (id) => byId.get(id) || { id, metric: null, reputation: 0 }
  );

  return el("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      backgroundColor: BACKGROUND,
      fontFamily: "Poppins"
    }
  },
    header(data.header || {}),
    el("div", {
      style: {
        display: "flex",
        flexDirection: "row",
        flexGrow: 1,
        position: "relative",
        paddingTop: 20 * SCALE,
        paddingLeft: HEADER_PADDING,
        paddingRight: HEADER_PADDING,
        paddingBottom: 20 * SCALE
      }
    },
      el("img", {
        src: watermark(),
        width: 60 * SCALE,
        height: 60 * SCALE,
        style: { position: "absolute", bottom: 16 * SCALE, right: 16 * SCALE, opacity: 0.3 }
      }),
      el("div", { style: { display: "flex", flexDirection: "column" } },
        ...categories.map(categoryRow)
      ),
      el("div", { style: { display: "flex", flexGrow: 1 } }),
      el("img", {
        src: svgDataUri(radarChartSvg(categories.map((category) => category.reputation))),
        width: CHART_RENDER,
        height: CHART_RENDER,
        // Centred against the category list rather than pinned to the top of
        // the body, where .mt-[-50px] leaves it on the website.
        style: { alignSelf: "center", marginTop: 8 * SCALE }
      })
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

async function generate({ dataUrl }) {
  const data = await fetchData(dataUrl);

  const svg = await satori(card(data), { width: WIDTH, fonts: fonts() });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng();

  return { body: png, contentType: "image/png" };
}

module.exports = { generate, card, radarChartSvg, hexIconSvg, padReputation, CATEGORIES };
