const hljs = require("highlight.js");

// highlight.js hands back an HTML string. We need coloured runs of text, and
// satori has no stylesheets to colour spans with, so unpick the markup into
// tokens and let the caller apply the theme it was given.
//
// Parsing hljs's own output rather than driving its emitter API on purpose: the
// output is a tiny, stable subset (nested spans and escaped text) whereas the
// emitter interface is internal and has moved between major versions.

const TAG = /<span class="([^"]*)">|<\/span>/g;

const ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
  "&#39;": "'",
};

function decode(text) {
  return text.replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, (entity) => ENTITIES[entity]);
}

// A span can carry several classes ("hljs-title function_"); the hljs-prefixed
// one is the scope our theme is keyed on.
function scopeOf(classNames) {
  const scope = classNames.split(/\s+/).find((name) => name.startsWith("hljs-"));
  return scope ? scope.slice("hljs-".length) : null;
}

function parse(html) {
  const tokens = [];
  const stack = [];
  let index = 0;

  const push = (text) => {
    if (text) tokens.push({ text: decode(text), scope: stack[stack.length - 1] ?? null });
  };

  for (const match of html.matchAll(TAG)) {
    push(html.slice(index, match.index));

    if (match[0] === "</span>") stack.pop();
    else stack.push(scopeOf(match[1]));

    index = match.index + match[0].length;
  }
  push(html.slice(index));

  return tokens;
}

// Lines are what we lay out, so split tokens on newlines while keeping each
// fragment's scope.
function intoLines(tokens) {
  const lines = [[]];

  for (const { text, scope } of tokens) {
    const fragments = text.split("\n");

    fragments.forEach((fragment, idx) => {
      if (idx > 0) lines.push([]);
      if (fragment) lines[lines.length - 1].push({ text: fragment, scope });
    });
  }

  return lines;
}

// Falls back to plain unhighlighted lines for languages highlight.js doesn't
// know - better a readable image than none.
function highlight(code, language) {
  if (!language || !hljs.getLanguage(language)) {
    return intoLines([{ text: code, scope: null }]);
  }

  try {
    return intoLines(parse(hljs.highlight(code, { language }).value));
  } catch (err) {
    console.error(`Highlighting failed for language '${language}': ${err.message}`);
    return intoLines([{ text: code, scope: null }]);
  }
}

module.exports = { highlight, parse, intoLines };
