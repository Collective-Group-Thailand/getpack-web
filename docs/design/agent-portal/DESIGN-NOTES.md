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

## P1 — entry points and two-step apply (D-466)

### Landing `/agent` (public, indexable, th + en)
- Same hero family as /business and /partner-with-us (light paper, two-column grid from 1280 px, the h1 with one
  `<em>` in the primary colour). No eyebrow (design-language test). Primary CTA "สมัครเป็นตัวแทน" → /agent/apply,
  secondary scrolls to the commission section; three trust ticks (free, no stock, WHT handled).
- Hero story (`AgentStory`): four scenes — share the link, a lead moving through stages, a quote sent, paid — drawn
  with placeholder lines, never an invented customer, order or date. The paid figure is the API's worked example.
- Commission: first/repeat rates from `store.agentProgramme.public`, a worked-example table (`th scope=row`, sr-only
  header row), "ไม่จำกัดรายได้" as the section title (D-464), and a calculator whose figures come from
  `store.agentProgramme.example` (debounced 300 ms, polite live region, text validated, "—" before a result —
  never "฿0"). The web does no arithmetic.
- How it works (3 numbered cards), benefits (5 cards), audience chips, FAQ (`details/summary`, FAQPage JSON-LD only
  when Marketing has published questions), final CTA band on the primary tint, link to /partner-with-us for makers.
- JSON-LD: BreadcrumbList, WebPage, FAQPage. Sitemap priority 0.6, llms.txt entry.

### Apply `/agent/apply` (step 1)
- Sign-in first (the application belongs to an account); agent / pending applicant are redirected to /account/agent;
  flag off → plain "not open" callout; no agreement → plain callout. Nothing promised.
- `ApplySteps`: two cards, `aria-current="step"`, so the applicant knows step 2 (tax, bank) comes later.
- Form: juristic segmented control, name, phone with inline OTP (a phone already verified at sign-in needs no code;
  any other number: send → 6-digit `OTPInput`, auto-confirm on complete, resend countdown), e-mail, LINE id,
  sales-channel checkboxes (2 columns from 640 px), pitch, agreement read in a `Sheet` with "อ่านแล้ว ยอมรับ"
  that ticks the box. One error summary callout focused on submit; per-field errors via `Field`.

### Payout profile `/account/agent/payout` (step 2)
- New "ข้อมูลรับเงิน" tab. A status callout (none / draft / submitted / verified / rejected with the reason) above
  the form; fieldsets disabled while Finance checks. The full account number is never shown again — the hint says
  which last four digits are on file and that blank keeps it. "ส่งให้ฝ่ายการเงินตรวจ" (save + submit) is primary,
  "บันทึกไว้ก่อน" secondary.
- Agent home: a warning callout links to the payout tab until the profile is verified (hidden while it waits).

### Entry points
- Header: "ตัวแทนขาย" in the bar from 74 rem only (the 1040–1184 px width budget stays as it was) and always in the
  drawer. Footer company column, /account card (only for non-agents while applications are open), /business and
  /partner-with-us text links. No "โรงงาน" in any agent surface (wording test).

### Admin — payout profiles (`/admin/agents/payout-profiles`)
- Same desk frame as ล.ย.01: status tabs with counts, warning tone on waiting rows; review shows the details as a
  definition list, documents as short-lived links, verify (If-Match) / send back (reason ≥3) in the action panel.
- Applications review: two-step applications show LINE id and channels; the bank section says details come after
  approval instead of empty rows.
