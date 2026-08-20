const { test } = require("node:test");
const assert = require("node:assert");
const satori = require("satori").default;
const { fonts } = require("./satori_renderer");
const { card, radarChartSvg, hexIconSvg, padReputation, CATEGORIES } = require("./profile_renderer");

const FIXTURE = require("./dev/fixtures/profile.json");

// Carried over from use-chart.ts: without it an empty category pulls its vertex
// into the centre and the polygon gets a spike.
test("pads every value by an eighth of the total", () => {
  const padded = padReputation([0, 800]);

  assert.deepStrictEqual(padded, [100, 900]);
});

test("gives a zero category a non-zero radius", () => {
  const [zero] = padReputation([0, 100, 100]);

  assert.ok(zero > 0);
});

// If this drifts, the polygon silently rotates out of step with the list.
test("puts the first axis at the top", () => {
  const svg = radarChartSvg([100, 0, 0, 0, 0, 0]);
  const polygon = svg.match(/<polygon points="([^"]+)" fill="url\(#fill\)"/)[1];
  const [x, y] = polygon.split(" ")[0].split(",").map(Number);

  // Directly above the centre of a 520-unit square.
  assert.strictEqual(Math.round(x), 260);
  assert.ok(y < 260, `expected the first vertex above the centre, got ${y}`);
});

test("draws a ring per level plus a spoke per axis", () => {
  const svg = radarChartSvg([1, 2, 3, 4, 5, 6]);

  // Five web rings plus the data polygon.
  assert.strictEqual((svg.match(/<polygon/g) || []).length, 6);
  // <line and not <linearGradient, which the two gradient defs would otherwise
  // be counted as.
  assert.strictEqual((svg.match(/<line\s/g) || []).length, 6);
  assert.strictEqual((svg.match(/<circle/g) || []).length, 6);
});

// A brand new account. A NaN in the path data makes resvg drop the polygon.
test("survives a profile with no reputation at all", () => {
  const svg = radarChartSvg([0, 0, 0, 0, 0, 0]);

  assert.ok(!svg.includes("NaN"));
});

// The six rows always have to line up with the chart's six axes.
test("renders all six categories even when the payload omits them", () => {
  const rows = card({ header: { handle: "someone", reputation: 0 }, categories: [] });

  // The row list is the first child of the body, after the header.
  const body = rows.props.children[1];
  const list = body.props.children.find(
    (child) => Array.isArray(child?.props?.children) && child.props.children.length === 6
  );

  assert.ok(list, "expected a column of six category rows");
  assert.strictEqual(CATEGORIES.length, 6);
});

// satori throws on an unsupported style or a bad element shape rather than
// degrading, so accepting the tree at all is the assertion.
test("lays the full fixture out without throwing", async () => {
  const svg = await satori(card(FIXTURE), { width: 1600, fonts: fonts() });

  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.length > 1000);
});

// A 1x1 transparent png, inlined the way the SPI now sends avatars.
const AVATAR_DATA =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

test("draws the inlined avatar", async () => {
  const data = { ...FIXTURE, header: { ...FIXTURE.header, avatar_data: AVATAR_DATA } };

  const svg = await satori(card(data), { width: 1600, fonts: fonts() });

  assert.ok(svg.includes(AVATAR_DATA.split(",")[1].slice(0, 24)));
});

// The point of dropping the fallback: even handed a url, the renderer has no
// way to use it, so a render can never leave the VPC.
test("ignores avatar_url entirely", async () => {
  const data = {
    ...FIXTURE,
    header: { ...FIXTURE.header, avatar_data: null, avatar_url: "https://assets.exercism.org/avatars/1/0" }
  };

  const svg = await satori(card(data), { width: 1600, fonts: fonts() });

  assert.ok(!svg.includes("assets.exercism.org"));
});

test("draws the placeholder when there is nothing to inline", async () => {
  const data = { ...FIXTURE, header: { ...FIXTURE.header, avatar_data: null } };

  const svg = await satori(card(data), { width: 1600, fonts: fonts() });

  assert.ok(svg.startsWith("<svg"));
});

test("handles a missing avatar", async () => {
  const data = { ...FIXTURE, header: { ...FIXTURE.header, avatar_url: null } };
  const svg = await satori(card(data), { width: 1600, fonts: fonts() });

  assert.ok(svg.startsWith("<svg"));
});

// If the vendored mapping drifts from the icons beside it, medallions silently
// lose their glyph.
test("every badge in the index has its icon vendored", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const dir = path.join(__dirname, "assets", "badge-icons");
  const index = JSON.parse(fs.readFileSync(path.join(dir, "badge-icons.json"), "utf8"));

  const slugs = Object.keys(index);
  assert.ok(slugs.length > 40, `expected the full badge list, got ${slugs.length}`);

  for (const [slug, { icon, rarity }] of Object.entries(index)) {
    assert.ok(
      fs.existsSync(path.join(dir, `${icon}.svg`)),
      `${slug} points at ${icon}.svg, which isn't vendored`
    );
    assert.ok(
      ["common", "rare", "ultimate", "legendary"].includes(rarity),
      `${slug} has an unknown rarity: ${rarity}`
    );
  }
});

// The ways a glyph can go missing are all silent - an unmeasurable icon or a
// flooded outline both draw a plausible empty hexagon - and the icons with no
// viewBox are the ones that broke, so this walks the set rather than sampling.
test("every badge draws a glyph inside its medallion", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const index = JSON.parse(
    fs.readFileSync(path.join(__dirname, "assets", "badge-icons", "badge-icons.json"), "utf8")
  );

  for (const [slug, { icon, rarity }] of Object.entries(index)) {
    // Keyed by icon, which is the form the payload actually sends.
    const tree = card({
      header: { handle: "someone", reputation: 1, badges: [{ icon, rarity }] },
      categories: []
    });

    const medallion = JSON.stringify(tree)
      .match(/data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/g)
      .map((uri) => Buffer.from(uri.split("base64,")[1], "base64").toString("utf8"))
      // The medallion is the only one of these carrying a rarity glow.
      .find((svg) => svg.includes("feGaussianBlur"));

    assert.ok(medallion, `${slug} drew no medallion`);
    assert.match(
      medallion,
      /<g[^>]*transform="translate\([\d.-]+ [\d.-]+\) scale/,
      `${slug} drew an empty medallion - its icon contributed no glyph`
    );
    assert.ok(!medallion.includes("NaN"), `${slug} put a NaN in the medallion`);
    assert.ok(!medallion.includes("undefined"), `${slug} left an undefined in the medallion`);
  }
});

// Both payload shapes are in the fixtures and both have to reach the same
// artwork. The slug form is lossy upstream - Badges::Completed12In23Badge
// underscores to "completed12_in23" - which is why the icon is sent instead.
test("accepts a badge by icon and by slug alike", () => {
  const medallionFor = (badge) => {
    const tree = card({
      header: { handle: "someone", reputation: 1, badges: [badge] },
      categories: []
    });

    return JSON.stringify(tree)
      .match(/data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/g)
      .map((uri) => Buffer.from(uri.split("base64,")[1], "base64").toString("utf8"))
      .find((svg) => svg.includes("feGaussianBlur"));
  };

  const byIcon = medallionFor({ icon: "moss", rarity: "legendary" });
  const bySlug = medallionFor({ slug: "moss", rarity: "legendary" });

  assert.match(byIcon, /<g[^>]*transform="translate\([\d.-]+ [\d.-]+\) scale/);
  assert.strictEqual(byIcon, bySlug, "the two payload shapes drew different medallions");
});

// The website can add a badge at any time, so this has to degrade, not throw.
test("draws a plain medallion for an unvendored icon", async () => {
  const data = {
    ...FIXTURE,
    header: { ...FIXTURE.header, avatar_url: null, badges: [{ icon: "not_an_icon", rarity: "rare" }] }
  };
  const svg = await satori(card(data), { width: 1600, fonts: fonts() });

  assert.ok(svg.startsWith("<svg"));
});

// As above, for the slug form.
test("draws a medallion for an unknown badge slug", async () => {
  const data = {
    ...FIXTURE,
    header: { ...FIXTURE.header, avatar_url: null, badges: [{ slug: "not_a_badge", rarity: "rare" }] }
  };
  const svg = await satori(card(data), { width: 1600, fonts: fonts() });

  assert.ok(svg.startsWith("<svg"));
});

// satori won't wrap the metric unless the element carries a width of its own,
// so the column and the metric are both checked.
test("bounds the metric so a long one wraps instead of colliding with the rep", () => {
  const tree = card(FIXTURE);
  const body = tree.props.children[1];
  const list = body.props.children.find(
    (child) => Array.isArray(child?.props?.children) && child.props.children.length === 6
  );
  // Authoring is the row with the longest metric in the fixture.
  const authoring = list.props.children[CATEGORIES.indexOf("authoring")];
  const [, column, reputation] = authoring.props.children;
  const [, metric] = column.props.children;

  assert.ok(column.props.style.width > 0, "the title/metric column has no width");
  assert.ok(metric.props.style.width > 0, "the metric itself has no width, so it won't wrap");
  assert.strictEqual(metric.props.style.width, column.props.style.width);
  assert.ok(reputation.props.style.marginLeft > 0, "no gap before the reputation column");
});

// A missing icon file throws at render time rather than degrading, so the set
// dev/sync-profile-icons.sh copies is pinned here rather than found in prod.
test("every icon the profile draws is vendored", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const dir = path.join(__dirname, "assets", "profile-icons");

  const required = [
    // The hexagon behind every category glyph.
    "hex",
    // The shield in the reputation pill and the {~} in the founder tag.
    "reputation",
    "logo",
    // One per HandleWithFlair flair.
    "staff-flair",
    "insiders",
    "lifetime-insiders",
    // One per category, in CATEGORY_ICONS order.
    "community-solutions",
    "mentoring",
    "authoring",
    "building",
    "maintaining",
    "more-horizontal"
  ];

  for (const name of required) {
    assert.ok(fs.existsSync(path.join(dir, `${name}.svg`)), `${name}.svg isn't vendored`);
  }
});

// fill="none" is what stops an outlined icon being flooded into a solid blob,
// so it has to survive the recolour rewrite.
test("keeps fill=none intact when recolouring an icon", () => {
  // Every path in the authoring pencil is fill="none" with a stroke.
  const svg = hexIconSvg("authoring");

  assert.ok(svg.includes('fill="none"'), "the pencil outline lost its fill=none");
  assert.ok(svg.includes("stroke="), "expected the glyph to keep its strokes");
  assert.ok(!svg.includes("NaN"));
});

// The payload comes from a separate repo, so an unknown id has to fall back.
test("draws a hexagon for every category and for an unknown one", () => {
  for (const id of [...CATEGORIES, "not_a_category"]) {
    const svg = hexIconSvg(id);

    assert.ok(svg.startsWith("<svg"), `${id} produced no hexagon`);
    assert.ok(!svg.includes("undefined"), `${id} left an undefined in the markup`);
  }
});

// A profile with no flair must not try to load "undefined.svg".
test("renders with and without a flair", async () => {
  for (const flair of [undefined, "founder", "staff", "insider", "lifetime_insider"]) {
    const data = { ...FIXTURE, header: { ...FIXTURE.header, avatar_url: null, flair } };
    const svg = await satori(card(data), { width: 1600, fonts: fonts() });

    assert.ok(svg.startsWith("<svg"), `flair ${flair} failed to render`);
  }
});

// The website can add a flair at any time; an unknown one drops its icon.
test("ignores an unknown flair", async () => {
  const data = { ...FIXTURE, header: { ...FIXTURE.header, avatar_url: null, flair: "wizard" } };
  const svg = await satori(card(data), { width: 1600, fonts: fonts() });

  assert.ok(svg.startsWith("<svg"));
});

// Only the founder tag has an icon; the rest must not go looking for one.
test("draws a tag without an icon", async () => {
  const data = {
    ...FIXTURE,
    header: { ...FIXTURE.header, avatar_url: null, tags: ["Maintainer"] }
  };
  const svg = await satori(card(data), { width: 1600, fonts: fonts() });

  assert.ok(svg.startsWith("<svg"));
});

// Profiles carry user-supplied real names, so the fallback faces have to reach
// this renderer too.
test("renders a CJK handle and name", async () => {
  const data = {
    ...FIXTURE,
    header: { ...FIXTURE.header, handle: "山田太郎", name: "山田 太郎", avatar_url: null }
  };
  const svg = await satori(card(data), { width: 1600, fonts: fonts() });

  assert.ok(svg.startsWith("<svg"));
});
