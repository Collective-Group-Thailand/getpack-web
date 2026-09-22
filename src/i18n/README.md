# `src/i18n` — copy and formatting

All user-visible strings, in Thai (default) and English, plus the formatters that make
numbers and dates look Thai.

Planned in F0 Session 0.2 and F1:

- `messages/{th,en}/*.json` with ICU plurals; a lint rule blocks hard-coded UI strings.
- next-intl config and routing: `th` at `/`, `en` at `/en` (customer zone only).
- `formatTHB` — takes the decimal **string** the API sends and never does arithmetic on it.
- Buddhist-era `formatDate`, rendered in `Asia/Bangkok`.
- The packaging glossary (Thai ↔ English) so the apps and the emails use one vocabulary.
