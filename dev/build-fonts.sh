#!/usr/bin/env bash
#
# Builds the CJK and emoji fallback fonts in assets/fonts/.
#
#   dev/build-fonts.sh
#
# The .woff files are committed, so this is only for regenerating them - the
# Lambda image build can't depend on a Python toolchain.
#
# Why this exists rather than just adding @fontsource/noto-* to package.json:
# satori can't read woff2 ("Unsupported OpenType signature wOF2") and
# fontsource's plain .woff copies of a full CJK face are an order of magnitude
# bigger, so the ~125 numbered subsets it ships per weight are merged back into
# one face here and re-cut to the ranges below.
#
# What it produces:
#
#   cjk-400.woff     2.6M    kana, CJK punctuation, fullwidth forms,
#                            CJK Unified Ideographs (covers JA and ZH)
#   hangul-400.woff  1.7M    Hangul syllables and jamo (KO)
#   emoji-400.woff   463K    monochrome emoji
#
set -euo pipefail

cd "$(dirname "$0")/.."
out="assets/fonts"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

mkdir -p "$out"

echo "==> installing font sources"
(cd "$work" && npm init -y >/dev/null && \
  npm install --silent --no-audit --no-fund \
    @fontsource/noto-sans-jp@5 \
    @fontsource/noto-sans-kr@5 \
    @fontsource/noto-emoji@5 >/dev/null)

echo "==> setting up fonttools"
python3 -m venv "$work/venv"
"$work/venv/bin/pip" install --quiet fonttools brotli

# fontsource ships no whole-face file, only the numbered subsets, so the face
# has to be reassembled before it can be re-cut.
cat > "$work/merge.py" <<'PY'
import glob, sys
from fontTools.ttLib import TTFont
from fontTools.merge import Merger

pkg, weight, out, work = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

files = sorted(glob.glob(f'{work}/node_modules/@fontsource/{pkg}/files/{pkg}-*-{weight}-normal.woff2'))
# The named subsets duplicate glyphs the numbered ones already carry, and
# Source Code Pro is already handling those scripts.
skip = ('-latin-', '-latin-ext-', '-cyrillic-', '-cyrillic-ext-', '-greek-',
        '-greek-ext-', '-vietnamese-')
files = [f for f in files if not any(s in f for s in skip)]

print(f'    {pkg}: merging {len(files)} subsets')
paths = []
for i, f in enumerate(files):
    p = f'{work}/_m{pkg}{i}.ttf'
    TTFont(f).save(p)
    paths.append(p)

Merger().merge(paths).save(out)
PY

subset() {
  "$work/venv/bin/pyftsubset" "$1" \
    --unicodes="$2" \
    --output-file="$3" \
    --flavor=woff \
    --no-hinting \
    --desubroutinize \
    --layout-features='' \
    --name-IDs='' \
    --notdef-outline
}

# Kana, CJK punctuation, fullwidth/halfwidth forms, and the whole CJK Unified
# Ideographs block. Simplified Chinese shares that block with Japanese, so one
# face covers both - which is why there is no separate Chinese font here.
CJK_RANGES="U+3000-303F,U+3040-309F,U+30A0-30FF,U+31F0-31FF,U+FF00-FFEF,U+4E00-9FFF"
# Hangul syllables, plus conjoining and compatibility jamo.
HANGUL_RANGES="U+AC00-D7AF,U+1100-11FF,U+3130-318F"
# Pictographs, dingbats, symbols, and the variation selector / ZWJ that emoji
# sequences are built from.
EMOJI_RANGES="U+1F000-1F2FF,U+1F300-1F9FF,U+2600-27BF,U+2B00-2BFF,U+FE0F,U+200D"

echo "==> building cjk-400.woff"
"$work/venv/bin/python" "$work/merge.py" noto-sans-jp 400 "$work/jp.ttf" "$work"
subset "$work/jp.ttf" "$CJK_RANGES" "$out/cjk-400.woff"

echo "==> building hangul-400.woff"
"$work/venv/bin/python" "$work/merge.py" noto-sans-kr 400 "$work/kr.ttf" "$work"
subset "$work/kr.ttf" "$HANGUL_RANGES" "$out/hangul-400.woff"

echo "==> building emoji-400.woff"
"$work/venv/bin/python" "$work/merge.py" noto-emoji 400 "$work/emoji.ttf" "$work"
subset "$work/emoji.ttf" "$EMOJI_RANGES" "$out/emoji-400.woff"

echo
ls -lh "$out"
