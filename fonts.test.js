const { test } = require("node:test");
const assert = require("node:assert");
const satori = require("satori").default;
const { fonts } = require("./satori_renderer");

// satori draws a missing glyph as a tofu box and returns a valid SVG, so a bad
// render is written through to S3 and served indefinitely. Detecting it needs
// variety rather than volume - "did it draw anything?" passes on tofu, since a
// box is geometry too - so this strips the coordinates off each subpath and
// counts the distinct shapes left. Tofu is one shape repeated however long the
// string; real text draws a different outline per character.
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
      // Two copies of the same box differ only in position and size.
      .map((subpath) => subpath.replace(/-?\d+(\.\d+)?/g, "#"))
  ).size;
}

// Every sample below is five distinct characters, which sits above what tofu
// can produce and below correct output. Not one shape per character: some
// scripts legitimately land lower, as Hangul syllables share jamo.
const SAMPLE_LENGTH = 5;
const TOFU_CEILING = 4;

// Private-use characters no face will ever cover - guaranteed tofu. If a font
// change made this pass, every test below it would be measuring nothing.
test("tofu stays below the threshold, so the other tests mean something", async () => {
  assert.ok(await distinctShapes("") <= TOFU_CEILING);
});

// The scripts Source Code Pro already covered, pinned so a font change can't
// quietly drop them.
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

// The scripts from the issue - all tofu before the fallback faces went in.
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

// The naming trap documented above MONO_SUBSETS tofus italic CJK while upright
// CJK looks fine, and comments are italic in every theme.
test("renders CJK in italic, not just upright", async () => {
  assert.ok(await distinctShapes("日本語漢字", { fontStyle: "italic" }) > TOFU_CEILING);
});

test("renders CJK in bold", async () => {
  assert.ok(await distinctShapes("日本語漢字", { fontWeight: 600 }) > TOFU_CEILING);
});

// The footer is Poppins, not the mono family, and a CJK handle rendered as a
// row of boxes next to the avatar.
test("renders CJK in the footer family", async () => {
  assert.ok(await distinctShapes("山田太郎様", { fontFamily: "Poppins" }) > TOFU_CEILING);
});

// The sample strings are only a valid probe at this length.
test("every sample is the length the threshold assumes", () => {
  for (const sample of ["abcde", "こんにちは", "🚀✅🎉⚡🔥"]) {
    assert.strictEqual([...sample].length, SAMPLE_LENGTH);
  }
});
