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

## P2 — getpack Agent zone `agent.getpack.co` (D-467)

Rules applied per screen, in the pack's priority order: accessibility → touch → performance → layout → typography →
motion → forms → navigation. Brand tokens and Anuphan everywhere; light only (`data-theme="light"`, no toggle); Lucide
icons from `src/ui/icons` (added `share`, `qr-code`, `smartphone`); copy from `agentZone` (new) and `agent` (moved
pages) in th/en.

### Shell (`AgentShell`, every page)
- **A11y**: one skip link to `main`; the header is a landmark with the getpack Agent mark (link home, named), the
  agent code (sr-only label on a phone, visible from 640 px) and the profile menu (`DropdownMenu`, named
  "เมนูโปรไฟล์", items with icons + text, sign-out last after a separator). Exactly one `<nav aria-label="เมนู
  getpack Agent">` is displayed at any width (tab bar < 640, rail 640–1023, sidebar ≥ 1024) — the others are
  `display:none`, so a screen reader meets one. `aria-current="page"` on the current destination; the current tab
  also gets a tinted pill behind its icon, never colour alone.
- **Touch**: tabs 56 px tall, rail items ≥ 56 px, sidebar rows 44 px, avatar button 44 px; 4–8 px gaps; press
  feedback `active:bg-bg-subtle` 100 ms.
- **Layout**: phone = four tabs only (ภาพรวม · ลูกค้ามุ่งหวัง · ใบเสนอราคา · ค่าคอม) — no "more"; customers and
  statements are reached from the overview counts and the ค่าคอม page header; account pages live in the profile menu
  on every size. Tablet = 72 px icon rail (icon over a two-line label) + the six destinations; desktop = 256 px
  sidebar in three groups (งานขาย / รายได้ / บัญชี). Content max 72 rem, gutters 16/24/40 px.
- **Safe areas**: `viewport-fit=cover`; header pads `safe-area-inset-top`; tab bar pads bottom/left/right insets;
  the main column pads `--mobile-tab-h` + 2 rem on phones so the last row never hides under the bar; the lead FAB
  and the install card sit above the tab bar.
- **Performance**: the shell is a server component; only the three nav variants and the profile menu are client
  islands. No realtime connection in this zone.

### Sign-in `/sign-in`
- Shared `AuthSplitLayout` (brand tone) with the agent app's own panel copy; the form is the storefront's
  `SignInFlow` (moved to `src/features/shared/customer-auth`) — phone OTP (six boxes, auto-verify, resend
  countdown, reference code), Google / Apple / LINE with their own button colours — sending `client: "agent"`.
- On a phone the panel steps aside, so the mark + "Agent" chip sit in the top corner; "ยังไม่เป็นตัวแทน? ดูโปรแกรม"
  links to getpack.co/agent. Terms / privacy / help open the storefront pages in a new tab.
- PDPA consent step runs as on the storefront; the shop's name-and-type step does not (not this app's concern).

### Hand-off `/handoff`
- One centred card with a spinner and one line while the code is redeemed; the code travels in the URL fragment and
  is wiped from the address bar before anything else happens. Refusal = one neutral line (`auth.handoff_invalid`
  problem copy) and a single "เข้าสู่ระบบ" action — no hint why.

### ภาพรวม `/`
- Hierarchy: greeting h1 → status / payout callouts (only when they apply) → the link card on the primary tint
  (QR 144 px on white, code at 30 px tabular, link, share actions, the remembered-days hint) beside two count cards
  that are links (customers, leads) → "ค่าคอมของคุณ" summary cards (the earned figure highlighted; all amounts are
  API strings through `formatTHB`) → plan terms and how it works in two cards.
- Share: primary "แชร์ลิงก์" (Web Share, else our sheet), secondary "คัดลอกลิงก์" and "แสดง QR".

### ลูกค้ามุ่งหวัง `/leads`
- Same `PortalTable` (cards on a phone, real table ≥ 768 px), status chips from `src/domain/status`. "ลงทะเบียน
  ผู้มุ่งหวัง" is the header button from 640 px and a floating action button above the tab bar on a phone (one
  dialog, two triggers). The manufacturers' note (D-464) links to the storefront's /partner-with-us in a new tab.

### ใบเสนอราคา `/quotes` (P2 content — decided)
- Not a placeholder: the way a quote reaches a customer today and counts as the agent's — three numbered cards
  (send your link → the customer sees an instant price or asks for a quote on the product page → they order, you
  earn), the link with the same share actions, "ดูสิ่งที่ลูกค้าเห็น" opening getpack.co/products, and a tinted band
  "ลงทะเบียนลูกค้ามุ่งหวัง" with the protection days from the API. Phase 3 replaces the body with the agent's quotes.

### ค่าคอม `/commissions`, รายงานค่าคอม + 50 ทวิ `/statements`, `/statements/{id}`
- Moved as they were (summary cards, `PortalTable`, pager); page titles now match the navigation labels
  (ลูกค้ามุ่งหวัง, ค่าคอมมิชชัน, รายงานค่าคอมและ 50 ทวิ). The ค่าคอม header carries "รายงานค่าคอมและ 50 ทวิ" because
  the phone has no fifth tab. An ended agent sees an info callout and the statements only.

### ข้อมูลรับเงิน `/payout`, ข้อมูลลดหย่อนภาษี `/tax`
- The P1 / P0 forms moved unchanged (visible labels, inline errors, `inputmode`, error summary on submit), uploading
  through the agent BFF's `/v1/store/files`.

### การแจ้งเตือน `/notifications`
- "แจ้งเตือนบนเครื่องนี้" first: one sentence of state and one action (turn on from a tap — never on load; turn off;
  denied / unavailable explained; on an iPhone in Safari, the Add to Home Screen guide instead, because iOS push
  needs the installed app).
- Then six events, each a `fieldset` (legend = event, one line of when) with three `Switch`es — แจ้งเตือนบนแอป
  (getpack Agent), LINE OA, อีเมล. Immediate save (a switch never needs a Save button), optimistic with rollback and
  a toast. Locked money e-mails are shown on and disabled with the reason under the switch. When `reachable` says
  LINE or e-mail cannot reach the person, an info callout above says why and where to fix it. Rows ≥ 44 px; switches
  stack on a phone, three columns from 640 px.

### โปรไฟล์และสัญญา `/profile`
- Two cards (agent: code, name, type, plan, since, link; agreement: accepted version + date, version in force, how a
  new version is handled), then "เครื่องที่เข้าสู่ระบบ": one row per session with surface (getpack Agent /
  getpack.co), sign-in method, dates, the device string and a "เครื่องนี้" badge; "ออกจากระบบเครื่องอื่น" asks first
  (`AlertDialog`) and never touches getpack.co.

### Not an agent / ended
- A signed-in customer who is not an agent gets the header only and one `EmptyState` (h1, one sentence, one action
  to getpack.co/agent — or to the application's status when one is open). An ended agent gets the statements only.

### PWA
- Manifest "getpack Agent" (standalone, `start_url`/`scope` "/", light page + white bar from the tokens), icons drawn
  from the brand mark on `primary-600` (192, 512, maskable with an 72 % safe zone, 180 apple-touch).
- `/agent-sw.js`: offline shell for navigations only (`/offline`: no data, no JavaScript needed), agent push, and the
  Phase 3 lead-draft sync hook. Figures are never served from a cache.
- Install card from the second visit, dismissible for good, floating above the tab bar (phone) or bottom-right
  (desktop); on iOS it opens the three-step Add to Home Screen sheet.
