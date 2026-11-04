# getpack Points & Deals — AUTORUN (Phase 1 → 1.5 → 2 → 3, ไม่หยุดรอระหว่าง Phase)

ไฟล์นี้คือ prompt สำหรับรันแผน `PLAN.md` (Points, Deals & Promotions — Expansion Plan, approved 2026-11-04)
ต่อเนื่องอัตโนมัติจนจบ ใน Claude Code บนเครื่องคุณ ที่เปิดได้ทั้งสอง repo (`getpack-web`, `getpack-api`), Docker
และฐานข้อมูล UAT copy

## วิธีใช้

1. ตรวจว่า 2 ไฟล์อยู่ที่ `docs/design/loyalty-earn-expansion/` ของ**ทั้งสอง repo**: `PLAN.md` และไฟล์นี้
2. เปิด Claude Code ที่โฟลเดอร์แม่ของทั้งสอง repo: `cd ~/Collective/getpack && claude`
   เปิดโหมดยอมรับการแก้ไฟล์อัตโนมัติ (Shift+Tab → auto-accept edits)
3. วางบล็อก **A — Autorun หลัก** ทั้งบล็อก แล้วปล่อยให้รันจนจบ
4. ถ้า session หลุดหรือ context เต็ม: เปิด session ใหม่แล้ววางบล็อก **B — Resume**
5. เมื่อจบ อ่าน `docs/design/loyalty-earn-expansion/REPORT.md` และ `report.html` ตรวจรายการ "สิ่งที่คุณต้องทำ"

สิ่งที่ autorun **จะไม่ทำ**: deploy production, เปิด promotion สาธารณะจริง (ทุก deal ที่ seed เป็น UAT และ `hidden`),
เชื่อม LINE OA จริง, ส่งข้อความหาลูกค้าจริง, ยืนยันอัตรา CPA, แก้วงเงินเครดิตของลูกค้าจริง — ทุกอย่างนี้รอคุณ

---

## A — Autorun หลัก

~~~~text
You are running the getpack Points & Deals plan end to end, autonomously, in ONE Claude Code session on the
owner's computer. Both repos are siblings in the current folder: ./getpack-api and ./getpack-web. The owner is
NOT watching and has delegated every business, design, accounting and marketing decision in the plan to you as
head of his getpack team (he agreed to all recommendations). Do not ask questions; decide, record, continue.

=== 0. Read first (in this order; precedence top to bottom) ===
1. getpack-web/CLAUDE.md and getpack-api/CLAUDE.md
2. getpack-web/docs/design/GLOBAL-RULES.md
3. docs/decisions.md in both repos — especially D-051, D-053, D-071, D-080, D-130…D-136, D-153, D-181, D-196,
   D-449/D-451 (approvals, credit limit), D-452 (cart), D-463 (factory confidentiality) and every row after
4. docs/design/loyalty-earn-expansion/PLAN.md (the pack; identical in both repos) — §1 and §9 are DECIDED
5. docs/accounting-design.md §5 (P10/P11/P12 points posting) in getpack-api
6. The existing code you are extending (read before planning each phase):
   getpack-api/src/modules/loyalty/*, src/modules/promotions/*, src/modules/checkout/checkout.extensions.ts,
   src/modules/conversations/line-webhook.service.ts, prisma/schema/commerce.prisma (loyalty + promotions),
   prisma/seed/data/settings.ts (loyalty.*, referral.rules, promotions.*), prisma/seed/data/notification-matrix.ts;
   getpack-web/src/app/[locale]/(storefront)/account/points, account/wallet, cart, checkout, products,
   src/features/customer/*, src/features/admin/marketing/*
7. docs/PROGRESS.md (latest entries) in both repos
If PLAN conflicts with GLOBAL-RULES or an accepted decision, GLOBAL-RULES and decisions win — except where PLAN
explicitly supersedes (PLAN §5 credit-limit uplift amends the credit-limit policy for tier uplifts only; PLAN §2.2
raises the D-135 review reward). Record every such conflict in REPORT.md.

=== 1. State file (resume support) ===
Create/maintain getpack-web/docs/design/loyalty-earn-expansion/AUTORUN-STATE.md (copy to getpack-api on every
update): current phase · step (prototype|api|web|gate|merge) · branch names · last commit SHA per repo · BLOCKED
items · skipped phases and why · open questions · decisions recorded (D-numbers). Update after every commit. On
start, if it exists, resume from it.

=== 2. Pre-flight (once) ===
- Both repos on main, clean (untracked docs/design/loyalty-earn-expansion/ is expected: commit it first on main as
  "docs(loyalty): points & deals expansion plan and autorun" in both repos). git fetch; main up to date.
- Git identity for EVERY commit in both repos:
    git config user.name "Superball"; git config user.email "Piyapan.pa@abbon.co.th"
  Author AND committer = Superball <Piyapan.pa@abbon.co.th>, NO trailers (no Co-Authored-By, no Claude-Session,
  no "Generated with"). Verify after each commit: git log -1 --format='%an <%ae> | %cn <%ce>%n%B'
  If a trailer slipped in, amend (only while unpushed).
- Tooling: pnpm, node ≥ 24, Docker running (if not: run every non-Docker gate, mark e2e SKIPPED-DOCKER), local API
  + UAT copy DB reachable. Design skill (mandatory for every screen): npm install -g ui-ux-pro-max-cli &&
  uipro init --ai claude (run in getpack-web). If npm is refused: git clone
  https://github.com/nextlevelbuilder/ui-ux-pro-max-skill ../_tools/ui-ux-pro-max-skill and read its SKILL.md and
  skills/ before designing; if both fail, continue with GLOBAL-RULES and note it. Precedence: GLOBAL-RULES and
  getpack tokens > skill.
- Decision numbering: next free D-number after the highest in BOTH repos' docs/decisions.md and after the agent
  pack's reserved range (D-464–D-472). Record DEC-1…DEC-9 and PLAN §9 items 3, 4, 6, 7 as accepted rows (identical
  in both repos) in the Phase 1 docs step; reference them from code comments as D-numbers.

=== 3. Phase loop ===
Order: P1 → P1.5 → P2 → P3. Dependencies: P1.5←P1 (checklist + wallet links), P2←P1.5, P3←P2.
Scope per phase = PLAN §7 (work breakdown) + the sections it points to. For each phase n:
  a. Branch: feat/loyalty-p<n>-<slug> in BOTH repos from current main
     (P1 feat/loyalty-p1-activity-rewards · P1.5 feat/loyalty-p15-deals-surface · P2 feat/loyalty-p2-lifecycle ·
     P3 feat/loyalty-p3-catalogue-tiers). If it exists, continue it; merge main forward; never rebase shared branches.
  b. Plan: write docs/design/loyalty-earn-expansion/plans/P<n>-PLAN.md (both repos): scope, files, migrations,
     endpoints, events, settings, tests, risks, screens. Then execute it. No waiting for approval.
  b½. Stitch references (optional input, never a blocker): if docs/design/loyalty-earn-expansion/stitch/ exists
     (exported Google Stitch variants + STITCH-NOTES.md written by the owner's desktop session), read STITCH-NOTES.md
     and adopt ONLY the points marked "เอา" (layout, hierarchy, component ideas). Never copy Stitch code or its
     styling; rebuild with getpack tokens. If the folder is absent, skip this step.
  c. Prototype (phases with new customer screens: P1 checklist card + packaging-profile form; P1.5 /deals, deal
     card, PDP badge + volume ladder, cart coupon picker, /liff/deals; P3 /account/points/redeem): before coding
     the screen, build a self-contained HTML prototype per screen in docs/design/loyalty-earn-expansion/prototypes/
     (Anuphan, getpack tokens, light theme without dark surfaces, phone 390 + desktop 1440, real-looking Thai copy,
     no sample factory data) using the design skill's method; record applied rules in DESIGN-NOTES.md. The
     prototype is the acceptance bar for the real page (see gate 5). Quality bar: senior European/US product
     designer, never AI-generic; no countdown timers or gamification gimmicks (DEC-9).
  d. API (getpack-api): schema + migration (hand-written guards like the loyalty migration: CHECK constraints,
     append-only triggers, partial unique indexes), settings seed (effective-dated, audited, with description +
     decisions), domain events, handlers, endpoints with ApiEndpoint docs, posting rules if money moves, notification
     matrix rows, workers under @ScheduledJob. Write docs/design/loyalty-earn-expansion/API-CHANGES-P<n>.md (copy to
     web). Contract/OpenAPI updated; contract.lock bumped on the web side.
  e. Web (getpack-web): pnpm gen:api, then the screens, i18n th + en, Storybook stories, MSW mocks. Missing endpoint →
     contract-requests.md + `// CONTRACT-REQUEST` mock (never invent silently).
  f. Commit per numbered item (Conventional Commits), push the branch after each item.
  g. Gate (§4). Pass → merge to main in both repos (API first): git checkout main && git merge --no-ff <branch>, push,
     record merge SHAs. Fail after allowed fix attempts → BLOCKED: do not merge; record why; skip dependants;
     continue with anything independent (e.g. P3 catalogue tables can proceed without P2 analytics if P1.5 merged).
  h. Record decisions in docs/decisions.md (both repos, identical rows), a dated docs/PROGRESS.md entry (both), and
     append the phase section to docs/design/loyalty-earn-expansion/REPORT.md (§6 format).

Phase-specific musts (in addition to PLAN):
  P1  · points_ledger.meta jsonb + new partial unique indexes replace ux_points_ledger__one_off_rewards; update
        ck_points_ledger__sign for every new earn_* type · generic onActivity rules map · DEC-4 cap enforced in the
        handler AND covered by a unit test · DEC-5 hold reuses the referral review queue and Marketing role ·
        GET /v1/store/loyalty/tasks · packaging profile (table, CRUD, form, event) · earn_line_oa_friend hooked into
        line-webhook.service.ts `follow` when the LINE user maps to a customer · checklist card on /account/points,
        banner on /account, /liff/points · realtime toast · UAT seed: one customer with 3 tasks done, one held.
  P1.5 · promotions.visibility (default hidden) + display jsonb + schema versions · GET /v1/store/promotions (public,
        60 s cache, ?productTypeCode, ?ref) · save action · GET /v1/store/cart/applicable-codes · ladder endpoint from
        quotation options (no new pricing) · /deals + /deals/[slug] (JSON-LD Offer, FAQ block, indexable) · home strip ·
        PDP badge + VolumeLadder · CouponPicker in cart (manual entry kept, D-452 max 3) · /liff/deals · agent ?ref
        attribution cookie → lead attribution hook (if lead management is not merged yet, store the attribution on the
        customer/session and leave a CONTRACT-REQUEST) · quote recovery worker + 2 notification rows + setting
        promotions.quote_recovery (default enabled only on UAT) · admin promotion editor: Visibility + Display tab with
        image upload through the existing assets/S3 path · every seeded deal is `hidden` and UAT-labelled.
  P2  · §2.2 earn types incl. in-app surveys module (3–5 questions, templates, once per trigger) · reorder reminder:
        predicted stock-out = last order qty ÷ (qty of previous orders / days between) with floor 30 d, notification
        reorder.reminder, loyalty_campaigns row ×1.5 for 7 days · win-back bonus lot with 30-day expiry · audience
        segments + bundle condition in conditions v2 + admin segment picker · agent share links in promotions report ·
        analytics page /admin/marketing/loyalty/analytics (liability at DEC-8 rate, breakage actual vs assumed, earn vs
        redeem by source and tier, conversion of reminder/win-back/recovery) + exposure for the executive P&L
        (points liability line; pull the DEC-8 setting).
  P3  · coupon benefit kinds free_shipping / free_sample / free_rush / free_addon / revision_round in the promotion
        benefit schema (v2) and checkout pipeline · reward_catalog_items + reward_redemptions · redeem page +
        "แลกด้วยแต้ม" tab on /deals · admin catalogue editor · full loyalty_campaigns in earnForOrder (date / product /
        segment / reason multipliers; anniversary ×2; early-pay ×1.2; QR ×1.2 from P2 moves here if not done) ·
        Platinum tier + tier_perk_grants + perk coupons · credit-limit tier uplift: new effective-dated limit version
        with reason tier_uplift, cap ฿1,000,000, Finance notification credit_limit.tier_uplift, override allowed,
        above cap → existing approval policy · priority production slot = planner flag only (no promise text that
        names a factory) · capacity-driven deals: worker drafts an `automatic` hidden promotion when planner free
        capacity ≥ setting; Marketing approval (maker-checker) before visibility can become public.

=== 4. Gate (every phase; both repos where applicable) ===
1. pnpm lint · pnpm typecheck · unit tests · build (both repos).
2. API: prisma migrate status clean; migrations reversible (down path documented); seed idempotent (run twice);
   loyalty e2e (test/e2e/loyalty.e2e-spec.ts, promotions-*.e2e-spec.ts, checkout, ledger) green and extended;
   new e2e files per PLAN §7; test/unit/storefront-factory-confidentiality.spec.ts extended to every new
   store/public/LIFF response (deals, tasks, ladder, rewards).
3. Money: points math unit tests (points-math.spec.ts) extended; posting-rule tests prove activity rewards and
   catalogue redemptions post like today's sign-up / checkout redemption (P10/P11/P12, account 4930); no money
   computed in the web; decimal strings only; every rate/threshold is an effective-dated audited setting.
4. Web: pnpm gen:api:check, pnpm tokens:check, i18n tests (no raw keys, th + en complete), Storybook builds, e2e for
   the touched area (Docker), visual project for new screens.
5. Match the prototype: open each prototype and the real page in Playwright at 1440 px light, 1054 px light and
   390 px (light + dark); compare section by section (layout, spacing, type, colours, states, empty states, copy);
   fix every difference that is styling or structure; allowed differences only: missing real data, repo ADRs/tests —
   each listed with reason. Screenshots to docs/design/loyalty-earn-expansion/screenshots/P<n>/.
6. Responsive: 360, 375, 393, 768, 1024, 1280, 1440, 1920 — no horizontal scroll, no clipped text, safe areas.
7. Lighthouse on new public routes (/deals, /deals/[slug]): mobile Performance ≥ 90, Accessibility ≥ 95, SEO 100;
   JSON-LD validates.
8. Wording/confidentiality grep on customer-, public-, LIFF- and agent-facing code and copy: must not match
   โรงงาน|factory|partner name or count, กำไร|margin|profit, กำลังพัฒนา|coming soon, AI-image wording, "฿0" for free
   offers, countdown/flash-sale wording; fonts only Anuphan; no dark surfaces in the light theme.
9. Anti-abuse tests: duplicate one-off reward refused (DB + handler), cap reached, held entry on duplicate tax ID /
   phone, hidden promotion never served, applicable-codes equals checkCode, quote recovery max 2 messages and stops
   on order/expiry/opt-out, single-use recovery coupon, tier uplift never exceeds cap.
10. Commits: identity and no-trailer check on every new commit.
Fix attempts: up to 2 per failing check. Still failing → BLOCKED with the exact error and what was tried. Flaky
e2e: rerun once; passes → note FLAKY with the test name.

=== 5. Decision rules while running ===
- Everything in PLAN §1 (DEC-1…9) and §9 is decided; apply as written. Anything not covered: choose the most
  conservative option that keeps money, tax, PDPA and factory confidentiality safe; record under "Assumptions".
- Customer data collected for points (packaging profile, surveys, data refresh) is internal: never shown publicly,
  never exported outside finance/marketing roles; PDPA purpose text on each form (th + en).
- Points never cash out, never transfer; redemption always through the checkout pipeline or a per-customer coupon.
- Promotions seeded by the autorun stay `hidden`; only Marketing can make one public, and only after the gate.
- Notifications to customers run only against UAT data; real LINE push stays behind the existing env flags.
- CPA items (DEC-8 rate) keep `confirmation: pending_cpa`; list them under "สิ่งที่คุณต้องทำ".
- Never: deploy, touch production, real payments, real tax documents, real customer messaging, force-push or
  rewrite main, commit secrets, delete user data, change a real customer's credit limit.

=== 6. REPORT.md format (append per phase, ≤ 40 lines each) ===
## P<n> — <title> · PASS | BLOCKED | SKIPPED
- Branches / merge SHAs (api, web)
- Delivered (bullets, one line each)
- Decisions recorded (D-numbers)
- Gate results (each check: pass/fail/skipped + reason)
- Remaining differences vs prototype (with reasons)
- Assumptions taken
- Open questions
- Screenshots (paths)

=== 7. Finish ===
After P3 (or when nothing runnable is left):
- REPORT.md top section: status table (phase · status · merged? · notes), commit totals, and "สิ่งที่คุณต้องทำ"
  (Thai, numbered, concrete: e.g. "ยืนยันอัตรา expected redemption กับ CPA แล้วแก้ setting …", "ตั้งค่า deal แรกเป็น
  public ใน /admin/marketing/promotions …", "เปิด promotions.quote_recovery บน production เมื่อพร้อม", "ตรวจเพดาน
  credit-limit uplift กับ Finance", "เลือกรูป hero ของ /deals").
- docs/design/loyalty-earn-expansion/report.html: one self-contained page summarising REPORT.md for the owner
  (light theme, Anuphan, no dark surfaces) — he will publish it as a canvas.
- Final AUTORUN-STATE.md: status DONE (or PARTIAL with the reason).
- Stop. Do not start anything outside this pack.
~~~~

---

## B — Resume (ใช้เมื่อ session หลุดหรือ context เต็ม)

~~~~text
Resume the getpack Points & Deals autorun. Read getpack-web/docs/design/loyalty-earn-expansion/LOYALTY-AUTORUN.md
block A (all rules apply unchanged), then docs/design/loyalty-earn-expansion/AUTORUN-STATE.md and REPORT.md. Check
both repos' current branch, uncommitted changes and last commits against the state file; if they disagree, trust
git, fix the state file, and note it. Continue from the recorded phase and step. Do not redo merged phases. Do not
ask questions.
~~~~

---

## C — Rerun one phase (ใช้เมื่อแก้ปัญหา BLOCKED เสร็จแล้ว)

~~~~text
Rerun ONLY phase P<n> of the getpack Points & Deals pack with every rule of block A in
docs/design/loyalty-earn-expansion/LOYALTY-AUTORUN.md (state file, prototype, gate, merge, report). Start from the
existing branch feat/loyalty-p<n>-<slug> if present. Read the BLOCKED entry for P<n> in REPORT.md first and address
it. When P<n> passes and is merged, continue automatically with the phases that were skipped because they depended
on it, then finish as in block A §7.
~~~~

---

## D — เฉพาะ prototype (ใช้ถ้าอยากดูดีไซน์ก่อนให้ autorun เขียนโค้ด)

~~~~text
Do ONLY step 3c of block A in docs/design/loyalty-earn-expansion/LOYALTY-AUTORUN.md for phases P1 and P1.5: build
the HTML prototypes (checklist card, packaging-profile form, /deals, deal card, PDP badge + volume ladder, cart
coupon picker, /liff/deals) in docs/design/loyalty-earn-expansion/prototypes/ of getpack-web, with DESIGN-NOTES.md
and screenshots at 390 and 1440. Commit on main as "docs(loyalty): prototypes for P1 and P1.5" (identity rules of
block A §2). Then stop and wait for me.
~~~~
