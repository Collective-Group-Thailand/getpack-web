# getpack Agent — design notes (per phase, per screen)

Method: the pack's `<design-method>` in priority order (accessibility → touch → performance → layout → type/colour →
motion → forms → navigation). The `ui-ux-pro-max` skill is installed in the autorun workspace, but its `search.py`
could not be executed there (workspace policy), so its rules were applied from the pack and the skill's reference
files read as text. getpack tokens, Anuphan and the light theme win over any skill suggestion.

## P0 — rules (account area, temporary home of the agent pages until Phase 2)

### Plan terms (`PlanTerms`, `/account/agent`, join page)
- Copy: first %, repeat % with months, then "ไม่จำกัดรายได้ ยิ่งขายมาก ยิ่งได้มาก" in the foreground colour and medium
  weight (the one promise the list makes), then the minimum base (only when set) and when it is paid. No cap, margin,
  profit or factory bounty wording (contract test + i18n deny test).
- Same list semantics as before (`ul`, disc markers), so screen readers announce the count.

### Lead form (`RegisterLead` dialog)
- The customer / factory segmented control is gone (P-03): one less decision, labels unchanged.
- A short neutral note under the form links to /partner-with-us ("หน้าสมัครพาร์ทเนอร์") — link text says where it
  goes; no "โรงงาน" word in the agent area (GLOBAL-RULES §1).

### ล.ย.01 (`/account/agent/tax`)
- Forms: visible labels on every field, hint "บาทต่อปี" under each, `inputMode="decimal"`, inline errors per field
  through `Field` (aria-describedby), one form-level callout for API refusals.
- Grouping: four `fieldset`/`legend` groups in the Revenue Department's order (ครอบครัว · ประกันและการออม ·
  ที่อยู่อาศัย · บริจาค) — scannable, and the legend is announced with each field.
- Layout: mobile-first single column; two columns of fields from 640 px; the year / total / sent summary sits in an
  aside from 1024 px (stacks under on phone). No horizontal scroll at 360–1920 (e2e).
- Waiting state: when a declaration waits for Finance the fieldsets are `disabled` (not hidden) and an info callout
  says when it can be sent again — predictable, no dead end.
- Money: amounts validated as text and sent as decimal strings; the page shows the API's total only.
- Evidence: the shared `FileDropzone` (drag or browse, type and size errors in words), uploads announced in a
  polite live region.

### Statement detail (`/account/agent/statements/[id]`)
- WHT summary card reads "คำนวณเมื่ออนุมัติ" before approval instead of a dash; the side list names the method
  ("บุคคลธรรมดา: คำนวณตามอัตราก้าวหน้า" · "นิติบุคคล: 3%"). The 50 ทวิ download is unchanged.

### Admin — ล.ย.01 queue and review (`/admin/agents/tax-declarations`)
- Same desk frame as the applications queue (status tabs with counts, search, warning tone on waiting rows).
- Review: allowances as a two-column definition list with tabular numbers and the API total; evidence as buttons
  that open short-lived links in a new tab; accept / reject in the action panel, reject needs a reason (min 3).

### Admin — statement detail
- New "การคำนวณภาษีหัก ณ ที่จ่าย (D-465)" section: method, YTD, projected year, allowances, annual tax — every figure
  the API's. "แนบใบกำกับภาษี" action for company agents before approval (number + file, If-Match).
