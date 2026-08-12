#!/usr/bin/env node
//
// Renders a solution image locally so you can look at it, because the only
// real test of this is your eyes.
//
//   node dev/render.js                                   # committed fixture
//   node dev/render.js --fixture path/to.json            # your own payload
//   node dev/render.js --url https://exercism.org/images/solutions/ruby/bob/ihid
//   node dev/render.js --out /tmp/mine.png
//
// --url hits the real data endpoint, so it needs the website to be serving
// /data (exercism/website#9348) and to not be behind a bot challenge. Against
// production you'll get a Cloudflare challenge unless your IP is allowlisted;
// point it at localhost:3020 instead.

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

  const response = await fetch(`${url}/data`);
  if (!response.ok) {
    throw new Error(
      `${url}/data returned ${response.status}. ` +
        "A 403 with a Cloudflare challenge means this IP isn't allowlisted."
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
  const { body, contentType } = await generate({ url: url || "fixture://solution" });
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
