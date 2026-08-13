#!/usr/bin/env bash
#
# Copies the badge icons out of the website repo into assets/badge-icons/.
#
#   dev/sync-badge-icons.sh [path-to-website-repo]
#
# The icons are committed, so this only needs running when a badge is added or
# its icon changes. They're vendored because satori resolves image sources over
# the network, and a profile can show five badges.
#
# Which icon a badge uses is the third argument to `seed` in
# app/models/badges/*_badge.rb and is NOT derivable from the class name -
# RookieBadge uses `editor` - so that mapping is written to badge-icons.json.
#
set -euo pipefail

cd "$(dirname "$0")/.."
website="${1:-../website}"
out="assets/badge-icons"

if [ ! -d "$website/app/models/badges" ]; then
  echo "Can't find the website repo at '$website'." >&2
  echo "Pass its path: dev/sync-badge-icons.sh ../website" >&2
  exit 1
fi

mkdir -p "$out"
rm -f "$out"/*.svg

WEBSITE="$website" OUT="$out" node <<'NODE'
const fs = require("fs");
const path = require("path");

const website = process.env.WEBSITE;
const out = process.env.OUT;
const badgeDir = path.join(website, "app/models/badges");
const iconDir = path.join(website, "app/images/icons");

const badges = {};
const missing = [];

for (const file of fs.readdirSync(badgeDir).filter((f) => f.endsWith("_badge.rb"))) {
  const source = fs.readFileSync(path.join(badgeDir, file), "utf8");
  // Anchored on the rarity: names can contain apostrophes, and the icon is a
  // string in some badges and a symbol in others.
  const match = source.match(
    /seed\s+[\s\S]*?,\s*:(common|rare|ultimate|legendary),\s*(?:["']([\w-]+)["']|:([\w-]+))/
  );

  if (!match) {
    missing.push(file);
    continue;
  }

  const slug = file.replace(/_badge\.rb$/, "");
  const icon = match[2] || match[3];
  badges[slug] = { rarity: match[1], icon };

  const source_path = path.join(iconDir, `${icon}.svg`);
  if (fs.existsSync(source_path)) {
    fs.copyFileSync(source_path, path.join(out, `${icon}.svg`));
  } else {
    missing.push(`${slug} -> ${icon}.svg`);
  }
}

fs.writeFileSync(path.join(out, "badge-icons.json"), `${JSON.stringify(badges, null, 2)}\n`);

const count = Object.keys(badges).length;
console.log(`${count} badges, ${new Set(Object.values(badges).map((b) => b.icon)).size} distinct icons`);
if (missing.length) {
  console.error(`Could not resolve: ${missing.join(", ")}`);
  process.exit(1);
}
NODE

du -sh "$out"
