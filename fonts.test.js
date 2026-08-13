const { test } = require("node:test");
const assert = require("node:assert");
const satori = require("satori").default;
const { fonts } = require("./satori_renderer");

// satori never errors on a missing glyph. It draws a tofu box and returns a
// perfectly valid SVG, which is what makes this worth testing: a bad image is
// written through to S3 and served for that URL indefinitely, and nobody finds
// out until a user reports it.
//
// Detecting that is fiddlier than it looks. The obvious check - "did it draw
// anything?" - passes on tofu, because a box *is* geometry: five tofu boxes
// emit more path data than five narrow latin letters. Counting subpaths fails
// for the same reason.
//
// What separates them is variety. Tofu is one box shape repeated, so a string
// of n distinct characters collapses to a handful of distinct shapes however
// long it gets. Real text draws a different outline per character. So: strip
// the coordinates from each subpath, and count how many distinct shapes are
// left.
async function distinctShapes(text, style = {}) {
  const svg = await satori(
    {
      type: "div",
      props: {
        style: { display: "flex", fontFamily: "Source Code Pro", fontSize: 40, color: "#fff", ...style },
        children: text
      }
    },
    { width: 900, height: 120, fonts: fonts() }
  );

  const paths = (svg.match(/ d="[^"]*"/g) || []).map((attr) => attr.slice(4, -1)).join(" ");

  return new Set(
    paths
      .split(/(?=M)/)
      .filter((subpath) => subpath.trim())
      // Position and size are what differ between two copies of the same box;
      // removing every number leaves the shape itself.
      .map((subpath) => subpath.replace(/-?\d+(\.\d+)?/g, "#"))
  ).size;
}

// Every sample below is five distinct characters. Rendered properly that gives
// roughly five distinct shapes; tofu gives about four however many characters
// it is handed, so this sits above tofu and below correct output. Some scripts
// legitimately land lower than their character count - Hangul syllables share
// jamo components between them - so this isn't "one shape per character".
const SAMPLE_LENGTH = 5;
const TOFU_CEILING = 4;

// A private-use character no face will ever cover, so this is what guaranteed
// tofu looks like. If a font change ever made this pass, the test above it
// would be measuring nothing.
test("tofu stays below the threshold, so the other tests mean something", async () => {
  assert.ok(await distinctShapes("") <= TOFU_CEILING);
});

// The scripts Source Code Pro already covered. They'd have passed before the
// CJK work; they're here so a font change can't quietly drop them.
for (const [script, sample] of [
  ["latin", "abcde"],
  ["cyrillic", "Привет"],
  ["greek", "Γειάσ"],
  ["vietnamese", "chàoế"]
]) {
  test(`renders ${script}`, async () => {
    assert.ok(await distinctShapes(sample) > TOFU_CEILING);
  });
}

// The scripts from the issue. Source Code Pro has no glyphs for any of these in
// any subset it ships, so every one of them tofud before the fallback faces
// were added.
for (const [script, sample] of [
  ["japanese kana", "こんにちは"],
  ["japanese ideographs", "世界日本語"],
  ["simplified chinese", "你好世另"],
  ["korean hangul", "안녕하세요"],
  ["fullwidth forms", "ＡＢＣ１２"],
  ["emoji", "🚀✅🎉⚡🔥"]
]) {
  test(`renders ${script}`, async () => {
    assert.ok(await distinctShapes(sample) > TOFU_CEILING);
  });
}

// The trap documented above monoFaces(): satori matches fallback candidates on
// style as well as family, so registering the fallbacks under a single name
// lets an italic span match the primary family and stop the search - tofuing
// italic CJK while upright CJK looks fine. Comments and quotes are italic in
// every theme, and CJK in a comment is exactly what produces this.
test("renders CJK in italic, not just upright", async () => {
  assert.ok(await distinctShapes("日本語漢字", { fontStyle: "italic" }) > TOFU_CEILING);
});

test("renders CJK in bold", async () => {
  assert.ok(await distinctShapes("日本語漢字", { fontWeight: 600 }) > TOFU_CEILING);
});

// The footer is Poppins, not the mono family, and the issue calls this out
// specifically: a handle containing CJK rendered as a row of boxes next to the
// avatar.
test("renders CJK in the footer family", async () => {
  assert.ok(await distinctShapes("山田太郎様", { fontFamily: "Poppins" }) > TOFU_CEILING);
});

// The sample strings are only a valid probe at this length.
test("every sample is the length the threshold assumes", () => {
  for (const sample of ["abcde", "こんにちは", "🚀✅🎉⚡🔥"]) {
    assert.strictEqual([...sample].length, SAMPLE_LENGTH);
  }
});
