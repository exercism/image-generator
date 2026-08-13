# Fallback fonts

Committed binaries, not something you edit. Regenerate with:

```bash
dev/build-fonts.sh
```

They exist because Source Code Pro — which the renderer uses for code, and
which fontsource ships in latin, Cyrillic, Greek and Vietnamese subsets — has
no CJK or emoji glyphs at all. Without these, Japanese, Chinese, Korean and
emoji render as tofu boxes, silently, and get cached to S3 that way.

| File | Source | Covers |
| --- | --- | --- |
| `cjk-400.woff` | Noto Sans JP | Kana, CJK punctuation, fullwidth forms, CJK Unified Ideographs. Simplified Chinese shares that block with Japanese, so one face serves both. |
| `hangul-400.woff` | Noto Sans KR | Hangul syllables, conjoining and compatibility jamo. |
| `emoji-400.woff` | Noto Emoji | Pictographs, dingbats, symbols, variation selector and ZWJ. Monochrome — resvg won't draw the colour emoji tables. |

Only 400/normal. These are fallbacks: a bold or italic CJK span gets the
regular face rather than nothing, which is the right trade against several
megabytes an image.

They're built rather than depended on because satori cannot read woff2, and
fontsource's CJK woff files are split across ~125 numbered subsets per weight —
too many faces to register, and too big in the format satori can actually read.
`dev/build-fonts.sh` merges the subsets back into one face and re-cuts the
ranges we need.

## Licence

Noto fonts are licensed under the SIL Open Font License 1.1 — see
`LICENSE-OFL.txt`, which travels with these files as the licence requires.
