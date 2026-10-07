# `src/i18n` — copy and formatting

All user-visible strings, in Thai (default) and English, plus the formatters for money, dates
and dimensions. No component holds a hard-coded string; no component formats a baht or a date
by hand.

## Messages

`messages/{th,en}/<namespace>.json`, merged by `messages/index.ts`:

| Namespace  | Covers                                                                     |
| ---------- | -------------------------------------------------------------------------- |
| `common`   | brand, navigation, shared actions and states, theme, units, generic errors |
| `home`     | the customer home page                                                     |
| `designs`  | My designs                                                                 |
| `designer` | the box designer: toolbar, panels, box setup, print requirements           |

The loaders are written out one per file rather than globbed, so a missing namespace is a type
error and the bundler can see every file. F1 adds `admin` and `partner`, loaded per zone so
admin copy never ships to customers.

`messages.test.ts` asserts three things on every commit: the locales have identical key sets,
no string is empty, and the ICU placeholders in a Thai string match its English counterpart —
a `{length}` that becomes `{len}` in translation is otherwise invisible until a customer sees
it.

Copy style is in [`docs/ui/voice-and-tone.md`](../../docs/ui/voice-and-tone.md).

## Formatters (`format.ts`)

- **`formatTHB`** takes the decimal **string** the API sends. It groups the digits and pads the
  decimals as text; it never parses the amount into a number to add, subtract or round it, and
  a malformed value renders `฿—` rather than `฿NaN`. The API computes every total (CLAUDE.md).
- **`formatDate` / `formatDateTime`** render in `Asia/Bangkok` wherever the reader is, in the
  Buddhist era by default for Thai. `th-TH` already defaults to the Buddhist calendar in
  `Intl`, which would shift the year twice, so the tag is pinned to `ca-gregory` and the +543
  is explicit — that is what lets an accounting export ask for CE in Thai.
- **`formatIsoDate`** is for CSV and XLSX exports only (design-system.md §4: ISO in exports).
- **`formatMm` / `formatDimensions` / `formatNumber`** for the designer and dieline values.

No business-day or lead-time maths lives here, or anywhere in this repo — the API owns
business dates.

## Routing

`th` at `/` without a prefix, `en` at `/en`, `localeDetection: false` (see
`docs/PROGRESS.md`). Use the wrappers in `navigation.ts` rather than `next/link` inside the
customer zone so `/en` survives a navigation.

## Glossary

The packaging vocabulary (Thai ↔ English) is `docs/ui/glossary.md`; messages follow it. One rule
CI enforces (`src/ui/design-language.test.ts`), from Phase 4 §4.5:

| Where | Word |
|---|---|
| Customer copy — the step | ตรวจแบบก่อนพิมพ์ |
| Customer copy — the file | แบบตัวอย่าง ("ส่งแบบตัวอย่างให้ดู", "อนุมัติแบบตัวอย่าง v2", "ไฟล์และแบบตัวอย่าง") |
| Statuses, back office, factory app, page names | Proof, in English with a space either side ("รอ Proof", "Proof อนุมัติแล้ว", "ไฟล์งานและ Proof") |

The Thai transliteration of "proof", ตัวอย่างงานพิมพ์ and พิสูจน์อักษร are never used.
