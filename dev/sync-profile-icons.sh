#!/usr/bin/env bash
#
# Copies the icons the profile image needs out of the website repo into
# assets/profile-icons/.
#
#   dev/sync-profile-icons.sh [path-to-website-repo]
#
# Committed, so this only needs re-running when an icon changes upstream. Same
# reasoning as dev/sync-badge-icons.sh: satori resolves image sources over the
# network, so anything unvendored is another way for an image to hang.
#
# What's here and where it comes from:
#
#   reputation          ViewComponents::Reputation - the shield in the rep pill
#   staff-flair         HandleWithFlair ICONS[:founder] and [:staff]
#   insiders            HandleWithFlair ICONS[:insider]
#   lifetime-insiders   HandleWithFlair ICONS[:lifetime_insider]
#   logo                graphical_icon :logo - the {~} in the founder tag
#   community-solutions \
#   mentoring            |
#   authoring            | CATEGORY_ICONS in ContributionsSummary.tsx, one per
#   building             | category, drawn inside the hexagon
#   maintaining          |
#   more-horizontal     /
#
# The hexagon those sit in isn't an icon file but --backgroundImageHex, a base64
# data URI in app/css/ui-kit/colors.css, so it's extracted below.
#
set -euo pipefail

cd "$(dirname "$0")/.."
website="${1:-../website}"
out="assets/profile-icons"

if [ ! -d "$website/app/images/icons" ]; then
  echo "Can't find the website repo at '$website'." >&2
  echo "Pass its path: dev/sync-profile-icons.sh ../website" >&2
  exit 1
fi

mkdir -p "$out"
rm -f "$out"/*.svg

WEBSITE="$website" OUT="$out" node <<'NODE'
const fs = require("fs");
const path = require("path");

const website = process.env.WEBSITE;
const out = process.env.OUT;
const iconDir = path.join(website, "app/images/icons");

const icons = [
  "reputation",
  "staff-flair",
  "insiders",
  "lifetime-insiders",
  "logo",
  "community-solutions",
  "mentoring",
  "authoring",
  "building",
  "maintaining",
  "more-horizontal"
];

const missing = [];

for (const icon of icons) {
  const source = path.join(iconDir, `${icon}.svg`);

  if (fs.existsSync(source)) {
    fs.copyFileSync(source, path.join(out, `${icon}.svg`));
  } else {
    missing.push(`${icon}.svg`);
  }
}

// Declared twice: light theme first, then .theme-dark. The image renders dark,
// and the light one is a white hexagon that would be a blob against the card.
const colors = fs.readFileSync(path.join(website, "app/css/ui-kit/colors.css"), "utf8");
const declarations = colors
  .split("\n")
  .filter((line) => line.includes("--backgroundImageHex"));

if (declarations.length < 2) {
  missing.push("--backgroundImageHex (dark theme)");
} else {
  const encoded = declarations[1].match(/base64,([^"]+)/);

  if (encoded) {
    fs.writeFileSync(path.join(out, "hex.svg"), Buffer.from(encoded[1], "base64").toString("utf8"));
  } else {
    missing.push("--backgroundImageHex (not base64)");
  }
}

console.log(`${fs.readdirSync(out).filter((f) => f.endsWith(".svg")).length} icons`);
if (missing.length) {
  console.error(`Could not resolve: ${missing.join(", ")}`);
  process.exit(1);
}
NODE

du -sh "$out"
