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

## P3 — lead management (D-468)

Rules applied per screen, in the pack's priority order: accessibility → touch → performance → layout → typography →
motion → forms → navigation. Copy in the new `agentSales` namespace (th/en, `src/i18n/messages/*/agent/sales.json`),
statuses from four new maps in `src/domain/status` (`AGENT_LEAD_STAGE`, `AGENT_QUOTE_STATUS`,
`AGENT_DISCOUNT_REQUEST_STATUS`, `AGENT_FORECAST_STATUS`) — icon + words + tone, never colour alone. No new font,
no dark surface, no illustration; the empty states teach with the product's own chips.

### ลูกค้ามุ่งหวัง `/leads`
- **Views** as the product's segmented `ViewTabs` (ทั้งหมด = the open pipeline · ต้องติดตามวันนี้ · ใกล้หมดสิทธิ์ ·
  ปิดแล้ว), each a link (`?view=`), so back and share work. Filters (stage, sort) live in the URL too.
- **Phone** cards (name as the link, organisation, stage chip top-right, follow-up line — overdue in danger tone with
  a flag icon, today in warning tone —, protection countdown in Bangkok calendar days, warning tone in the last week,
  expected value, source); filters in a bottom `Sheet` (radio cards, one "ดูผล", safe-area footer); the FAB sits above
  the tab bar. **Tablet** the same cards in two columns. **Desktop** a real table (caption, `scope`, sortable headers
  as links with `aria-sort`), protection and "updated" fold under the name below 1280 px so 1024 never scrolls the page
  (the table's own wrapper is `relative` so its `sr-only` labels cannot widen the page).
- **Stage change** is a `DropdownMenu` button "ย้ายไปขั้น…" on every card and row (Enter / arrows / Esc; `won` is never
  offered — the system's). The desktop board (`?layout=board`) adds HTML5 drag between columns as an enhancement; a
  hidden hint names the menu as the alternative (WCAG 2.5.7). Lost opens a dialog: reason (radio cards, required) +
  note, with the consequence stated (protection ends, cannot reopen).
- **Export** asks the API for its 5-minute link and downloads it; **import** is a header button (a link on a phone).
- **รอส่ง**: leads saved offline sit above the list in a warning-tinted panel, each with a "รอส่ง" or "ส่งไม่ได้" badge
  (with the problem's words) and a ≥ 44 px remove button; `role="status"` says whether the device is offline.

### New lead (FAB · header button · `N`)
- One form, a bottom sheet below 640 px (thumb zone, 92 dvh, sticky Save/Cancel with the safe-area inset) and a dialog
  above; `N` opens it on a desktop unless the focus is in a field, menu or dialog (the header button shows the `Kbd`).
- Fields: visible labels; `autocomplete` name / organization / tel-national / email; `inputmode` tel, email, numeric,
  decimal; `enterkeyhint`; e-mail without autocapitalise. Contact fields grouped in a `fieldset` with its legend.
- **Duplicate check on blur** of phone, e-mail and tax id: own lead → info callout with a link to it; anything else →
  the one neutral sentence of `agents.lead_unavailable` and a next step, never who holds it (D-440).
- **Card scan**: a strip at the top of the form ("มีนามบัตร?") opens the rear camera (`capture="environment"`; the
  multi-shot `CameraCapture` was not used — one photo, no gallery), shows the photo, uploads (`agent_card_scan`), reads,
  and fills the form; every filled field says "จากนามบัตร", and the unsure ones (< 0.8) get an amber ring and
  "อ่านได้ไม่ชัด ตรวจอีกครั้ง" until edited. `file.not_ready` is retried with backoff.
- **Follow-up** quick choices พรุ่งนี้ 10:00 · 3 วัน · 1 สัปดาห์ (Bangkok calendar), or a `datetime-local`.
- Offline (or a network failure) keeps the lead in IndexedDB and registers background sync; a Web Lock shared by page
  and service worker keeps a draft from being sent twice.

### Lead detail `/leads/{id}`
- **Desktop split view**: the open pipeline as a sticky list on the left (`aria-current="page"`), the lead on the
  right; the page's own back link hides there. Phone: full page.
- Header: name (h1), stage chip, organisation; a summary card with protection, expected value, registered date, the
  **deal badge** ("ดีลนี้ถูกจองแล้วถึง …", locked first / repeat rate, success tone + shield icon) and the actions.
- **Actions**: from 640 px a row (โทร · LINE · บันทึกการติดต่อ · ส่งใบเสนอราคา primary); on a phone the sticky
  `MobileActionBar` above the tab bar — four icon-over-label targets ≥ 56 px, side safe-area insets. LINE opens the
  contact's LINE id (`line.me/R/ti/p/~id`) or, without one, LINE's share with a greeting. A closed lead keeps call and
  LINE only.
- **Follow-up** panel (quick choices, own date, "ไม่ต้องเตือน"), saved with `If-Match`; a stale ETag reloads and says so.
- **Timeline** (`Timeline`): agent entries, quotes sent (with a link), stage moves "จาก … ไป …", system events with their
  own icon and tone (opened = primary eye, converted / won = success), author and Bangkok time on every line.
- **Details** with "ยังไม่มี…" for empty fields and an edit dialog (contact keys read-only once a customer);
  the contextual **playbook card** collapsed beside it (first contact, follow-up, discount, big deal, lost on price).

### ใบเสนอราคา `/quotes`, quote on behalf `/quotes/new`, quote `/quotes/{id}`
- **Decision**: the storefront's configurator lives in the customer zone and brings the studio, samples, cart and
  analytics with it; moving it to `src/features/shared` was too large to finish safely in this phase. The agent zone
  has its own focused flow on the same contract (PROMPT P3 Web 4 fallback): product grid (catalogue thumbnails through
  this zone's BFF) → the product's D-441 default spec with size, material, up to three quantities and postcode → the
  store's live price (`store.quotes.calculate`, debounced, an answer counts only for the spec it was asked for) →
  review (spec lines, prices per quantity, validity days from the API) → create → share (P2 `ShareLink`: Web Share,
  copy, LINE, QR). Phone: sections collapse to their summary, the price sits in a sticky bar above the tab bar;
  desktop: all open with a sticky price card. A `ProgressTracker` shows the four steps from 768 px.
- List: status tabs, `PortalTable` (cards on a phone, table from 768 px), deal mark, "opened" date under "sent";
  the empty state shows the status path (ส่งแล้ว → ลูกค้าเปิดดูแล้ว → ลูกค้าตอบรับแล้ว) and sends the agent to leads.
- Quote page: facts, prices, share card, a "จัดการใบเสนอราคา" card (จองดีล for a smaller quote, new link, withdraw with
  an `AlertDialog` naming the customer), and the discount panel.

### Discount request `/quotes/{id}/discount` and the options
- Three steps with a `ProgressTracker`: **1 ลูกค้าให้อะไรกลับมา** first — six give-get cards (checkbox + one line why;
  a chosen card spans the row and opens its one field), at least one required, then the % asked; **2** reason (radio
  cards) and, for a cheaper competitor, their file (`evidence` upload) and a like-for-like spec form; **3** review in
  words with "what happens next". Errors inline and in a live callout.
- The playbook's discount cards sit beside the form on a desktop (sticky) and above it, collapsed, on a phone.
- A waiting request says "รอ getpack ตอบ" with what will happen — no time promised (P4 has no desk yet).
- **Options** are plain lines "ลูกค้าได้ส่วนลด 4% · คุณได้ ฿607.20" (API figures only), the net before VAT, the rate (vs
  the usual one), the conditions line and the deadline; ordered by `position` so the full-rate option is first and
  primary. Choosing asks first; a **co-fund** option's dialog states the amount and the rate change and keeps Confirm
  disabled until "ฉันยอมรับค่าคอม ฿… สำหรับดีลนี้" is ticked; one `Idempotency-Key` per decision. No cost, margin or
  share-of-profit anywhere.

### คู่มือการขาย `/playbook`
- Reached from the sidebar, the tablet rail and the profile menu (the phone keeps four tabs). Search as you type over
  titles, bodies and replies; situations as toggle buttons (`aria-pressed`); a live count. Cards render the API's
  Markdown (paragraphs, lists, a scrollable table region) as elements — never injected HTML — and each suggested
  reply has "คัดลอก" and "ส่งทาง LINE".

### CSV import `/leads/import`
- File pick or paste, consent tick, the template (header + one obviously fake row, BOM) beside it with every column
  explained; the dry run as `PortalTable` with each row's problems in words and a "only rows with problems" switch;
  commit with `Idempotency-Key`; a done state with the counts and the way back.

### ค่าคอม — forecast `/commissions?view=forecast`
- A second view beside the entries (same `ViewTabs`): the total still to come on the primary tint with the system's
  payment rule in words (no "5th"), a payout-profile callout when it is not ready, then per order: status chip,
  expected commission with its base and rate, "ภายใน {date}" or "ยังไม่มีกำหนด", and what it waits for in words.

### Storefront `/q/{token}`
- A factory's quotation link renders as before; a store quotation an agent sent goes through `/q/{token}/open`, which
  sets `pk_agent` exactly as `/a/{code}` (same name, lifetime, flags) and opens the quote in the configurator
  (`?share=`). Signing up then claims the code (existing `AgentLinkClaim`).

### Notifications
- Two more fieldsets in the matrix: ถึงเวลาติดตามลูกค้า (no quiet-hours times in the copy — they are a setting) and
  ลูกค้าเปิดดูใบเสนอราคา.

## P4 — company sales desk and discount approvals (D-469, D-470)

Admin zone, desktop-first and usable at 1024 (inbox and pipeline also at 768). Rules applied per screen in the pack's
priority order: accessibility → touch → performance → layout → typography → motion → forms → navigation; the dataviz
method for every chart (form first, colour last, one measure per chart, thin marks, hover and focus on every mark,
figures for a screen reader). Copy in the new admin namespace `sales` (th/en, `src/i18n/messages/*/admin/sales.json`);
the agent zone's `agentSales` is loaded in the admin zone too, because the lead components are shared. Statuses from
seven new maps in `src/domain/status/sales.ts` (inbound, approval, authority colour, floor check, playbook card,
negotiation outcome, price lock) — icon + words + tone, never colour alone. Anuphan only, light surfaces only, Lucide
only (two registry additions: `briefcase` for the menu, `desktop` for the preview frame). No "กำไรสุทธิ" anywhere: the
bottom line is "กำไรหลังหักค่าคอม".

### Shared lead components (`src/features/shared/sales`)
- The P3 pipeline pieces moved out of the agent zone (stage menu, lost dialog, card, table, board, timeline, playbook
  card, markdown, dates, phone) and take a `surface` (`agent` | `admin`) that binds the change-stage endpoint and the
  links; the agent zone keeps re-exports at the old paths, so its pages did not change. Same stage rules, same
  "ย้ายไปขั้น…" menu (WCAG 2.5.7), drag only as a desktop enhancement; a freelance agent's lead on the desk is
  read-only (no menu, no drag).

### Section nav "ฝ่ายขาย"
- The API's menu entry `sales` (any pipeline permission) opens `/sales`. The desk's pages are a `SectionNav` (in the
  sidebar on a desk, a scrolling line on narrow screens), each item offered only to who holds its permission.

### งานเข้า `/sales` (inbound pool)
- `ResourceList` with status `QueueTabs` (counts from the list itself), soonest first response first. The SLA column
  is `SlaTimer` (text + icon, danger when breached; the API's `slaBreached`, never a client threshold); answered rows
  say "ตอบแล้ว / ตอบเกินเวลา" with the time. Breached open rows take the danger row tone, new ones warning.
- Bulk assign (managers only) from the selection bar; one dialog for one or many: "ให้ระบบเลือก (เวียนตามคิว)" first
  and pre-selected, then each rep as a radio card with their open load and agent code; unavailable reps disabled with
  the reason. Moving an enquiry from another rep shows a required reason field (the API's rule, said before sending).
- Row actions in one menu button (named "การทำงานของ {name}"): assign / reassign, contacted (optional note), convert
  (disabled with the neutral reason when the contact cannot be a lead — D-440), disqualify (reason radio cards). The
  rep's view is the same list the API scopes; manager-only actions are hidden with `useCan`.
- Manual entry: visible labels, `autocomplete` name / tel-national / email / organization, `inputmode`, phone
  normalised to E.164 before sending; at least one way to reach is said inline.

### ลูกค้ามุ่งหวัง `/sales/pipeline`, lead `/sales/leads/{id}`
- Views as `ViewTabs` links (ทั้งหมด · ต้องติดตามวันนี้ · ใกล้หมดสิทธิ์ · ปิดแล้ว); managers add "พนักงานขาย / ตัวแทนอิสระ"
  and a rep filter (links, so back and share work); table ↔ board toggle from 1024. Below 1024 the shared cards in two
  columns. The manager's table gains a "ผู้ดูแล" column through the shared table's `extraColumn`.
- Lead page: header with stage chip, organisation and who works it; actions log a contact, stage menu, new quote. The
  quote list shows each quote's latest discount round (status chip, asked % and round), the approval link and the
  options offered in words; "ขอส่วนลด" asks give-get first (at least one), then the percentage and reason. The timeline
  is the shared one. Managers get a link to the customer's negotiation history.
- New quote: the rep starts from a spec the desk already priced (radio cards: product, spec words, the code and when it
  was quoted) and sets quantity and postcode — the staff zone has no configurator a rep may open (contract request
  `admin.salesQuotes.products`).

### ภาพรวมทีม `/sales/dashboard`
- Filters in one row above everything they scope: range (30/90/180 days), period (เดือน/สัปดาห์), seller kind; CSV at
  the end of the row (export endpoint, 5-minute link). A refetch keeps the frame at 60 % opacity — no skeleton jump.
- KPI row of five stat tiles (proportional figures, no tabular-nums at display size): leads, won, win rate (with "ได้ ·
  ไม่ได้" under it), open value, first-response SLA (with a meter, success ≥ 90 % else warning — the meter is
  reinforcement; the figure and words carry it).
- One measure per chart: the funnel as ranked horizontal bars (ordinal stages, one hue), drop-off as words beside each
  step; won per period and new leads per period as two column charts (the brief's "win rate trend" needs a per-period
  rate the API does not send — asked; the web never divides the counts); leads by source (ranked bars, won and rate in
  the readout); median days per stage (grey bars — context, not the story); reps as a table (the honest form for five
  measures per person); reps vs freelance as two side-by-side tiles. New `src/ui` primitives `BarList` and
  `ColumnChart` (`DataBars.tsx`): ≤ 24 px marks, 4 px rounded data end, hairline grid, the latest period in the brand
  colour and earlier ones in its tint (emphasis), each mark a hover and focus target with its readout, named for a
  screen reader.

### อนุมัติส่วนลด `/sales/approvals`, `/sales/approvals/{id}`
- Queue: pending first by due time with the SLA timer and "ส่งต่อระดับถัดไปแล้ว", the asked % (explained figure), the
  authority chip, the deciding level ("เลื่อนขึ้นหนึ่งระดับ" when negotiation-heavy raised it), round, status. No cost or
  margin figure in a summary.
- Detail: a header strip (quote + validity, customer + negotiation-heavy, seller + kind + who asked, deal
  registration); "สิ่งที่ขอ" with the give-get as chips in words; the competitor comparison as a table — getpack and the
  competitor side by side, line for line, "ไม่ตรงกัน" marked in words.
- Waterfall drawn from the payload's `visibility`, nothing hidden client-side: `full` = `BridgeChart` (new `src/ui`
  primitive): a vertical bridge read top to bottom like a P&L, totals on zero, changes hanging from the running total,
  deductions grey and increases a light brand tint with the sign always printed, the bottom line "กำไรหลังหักค่าคอม" in the
  brand colour and bold, the margin floor as a dashed line through every row (geometry from the parsed numbers; every
  number shown is the API's string), "ยังไม่ได้ตั้งค่า" notes on unset fees and provisions, the viewer's name repeated
  faintly behind the drawing, and a table toggle (always read by a screen reader); each row is one hover and focus
  target with definition, formula, source and as-of time. `margin_pct` = four figure tiles and two bars against the
  dashed floor with the floor-check chip. `authority` = the colour chip with its words only.
- Simulator: five fields (discount, credit days, payment schedule when the role may read templates, deposit, option
  rate), debounced 400 ms, `aria-live` result with the level needed and a compact waterfall in the caller's tier.
- Decision panel (sticky on wide screens, primary tint): the options builder — option 1 "ค่าคอมปกติ" fixed and
  pre-filled with the asked %, up to two co-fund / spiff rows with the rate rule as a hint — then อนุมัติ (primary),
  เสนอกลับ, ไม่อนุมัติ (danger text). A confirm dialog says what the seller will see; reject and counter need a note;
  a self-approval reason appears only when the viewer asked; one `Idempotency-Key` per decision. Export only with
  `discount_approvals.export`.
- View log `/sales/approvals/views` (auditor): when, who, quote (linked), tier in words, purpose.

### คู่มือการขาย `/sales/playbook`, `/sales/playbook/{id}`
- List with status tabs and "รอเผยแพร่" for submitted drafts. Editor and live preview side by side from 1280 (stacked
  below): the preview is the agent zone's own `PlaybookCard` in a phone frame (360 px) or a desktop frame, switched by
  a segmented control; it updates as you type. Contexts and audience as checkboxes, suggested replies as a list (≤ 10),
  a change note; the three steps (บันทึก → ส่งตรวจ → อีกคนเผยแพร่) are written above the buttons, and the publish
  button says why it is disabled ("ผู้เขียนหรือผู้ส่งตรวจเผยแพร่เองไม่ได้ ต้องให้ฝ่ายการตลาดหรือผู้จัดการฝ่ายขายอีกคน
  เผยแพร่"). Versions listed with status and change note.

### รายงาน
- ประวัติการต่อรอง: quick picks of the desk's recent customers, the rule for "ต่อรองราคาสูง" in words, the flag as a
  warning callout, rounds per quote with outcome chips, lost reasons and the last competitor.
- แพ้เพราะราคา: product class × quantity band as a table; cells shaded in one hue by share in three steps with a legend,
  the count under each percentage — the shade never carries the meaning alone.
- ทบทวนหลังปิดดีล: group by approver / seller / customer (segmented); approved vs actual side by side per cell; the full
  tier adds the amounts — the page draws the variant the API sent.

### Every number explains itself
- `FigureTip` (new `src/ui` primitive) wraps a figure in a focusable span with a dotted underline; the tooltip (hover
  and focus, Escape closes) holds the definition and formula from `sales.figures.*`, the source (with the record's link
  where there is one) and the as-of time. Chart rows carry the same text in their readout.

## P5 — automatic lead capture and scoring; the dieline download stays free (D-471)

Method: ui-ux-pro-max targeted searches only ("popover keyboard focus", "sortable table aria-sort", "bottom sheet mobile
modal", domain ux); getpack tokens and Anuphan win. Quick Reference §1–§3 applied as the pre-delivery pass.

### Dieline download (style page, quick view)
- The form is open to everyone: signed out, a quiet line under the button says the first download needs no sign-in;
  after it, the line changes to "ครั้งต่อไปเข้าสู่ระบบก่อน แล้วดาวน์โหลดต่อได้ฟรีเหมือนเดิม" — the second request is
  expected, never a surprise wall. Copy says "ฟรี" throughout; no price, no "฿0", no plan word.
- Second download → the existing sign-in surface (480 px dialog ≥ md, bottom sheet below, thumb zone) titled for the
  task "ดาวน์โหลดต่อได้ฟรี" with one line on what happens next. `providersFirst`: Google, Apple, LINE on top (one tap
  back to the task), then a divider "หรือใช้เบอร์มือถือ" and the phone OTP form. Visible labels, tel input, focus ring on
  every control (Radix dialog keeps focus inside; Esc closes).
- After sign-in the same file downloads by itself — no second tap. The interrupted request is held in sessionStorage
  (style code and sizes only), so a LINE login that leaves the page continues too, once. The button reads
  "กำลังดาวน์โหลดต่อ…" while it does.
- The device id is a first-party httpOnly cookie set by the BFF (never readable by script); nothing in the UI shows it.

### Score chip (`src/ui/components/ScoreChip`, new primitive)
- 24/28 px pill: the number in tabular figures beside a 14 px ring that fills with it — a column scans by shape before
  it is read; the ring is `aria-hidden`, the label carries the scale ("คะแนน 72 จาก 100"). Not scored = an en dash with
  "ยังไม่มีคะแนน" for screen readers, never a 0.
- Tone by thirds of the scale from `src/domain/status` (`leadScoreTone`) — presentation only, no band names ("hot")
  because the rules are the API's and name none. Colour is never the only carrier: the number is always printed.
- Interactive variant = a real `<button>` with a chevron, 32 px hit area around the chip (`before:` inset), visible
  focus ring, hover / open state on the surface tint; 150 ms colour transition only.

### Reasons popover (staff: inbox, pipeline table and cards, lead detail lists)
- Radix popover (non-modal, `aria-expanded` / `aria-controls` on the chip, `role="dialog"` named "ทำไมได้ 72 คะแนน"):
  Enter / Space opens, Tab moves through and out, Esc closes and focus returns to the chip.
- Content: the score over "เต็ม 100", an ordered list of the top three reasons in words with signed points in small
  tinted pills (positive success-subtle, negative neutral — "−5", a real minus), and a footnote that the rules are the
  sales manager's and what the score is for (who to contact first), with the scored time.
- Agents get the chip as a plain label on their own leads — no button, no reasons (the API never sends them).

### Inbox `/sales`
- New "คะแนน" column right after the contact, sortable (DataTable `aria-sort`, server-side `sort=score`, highest first,
  unscored last). Filter "คะแนนขั้นต่ำ" with reading presets 80 / 60 / 40 (not business thresholds).
- Source column: a 28 px icon tile per source from `SALES_INBOUND_SOURCE` (mail, calculator, pen-tool for "ออกแบบแล้ว
  ยังไม่สั่ง", download for "ดาวน์โหลดแบบแผ่นคลี่", line, edit) beside the words and the reference; "กลับมา 3 ครั้ง" for
  repeat signals; a small shield-check "ยินยอมรับข่าวสาร" on captured items so a rep sees the PDPA basis before calling.

### Pipeline (admin) and agent zone leads
- Table: score column after the lead, sortable by link (`?sort=score`, survives reload, shareable). Cards (phone /
  tablet): the chip under the stage chip, right-aligned. Admin pipeline adds a segmented "คะแนน: ทุกคะแนน · 60 ขึ้นไป ·
  80 ขึ้นไป". Agent zone: the sort sheet / select gains "คะแนนสูงก่อน".
- No horizontal scroll 360–1920 on the style page (dieline open) and the agent leads page (e2e).

## P6 — management P&L planner `/finance/pnl` (D-472)

Method: the dataviz skill (form → colour by job → validator → marks → hover → a11y) for the summary and the two
charts; getpack tokens, Anuphan and the existing admin console patterns win everywhere else. Light theme only.

### Where it lives and who sees it
- A desk "งบกำไรขาดทุนบริหาร" in a new finance group "วางแผน", offered only with `pnl.read` (C-Level, VP, Director,
  Finance Manager, Superadmin). Anyone else who types the address gets the shared 403 state ("คุณไม่มีสิทธิ์เปิดหน้านี้"),
  and the API refuses their BFF calls. Directors hold no other finance permission, so the mock adds `pnl.read` to the
  finance menu gate as a contract request (`admin.menu-pnl`).
- `pnl.manage` draws create / recompute / copy / lock and editing; `pnl.export` draws the export menu. VP and Director
  read: a quiet neutral callout says so, the grid is `aria-readonly`, empty manual cells print "—" not "กรอกค่า".
- "ข้อมูลลับ": nothing of the planner reaches any other zone; exports are the API's watermarked files (5-minute link).

### Plan bar
- Row 1: year (Buddhist era in Thai), scenario as a segmented control (ฐาน · ดีที่สุด · แย่ที่สุด · กำหนดเอง), the plan of
  that year and scenario ("name · ฉบับที่ n · ล็อกแล้ว"). Row 2, under a hairline: the status badge (draft = pencil,
  locked = lock, from `PNL_PLAN_STATUS`), computed / locked by whom and when, the owner — then the actions on the
  right: the "เทียบกับจริง" switch, คำนวณใหม่, คัดลอกเป็นสถานการณ์อื่น, ส่งออก ▾ (Excel / PDF / plan vs actual Excel, with
  the watermark note as the menu heading), ล็อกแผน as the one primary button.
- The open plan lives in the address (`?plan=`, or `?year=&scenario=` for a scenario with no plan yet; `?view=variance`).
- A scenario with no plan is an empty state with the next step: copy from this year's other plan, create, or (a
  reader) open the latest plan / back to the finance overview — never a dead end.
- Lock is an AlertDialog that restates the plan and warns "ยังมีช่องที่ต้องกรอกเองว่างอยู่ n ช่อง — ช่องว่างนับเป็นศูนย์";
  `If-Match` = the plan ETag, one `Idempotency-Key` per opening of the dialog.

### Summary strip
- Seven figures from `PnlSummaryDto`, never added up in the browser: four headline figures (รายได้สุทธิ, อัตรากำไรขั้นต้น,
  กำไรหลังหักค่าคอม, กำไรสุทธิ) over three supporting ones (EBITDA, วงจรเงินสด, ยอดขายจุดคุ้มทุน) on a 12-column grid with
  hairline gaps, so neither row has a hole; on a phone two columns with the last figure across.
- The net profit tile takes the API's own line label ("กำไรสุทธิ"); contribution is "กำไรหลังหักค่าคอม", never "กำไรสุทธิ".
  A negative net profit is printed with a true minus and in the danger ink — the sign carries it, the colour repeats it.
- Every figure is a `FigureTip` (dotted underline, focusable): definition, formula, source, as-of = the compute time.

### Charts
- Two charts, one measure each (net revenue, net profit by month), one value axis each — never a dual axis. Without
  the variance switch they draw the plan (one series, the title names it, no legend box); with it they pair แผน with
  จริง for months that have an actual.
- Colours: a new validated pair in `Chart` — `plan` blue-400 #81afff, `actual` brand-600 #24907a. The dataviz
  validator passes the lightness band, chroma floor, CVD separation (ΔE 20.2 deutan) and the normal-vision floor;
  `plan` is under 3:1 on the surface, so the legend is always drawn and the table view (`ดูเป็นตาราง`) is one click away
  and is what a screen reader reads. Ticks compact (2.4M), tooltips and table exact (two places).

### Grid (tablet and up)
- A real `<table role="grid">`, one tab stop (`useGridNavigation`, new in `src/ui/lib`): arrows, Home / End,
  Ctrl+Home / End, PageUp / PageDown; Enter or F2 (or typing a number) edits, Escape cancels and returns focus to the
  cell, Shift+Enter opens the drill-down. A band's header row is one cell across the grid: Enter / Space folds it.
- Bands read like a statement: รายได้ · ต้นทุนขาย · กำไรขั้นต้น · ค่าใช้จ่ายขาย · ค่าใช้จ่ายบริหาร · กำไรจากการดำเนินงาน ·
  ดอกเบี้ยและภาษี · กำไรสุทธิ; the memo band sits below a 4 px rule labelled "ไม่รวมในกำไรสุทธิ". Folding a band keeps its
  calculated lines (net revenue, the tax estimate) and hides the inputs. Inputs are indented; subtotal rows are bold
  over a strong top rule; net profit has a double-weight rule and a tinted label cell.
- First column (line names) and the header (month, then จริง / คาดการณ์ / ยังไม่ปิดงวด with its own icon) are sticky; the
  frame scrolls both ways inside itself (max height = viewport − 9 rem) — the page never scrolls sideways. The year
  column is tinted with a strong left rule. Forecast months sit on the subtle ground behind a dashed rule.
- Figures: tabular numerals, right-aligned, two places, no ฿ (the unit "บาท ไม่รวม VAT" is in the title), a true minus.
- Source marks (`CellMark`, new `src/ui` primitive): a 16 px hairline tile with a shape per mode — zap ระบบ, calculator
  คำนวณ, pencil กรอกเอง (primary tint), flag แก้ทับ (warning tint, the only warm one). The shape and the words (`role=img`
  label, legend chips in the grid header) carry the meaning; the tint only repeats it.
- An override prints both values: the person's figure, and under it "ระบบ ~~3,721,222.57~~" muted and struck.
- An empty manual cell shows a dashed "กรอกค่า" chip to someone who may fill it (click opens the editor). The editor is
  the value in the cell plus a small raised panel under it: the note field when the cell's first value needs one
  ("ที่มาของตัวเลข", placeholder = the line's how-to-fill), Save / Cancel; errors in words under the field.
- Every save sends `If-Match` = the cell ETag; a 412 reloads the grid and says "มีคนแก้แผนนี้ก่อนคุณ — โหลดตัวเลขล่าสุดให้แล้ว".

### Tooltips and drill-down
- Every line name (and the year cell) explains the line in four labelled parts: definition, สูตร, ที่มา (with its GL
  accounts and posting-rule filters), วิธีกรอก — a line nobody fills says why ("คำนวณจากบรรทัดอื่น ไม่ต้องกรอก").
- Every cell: the line · month and its mark, definition, formula, the source in words with its inputs (accounts,
  entries, window, ratio, deals / run rate, assets, tax rate), actual or forecast month and an open-period warning,
  as-of; for a person's value who and when, and the note or the reason; for an override the system value.
- English catalogue texts are `null` in the API (PNL-LINES.md is Thai only) — the planner falls back to Thai.
- "ดูรายการที่มา (Shift+Enter)" opens a side sheet (30 rem): records with code (linked to the journal, lead, company,
  asset or commission list), amount, description, date · account; tabs where a cell has two kinds (deals / repeat
  customers, journal lines / commissions); 25 at a time with "แสดงเพิ่ม". A tooltip holds no tab stop, so the keyboard
  path is the Shift+Enter shortcut, printed in the grid's key line and in the tooltip.

### Override dialog
- The system figure stays in view at the top (its source as a mark chip), then the new value (right-aligned), then a
  required reason (the previous reason as the hint when changing an override). "กลับไปใช้ค่าระบบ" sits apart on the left;
  แก้ทับ (flag icon) is the primary action.

### Plan vs actual
- The switch swaps the grid for the variance grid (same bands, same keys). A cell leads with the actual, then
  "แผน …", then the variance with a trend arrow and the words "สูงกว่าแผน / ต่ำกว่าแผน" for screen readers and a signed
  figure and percentage — never judged good or bad (a higher cost and a higher revenue read the same way).
- Months without an actual show the plan muted and "ยังไม่ถึงงวด"; lines with no actual in the system say so. Totals
  cover the months with actuals only (said in the key line).
- Enter or a click writes a variance note (3–1,000 characters), also on a locked plan; a noted cell carries a speech
  icon labelled "มีหมายเหตุ", and the tooltip shows the note with who and when.

### Phone
- Summary strip, then one card per month (read-only): month and its standing, net revenue, gross margin, operating
  profit and net profit (bold), the count of manual cells still empty; with the switch on, actual over plan. Forecast
  cards sit on the subtle ground. Create / recompute / copy / lock and the charts are not drawn below 768 px; a line says
  editing is for a tablet or a computer.

## P7 — QA, pilot switch and launch readiness

### Responsive QA (`e2e/agent-portal-p7-responsive.spec.ts`)
- Every route the pack added — `/agent` (th, en), `/agent/apply`, all getpack Agent pages (home, leads list and board,
  a lead, import, quotes, a quote and its discount request, new quote, commissions and forecast, statements and one
  statement, customers, payout, tax, playbook, notifications, profile, sign-in, hand-off, offline), the admin sales
  desk (inbox, pipeline list and board, a lead, quotes, dashboard, approvals list / detail / views, playbook list and
  card, the three reports), the agents' waiting list and the P&L planner — at 360, 375, 393, 768, 1024, 1280, 1440
  and 1920, with four checks in one pass (`e2e/helpers/responsive.ts`):
  1. the page never scrolls sideways;
  2. no visible element reaches past the viewport's sides unless a container that scrolls sideways holds it (a
     page-level wrapper does not count) — a clipping container cuts the element's visible part to its own box, which
     must be on screen (a truncated name inside a card is fine, a button half off-screen is not);
  3. a fixed bar along the bottom pads itself by `env(safe-area-inset-bottom)` (found through the stylesheet rules
     that match it or its children, since desktop Chromium computes the inset to 0) and, scrolled to the end, the
     last piece of content sits above it;
  4. no h1 / h2 is clipped (`scrollWidth > clientWidth`).
- The checks were proved on purpose-made faults (a 900 px block, a clipped title, a tab bar with its padding and the
  page's bottom space removed) before the run.
- **Findings fixed:** the landing's worked-examples table cut its third money column at 360 px (th and en, inside the
  card's clip) → below 640 px each example is a row of two labelled figures; the table is kept from 640 px. A
  `heading-order` miss (h1 → h3) on `/agent/apply` and `/payout` found by Lighthouse → `FormSection` takes
  `headingLevel` (src/ui) and the two forms use h2.
- Admin desks at phone widths: they hold together (no page scroll, cards instead of tables, section tabs scroll inside
  their strip, actions reachable); they remain desktop tools by design.

### Pilot switch and waiting list (API-CHANGES-P7 §1–2)
- **Who sees what.** The landing works out one way in (`wayIn` in `agent/page.tsx`): *apply* when the public programme
  is open, or the signed-in customer's `store.agent.programme.applyOpen` is true (pilot list), or they already are an
  agent / applicant (apply sends them to their page); else the *waiting list* when `waitlistOpen` and a consent text
  are published; else *closed*. Anonymous visitors never read the pilot list (the API's public answer is the flag
  only), so the page cannot leak who is piloting.
- **Waiting list on the landing.** The hero's primary button becomes "ลงทะเบียนรอเปิดรับ", an anchor to `#waitlist`
  (the visitor stays on the page that explains the programme); the closing call-to-action becomes a two-column card
  (why, then the form) instead of the apply band. The form: ชื่อ (required), เบอร์มือถือ and อีเมล side by side from
  640 px with one hint — "at least one of the two" — under the phone, ช่องทางที่คุณขาย as the platform's own select
  (no extra script on a marketing page, the phone's own picker), and the consent block on the subtle ground: version
  number, the API's summary in medium weight, the full text, then the tick. Errors are listed together in one alert
  at the top (as the apply form) and focused. `inputMode` / `autocomplete` on every field.
- **Neutral answer.** Every accepted submission shows the same thank-you in place of the form ("ได้รับข้อมูลแล้ว
  ขอบคุณที่สนใจ" — we will tell you through the contact you gave), announced as a status; a repeat contact gets the
  identical message (the API answers `received` either way). A newer consent version (409) clears the tick, says the
  text changed and refreshes the page to show it; a closed list refreshes into the closed state; 429 asks to wait.
- **Closed.** No form and no promise of a date: a short line with an info icon under the hero lede
  ("ตอนนี้ไม่ได้เปิดรับสมัครตัวแทน"), "ดูวิธีคิดค่าคอม" becomes the primary hero action, and the closing card says the
  page holds everything about the programme with a "ติดต่อทีมงาน" link. No "coming soon", no countdown.
- **/agent/apply** for a signed-in customer who may not apply: the title becomes "ลงทะเบียนรอเปิดรับ", the apply steps
  are not shown (there is nothing to step through), and the same form starts from the account's name, phone and
  e-mail. The account page's programme card says "ลงทะเบียนรอเปิดรับ" and goes to the same page.
- **Admin.** "รายชื่อรอเปิดรับ" is the last tab of the agents desk, drawn only for `agent_waitlist.read` (Sales
  Manager, C-Level, Superadmin); the page answers anyone else with the 403 state. Table: name, contact (local phone
  over e-mail), how they sell, sign-ups (a repeat raises it), first and latest sign-up in Bangkok time; search by name,
  e-mail or phone; "ส่งออก CSV" downloads the API's signed link (5 minutes) and says how many rows went out.
- Mock: persona `agentpilot` (0861234569) is on the pilot list; the switch moves with the mock-only job
  `POST /v1/store/mock-jobs/agents.programme_state` (`waitlist` default · `closed` · `open`).

### Real-device pass (Safari iOS, Chrome Android) — NOT PERFORMED here
This workspace has no phones or device cloud; nothing below has been done. Checklist for the owner / QA on UAT
(`agent.<uat-host>` and the storefront), one iPhone (iOS 17+, Safari, with a notch / Dynamic Island) and one Android
phone (Chrome, gesture navigation):
1. `/agent` portrait and landscape: hero, examples as rows, calculator keyboard (`inputMode=decimal` shows the
   number pad), the waiting-list form (phone keyboard on the mobile field, e-mail keyboard on e-mail), consent text
   readable without zoom, the thank-you message after sending.
2. `/agent/apply` signed in as a pilot account: OTP autofill from SMS (iOS "From Messages"), the agreement sheet
   scrolls and its button stays above the home indicator.
3. getpack Agent: the tab bar sits above the home indicator / gesture bar (no overlap, no gap); the FAB clears the
   tab bar; the lead detail's sticky bar (โทร · LINE · ใบเสนอราคา · บันทึก) clears it too; pull-to-refresh does not
   fight the board's sideways scroll; landscape keeps the side insets (notch side).
4. Text at the largest system font size (iOS Dynamic Type via Safari's page zoom 150 %, Android font scale 1.3): no
   clipped headings or buttons on home, leads, quotes, commissions.
5. VoiceOver (iOS) and TalkBack (Android) through the tab bar, a lead, the stage menu and the waiting-list form.
6. Offline: airplane mode → the offline page; a new lead saved as "รอส่ง" and sent when back online.
7. Admin sales desk on a phone (inbox, a lead, approvals): readable and the main action reachable.
Record device, OS and browser versions and screenshots per step in the UAT sheet.

### Lighthouse (mobile preset, local VM — indicative only)
Lighthouse 12.6.1 CLI, mobile, simulated throttling, three runs, against a local production build in mock mode
(`/tmp`-style runs; the same command before and after). The VM's CPU makes performance lower than CI or a phone would
measure; accessibility, best practices and SEO are exact.

| Page | Perf (runs) | A11y | BP | SEO | Notes |
|---|---|---|---|---|---|
| `/agent` before P7 changes | 79 · 75 · 77 | 100 | 100 | 100 | LCP = the h1 (2.8–4.1 s simulated); HTML 1,133 KB |
| `/agent` after the message trim | 82 · 80 · 71 | 100 | 100 | 100 | HTML 1,017 KB (gzip 199 → 188 KB); TBT 238–462 ms |
| `/en/agent` | 82 | 100 | 100 | 100 | |
| getpack Agent `/` | 89 · 80 · 88 · 91 | 100 | 100 | n/a (noindex) | |
| getpack Agent other pages | 86–96 | 100 | 100 | n/a | `/leads` 86–89, `/quotes/new` 86 |
| `/agent/apply` (returning customer) | 77 | 98 → 100 | 96 | n/a (noindex) | heading order fixed |

Tried on `/agent` and kept: the client message catalogue loses four server-only copy subtrees
(`src/i18n/client-messages.ts`, guarded by a test) — the HTML is 10 % smaller; the change in score sits inside the
VM's run-to-run spread, so no claim beyond the byte saving. Looked at and not changed: fonts are already preloaded by
`next/font` (both Anuphan files at high priority before any script); there are no raster images on the page; the
calculator's script is a few KB of the shared form primitives (lazy-loading it saves nothing measurable); the hero
story's animations are compositor-only (opacity / transform). The remaining cost is parsing ~1 MB of HTML of which
~0.8 MB is the storefront's client message catalogue — the follow-up is per-route client namespaces
(docs/performance-budgets.md, Agent portal P7). CI's `pnpm lhci agent-landing agent-apply agent-zone` gives the
reference numbers.

### PWA install (iOS and Android) — manual, NOT PERFORMED here
The e2e installability check stays (`agent-portal-p2.spec.ts`: manifest fields and icons, an active service worker
at `/agent-sw.js`). Real installs need phones:
- **Android / Chrome:** open `agent.<host>` signed in, visit twice → the install card appears (from the 2nd visit) →
  "ติดตั้ง" → the system prompt → the icon on the home screen with the maskable icon cropped cleanly → opens
  standalone (no URL bar), theme colour in the status bar, the tab bar above the gesture bar; airplane mode → the
  offline page; a push test from Admin reaches the device and opens its deep link.
- **iOS / Safari (16.4+):** Share → "Add to Home Screen" (the in-app iOS guide shows these steps) → the apple-touch
  icon, name "getpack Agent" → opens standalone; safe areas on a notched phone; web push only after adding to the
  home screen and allowing notifications in the app.
- Record pass / fail with device and OS versions in the UAT sheet.
