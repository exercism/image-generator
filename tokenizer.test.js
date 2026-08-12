const { test } = require("node:test");
const assert = require("node:assert");
const { highlight, parse, intoLines } = require("./tokenizer");

test("pulls scopes off highlight.js spans", () => {
  const tokens = parse('<span class="hljs-keyword">def</span> hey');

  assert.deepStrictEqual(tokens, [
    { text: "def", scope: "keyword" },
    { text: " hey", scope: null }
  ]);
});

test("takes the hljs-prefixed class when a span carries several", () => {
  const tokens = parse('<span class="hljs-title function_">hey</span>');

  assert.strictEqual(tokens[0].scope, "title");
});

test("attributes nested spans to the innermost scope", () => {
  const tokens = parse(
    '<span class="hljs-string">"a<span class="hljs-subst">b</span>c"</span>'
  );

  assert.deepStrictEqual(tokens.map((t) => [t.text, t.scope]), [
    ['"a', "string"],
    ["b", "subst"],
    ['c"', "string"]
  ]);
});

test("decodes the entities highlight.js escapes", () => {
  const tokens = parse('<span class="hljs-keyword">a &amp;&amp; b &lt; c</span>');

  assert.strictEqual(tokens[0].text, "a && b < c");
});

test("splits into lines while keeping each fragment's scope", () => {
  const lines = intoLines([
    { text: "def hey\n  ", scope: "keyword" },
    { text: "42", scope: "number" }
  ]);

  assert.strictEqual(lines.length, 2);
  assert.deepStrictEqual(lines[0], [{ text: "def hey", scope: "keyword" }]);
  assert.deepStrictEqual(lines[1], [
    { text: "  ", scope: "keyword" },
    { text: "42", scope: "number" }
  ]);
});

test("keeps blank lines so numbering stays aligned with the source", () => {
  const lines = intoLines([{ text: "a\n\nb", scope: null }]);

  assert.strictEqual(lines.length, 3);
  assert.deepStrictEqual(lines[1], []);
});

test("highlights real code", () => {
  const lines = highlight("const x = 1;", "javascript");

  assert.strictEqual(lines.length, 1);
  assert.ok(lines[0].some((token) => token.scope === "keyword"));
});

test("falls back to plain text for an unknown language", () => {
  const lines = highlight("some code\nmore code", "not-a-language");

  assert.deepStrictEqual(lines, [
    [{ text: "some code", scope: null }],
    [{ text: "more code", scope: null }]
  ]);
});

test("preserves indentation, which the renderer relies on", () => {
  const lines = highlight("if (x) {\n    return 1;\n}", "javascript");

  assert.ok(lines[1][0].text.startsWith("    "));
});
