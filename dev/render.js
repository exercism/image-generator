#!/usr/bin/env node
//
// Renders a solution image locally so you can look at it, because the only
// real test of this is your eyes.
//
//   node dev/render.js                                   # committed fixture
//   node dev/render.js --fixture path/to.json            # your own payload
//   node dev/render.js --fixture dev/fixtures/solution-with-avatar.json
//   node dev/render.js --fixture dev/fixtures/solution-go-tabs.json
//
// The default fixture has no avatar, which is a real case the renderer handles;
// solution-with-avatar.json covers the other one. Its avatar is an inlined data
// URI rather than a link to the avatars host, so rendering stays offline -
// satori fetches image sources over the network at render time.
//
// solution-go-tabs.json is tab-indented Go at indent_size 4. Space-indented
// tracks look the same whatever indent_size says, so it takes a track that
// actually ships literal tabs to see that value being honoured.
//   node dev/render.js --url https://internal.exercism.org/spi/solution_image_data/ruby/bob/ihid
//   node dev/render.js --out /tmp/mine.png
//
// --url takes the data endpoint itself. internal.exercism.org only resolves
// from inside the VPC, so locally point it at your own Rails:
//
//   node dev/render.js --url http://localhost:3020/spi/solution_image_data/ruby/bob/ihid

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const idx = args.indexOf(`--${name}`);
  return idx === -1 ? fallback : args[idx + 1];
};

const out = flag("out", "/tmp/image-generator-preview.png");
const url = flag("url", null);
const fixture = flag("fixture", path.join(__dirname, "fixtures", "solution.json"));

async function payload() {
  if (!url) return JSON.parse(fs.readFileSync(fixture, "utf8"));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `${url} returned ${response.status}. ` +
        "internal.exercism.org only resolves inside the VPC - use your local Rails."
    );
  }
  return response.json();
}

async function main() {
  const data = await payload();

  // Stub the fetch the renderer would do, so one code path serves both modes.
  global.fetch = async () => ({ ok: true, json: async () => data });

  const started = Date.now();
  const { generate } = require("../satori_renderer");
  const { body, contentType } = await generate({ dataUrl: url || "fixture://solution" });
  const elapsed = Date.now() - started;

  fs.writeFileSync(out, body);
  console.log(`${out}  ${contentType}  ${(body.length / 1024).toFixed(0)}KB  ${elapsed}ms`);

  if (process.platform === "darwin" && !args.includes("--no-open")) {
    execFileSync("open", [out]);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
