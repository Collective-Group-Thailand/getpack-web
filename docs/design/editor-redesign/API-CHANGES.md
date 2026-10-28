# Studio editor redesign (C8) — API changes and requests

Branch `design/editor-redesign` (getpack-api `2c4cf49`, getpack-web). Decision **D-456** (getpack-api `docs/decisions.md`).

## Made (getpack-api)

| Change | Contract | Web use |
|---|---|---|
| `users.editor_mode` (`easy` / `pro`, null until chosen) — migration `20261229000001_c8_editor_mode` | — | — |
| `StoreMeDto.editorMode` (also admin / partner `me`) | `store.me.get` | `Studio.tsx` adopts it on open (`useEditorMode.adopt`); null → this browser's choice, else the first-open chooser |
| `PATCH /v1/store/me/preferences` `{ editorMode }`; `displayUnit` optional (at least one) | `store.me.updatePreferences` | every mode change of a signed-in customer is saved (guests: `localStorage` only) |

Types regenerated (`contract/openapi.json`, `contract.lock.json` → API `2c4cf49`); mocks keep each customer's mode.

## Not made — contract requests (see `docs/contract-requests.md` §"Studio editor (C8)")

1. **Server checks and renders understand the additive document fields** — `hidden`, `flipX/flipY`, `fillGradient`,
   `strokeDash`, `open` paths, `letterSpacing`, `lineHeight`, `mono`, `guides`. The browser's checks skip hidden
   elements and price gradients as process print; `evaluateDocument` (getpack-api `print-rules.ts`) still counts a
   hidden element. The order renders (D-280) are drawn from the canvas, so print files already show them.
2. **Variants** (one design, several versions with quantities) — pricing and ordering per variant; the "รุ่น" panel
   stays hidden until the API prices them and the business sets the per-variant minimum.
3. **Print-file export** — PDF/X-4 (CMYK, outlined text, die-cut layer), Illustrator `.ai` with layers, and PDF/.ai
   import placed on the dieline: needs Prepress's file spec; the existing exports (PDF for print, PNG, SVG, DXF,
   dieline PDF) are what "ส่งออก" offers.
4. **Price of the alternative print** — "เปลี่ยนเป็น CMYK" shows the price change before it is applied: a quote for
   the same version with another print (studio), as the guest dock already can with `calculate`.
