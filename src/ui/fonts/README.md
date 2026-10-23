# `src/ui/fonts` — self-hosted typography (ADR-0001)

No runtime Google Fonts in any zone. These five files are committed, served by Next from the
app's own origin, and loaded with `next/font/local` in `index.ts`.

| Role            | Family                             | File                         | Size                                                                        |
| --------------- | ---------------------------------- | ---------------------------- | --------------------------------------------------------------------------- |
| (unused)        | Noto Sans Thai (variable, 100–900) | `noto-sans-thai-latin.woff2` | 30.0 KB — not loaded since the 2026-10-06 UX audit (Anuphan is the UI face) |
| (unused)        | Noto Sans Thai (variable, 100–900) | `noto-sans-thai-thai.woff2`  | 26.3 KB — not loaded                                                        |
| Display (h1–h4) | Anuphan (variable, 100–700)        | `anuphan-latin.woff2`        | 34.3 KB                                                                     |
| Display (h1–h4) | Anuphan (variable, 100–700)        | `anuphan-thai.woff2`         | 18.5 KB                                                                     |
| Mono (codes)    | JetBrains Mono (variable, 100–800) | `jetbrains-mono-latin.woff2` | 39.5 KB                                                                     |

**149 KB total**, against the 180 KB budgeted in ADR-0001.

## Provenance

Downloaded from `fonts.gstatic.com`, the Thai and Latin subsets of the Google Fonts v2 API's
variable builds — Noto Sans Thai `v29`, Anuphan `v6`, JetBrains Mono `v24`. To refresh a file,
request the family's `css2` URL with a modern browser User-Agent and take the `src` URL under
the `/* thai */` or `/* latin */` comment.

All three are licensed under the **SIL Open Font License 1.1**; the licence text sits beside
the files as `OFL-notosansthai.txt`, `OFL-anuphan.txt` and `OFL-jetbrainsmono.txt`.

## Why one file per script, and why Latin first

`next/font/local` applies its `declarations` to every `src` entry in a call, so it cannot give
two files in one family different `unicode-range`s — and two `@font-face` rules for the same
family with no range means the browser only ever uses the first. So each subset is its own
family, and the stack in `src/ui/tokens/scale.ts` orders them by coverage:

```
--font-sans: var(--font-pk-sans-latin), var(--font-pk-sans-thai), ui-sans-serif, …
```

ASCII resolves in the metric-matched Latin companion; Thai codepoints are absent there and
fall through to the Thai file. Mixed Thai/English lines keep one x-height either way.

Mono is Latin-only and `preload: false`: a code is never Thai script, and preloading 40 KB on
pages that show none would cost the marketing LCP budget.

## Storybook

Vite cannot run `next/font`, so `.storybook/fonts.css` declares the same five faces by hand
over `staticDirs`. If a file here is renamed, rename it there too.

## Not these fonts

The designer's **artwork** font catalogue (`FONT_FAMILIES` in `src/features/designer/catalog.ts`)
is a separate list the customer picks from for print. It is still unhosted — F4 Part C hosts it
and must outline or embed those faces in the print PDF.
