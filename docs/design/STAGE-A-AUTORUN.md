# Stage A — รันต่อเนื่องทั้ง Stage (Autorun)

ใช้แทนการวางทีละบล็อก: ฝั่ง API 1 session · ฝั่ง web 1 session (วาง 2 ครั้ง: Part 1 พร้อมฝั่ง API, Part 2 หลังฝั่ง API จบ)
Claude จะทำทุกขั้นต่อกันเอง หยุดเฉพาะเมื่อจบ Stage หรือเจอเรื่องที่ต้องให้คุณตัดสิน

## ก่อนเริ่ม (ครั้งเดียว)

1. Commit ไฟล์ล่าสุดเหล่านี้ลง `docs/design/` บน branch `fix/uat-phase0` ของ **ทั้งสอง repo**:
   `GLOBAL-RULES.md`, `MASTER-RUN-ORDER.md`, `STAGE-A-PROMPTS.md`, `STAGE-A-AUTORUN.md`
2. ถ้า session ฝั่ง API ยังไม่ได้รับ A1 ให้วาง prompt ฝั่ง API ด้านล่างแทน A1 ได้เลย

## ลำดับ

1. **พร้อมกัน:** session ฝั่ง API → วาง **Autorun ฝั่ง API** · session ฝั่ง web → วาง **Autorun ฝั่ง web Part 1**
2. ฝั่ง API จบ → ตรวจรายงาน + รัน `pnpm test:int` และ `pnpm test:e2e` ที่เครื่อง (cloud ไม่มี Docker)
3. เมื่อฝั่ง API และ web Part 1 จบทั้งคู่ → วาง **Autorun ฝั่ง web Part 2** ใน session ฝั่ง web
4. pull `fix/uat-phase0` ทั้งสอง repo ลงเครื่อง เปิดดูหน้าที่เปลี่ยนที่ localhost:3001 → อนุมัติ → ไป Stage B

---

## Autorun ฝั่ง API (repo getpack-api)

~~~~text
Repo: getpack-api. AUTORUN — Stage A, API side. Branch: fix/uat-phase0 (git fetch, continue it).
Read docs/design/GLOBAL-RULES.md, docs/design/MASTER-RUN-ORDER.md and docs/design/STAGE-A-PROMPTS.md first.
If STAGE-A-PROMPTS.md is missing, stop and tell me.

Execute every block titled "· ฝั่ง API" in STAGE-A-PROMPTS.md, in order (A1 → A5), WITHOUT stopping between
steps. The "stop and wait for my approval" lines inside each block are replaced by the gate below.

For each step:
1. Run the step in a subagent (Task/Agent tool) with the block text verbatim as its prompt, plus:
   "Do not stop for approval; return your phase report when done." If subagents are not available, run it
   yourself and keep only a short summary of each finished step in your notes.
2. Gate (all must pass): pnpm lint · pnpm typecheck · pnpm test (unit) · the factory-data contract test from A1 ·
   `git diff` contains no secrets and no factory names/locations in storefront responses.
3. If the gate fails: fix within the step's scope (max 2 attempts). Still failing → discard that step's
   uncommitted changes, mark it BLOCKED with the reason, and continue with the next step.
4. Pass → commit "stage-a(<step>): <summary>", push, and append the step's report to
   docs/design/STAGE-A-REPORT-API.md (what changed, endpoints/DTOs/migrations, tests, API-CHANGES.md path,
   integration/e2e tests I must run locally, open questions).

Decisions: never invent business rules. Use the decisions in GLOBAL-RULES.md §6. Anything else that needs a
business decision or missing business data → record it as OPEN QUESTION in the report, do not implement that
item, and continue with the rest.

Never merge or open a PR to main, never force-push, never connect to UAT/production or real providers.
Do NOT read whole prototype HTML files — grep only what you need.
When all steps are done: commit and push the report, then stop with a summary table
(step · status PASS/BLOCKED · commits · open questions) and wait for me.
~~~~

---

## ฝั่ง web แบ่งเป็น 2 ส่วน (รันคู่ขนานกับฝั่ง API ได้บางส่วน)

| ส่วน | ขั้น | รันเมื่อไร |
|---|---|---|
| Part 1 | A5 upload · A6 studio · A7 editor · A8 checkout · A9 styles/products/category | **พร้อมกับ** Autorun ฝั่ง API ได้เลย (ไม่ต้องใช้ผลจาก API) |
| Part 2 | A1 business · A2 account · A3 pdp · A4 configurator | **หลัง** ฝั่ง API จบ Stage และ Part 1 จบแล้ว (ต้องใช้ API-CHANGES.md) |

ห้ามรัน Part 1 กับ Part 2 พร้อมกัน — ทั้งคู่ commit ลง branch `fix/uat-phase0` ของ repo web เดียวกัน

### Autorun ฝั่ง web — Part 1 (รันพร้อมฝั่ง API ได้)

~~~~text
Repo: getpack-web. AUTORUN — Stage A, web side, PART 1 (steps that do not depend on API changes). Branch: fix/uat-phase0 (git fetch, continue it).
Read docs/design/GLOBAL-RULES.md, docs/design/MASTER-RUN-ORDER.md and docs/design/STAGE-A-PROMPTS.md first.
If STAGE-A-PROMPTS.md is missing, stop and tell me.

API_INTERNAL_URL points to the shared UAT API: READ-ONLY. Only GET requests; never POST/PUT/PATCH/DELETE,
never submit forms, orders, payments, uploads or messages against it.
Before typecheck/build run: export NODE_OPTIONS="$NODE_OPTIONS --max-old-space-size=4096"

The API side of Stage A is running in parallel in getpack-api. Do NOT depend on its changes in this part.
Before starting, test once whether you can read repo Collective-Group-Thailand/getpack-api
(`gh api repos/Collective-Group-Thailand/getpack-api` or `git ls-remote`) and record the result in the report —
Part 2 will need it. Do not clone or change anything there.

Execute ONLY these "· ฝั่ง web" blocks of STAGE-A-PROMPTS.md, in this order: A5, A6, A7, A8, A9a, A9b, A9c.
For A5 ignore its API-contract lines (the API part of A5 is investigation only). For A7 the price
reconciliation (A3) is not done yet: report the mismatch, do not fix prices. Run them WITHOUT stopping between
steps. The "stop and wait for my approval" lines inside each block are replaced by the gate below.

For each step:
1. Run the step in a subagent (Task/Agent tool) with the block text verbatim as its prompt, plus:
   "Do not stop for approval; return your phase report when done." If subagents are not available, run it
   yourself and keep only a short summary of each finished step in your notes.
2. Gate (all must pass): pnpm lint · pnpm typecheck · pnpm test · pnpm build · grep of changed customer-facing
   files for "โรงงาน", factory/partner counts, sample data or AI-image wording (GLOBAL-RULES §1–3) ·
   for steps that change pages: Playwright screenshots at 390 px, 1440 px and 1440 px dark saved to
   docs/design/screenshots/stage-a/<step>-<page>-<variant>.png with no horizontal scroll at 390 px.
3. If the gate fails: fix within the step's scope (max 2 attempts). Still failing → discard that step's
   uncommitted changes, mark it BLOCKED with the reason, and continue with the next step.
4. Pass → commit "stage-a(<step>): <summary>", push, and append the step's report to
   docs/design/STAGE-A-REPORT-WEB.md (section "Part 1") (what changed, pages, screenshots, tests, what I must verify locally with
   both branches running, open questions).

Decisions: never invent business rules. Use GLOBAL-RULES.md §6. Anything else that needs a business decision or
missing business data → OPEN QUESTION in the report; hide that element instead of using sample data; continue.

Never merge or open a PR to main, never force-push.
Do NOT read whole prototype HTML files — grep only what you need.
When all steps are done: commit and push the report, then stop with a summary table
(step · status PASS/BLOCKED · commits · pages to check at localhost:3001 · open questions) and wait for me.
~~~~

### Autorun ฝั่ง web — Part 2 (หลังฝั่ง API จบ และ Part 1 จบ)

~~~~text
Repo: getpack-web. AUTORUN — Stage A, web side, PART 2 (steps that use the API changes). Part 1 is already done on this branch. Branch: fix/uat-phase0 (git fetch, continue it).
Read docs/design/GLOBAL-RULES.md, docs/design/DECISIONS-STAGE-A.md (incl. its Part 2 run rules),
docs/design/MASTER-RUN-ORDER.md and docs/design/STAGE-A-PROMPTS.md first.
Precedence: GLOBAL-RULES → DECISIONS-STAGE-A → prompt packs.
If STAGE-A-PROMPTS.md is missing, stop and tell me.

API_INTERNAL_URL points to the shared UAT API: READ-ONLY. Only GET requests; never POST/PUT/PATCH/DELETE,
never submit forms, orders, payments, uploads or messages against it.
Before typecheck run: export NODE_OPTIONS="$NODE_OPTIONS --max-old-space-size=4096"
Build with NODE_OPTIONS=--max-old-space-size=4096 only (without --use-openssl-ca); do not change the env.
Price POST exception: `calculate` only, under the conditions and 40-call budget in DECISIONS-STAGE-A.md.
If the budget runs out, continue without prices and list unverified price checks in the report.

First fetch docs/design/STAGE-A-REPORT-API.md and every docs/design/*/API-CHANGES.md from repo
Collective-Group-Thailand/getpack-api, branch fix/uat-phase0 with a read-only shallow clone into /tmp
(git ls-remote works; gh api does not), save them at the same paths here and commit them. Keep the clone
until `pnpm gen:api` below is done, then delete it. If you cannot access that repo, stop and tell me. Skip the web part of any step the API report
marks BLOCKED and note why.

Then, BEFORE A1: the API removed or renamed fields and endpoints (network/stats, factoryCount, partnersCount,
factory fields, factory-named status/reason codes, agent refusal code, contact reference CS-YYMM-NNNNN).
Run `pnpm gen:api` against the updated API contract from that clone (fix/uat-phase0), commit the regenerated
types as "stage-a(api-types): regenerate from getpack-api fix/uat-phase0", and fix every usage of removed or
renamed fields, endpoints and codes so lint, typecheck and build pass. Report what changed. UAT may still run
the old API — code against the new contract and list what I must verify locally with both branches running.

Execute ONLY these "· ฝั่ง web" blocks of STAGE-A-PROMPTS.md, in this order: A1, A2, A3, A4, WITHOUT stopping between
steps. The "stop and wait for my approval" lines inside each block are replaced by the gate below.

A5b (no block in STAGE-A-PROMPTS.md): after A4, if the API report's A5b section lists customer-visible effects
(file names, downloads, carrier labels, renamed codes), apply them on the web side as step "A5b-web" with the same
gate; otherwise skip it and say so.

A1 scope: sweep ALL customer-facing text (locale files, components, metadata, JSON-LD, emails) for
"โรงงาน"/factory wording, not only the footer (GLOBAL-RULES §1 wording).

For each step:
1. Run the step in a subagent (Task/Agent tool) with the block text verbatim as its prompt, plus:
   "Do not stop for approval; return your phase report when done." If subagents are not available, run it
   yourself and keep only a short summary of each finished step in your notes.
2. Gate (all must pass): pnpm lint · pnpm typecheck · pnpm test · pnpm build · grep of changed customer-facing
   files for "โรงงาน", factory/partner counts, sample data or AI-image wording (GLOBAL-RULES §1–3) ·
   for steps that change pages: Playwright screenshots at 390 px, 1440 px and 1440 px dark saved to
   docs/design/screenshots/stage-a/<step>-<page>-<variant>.png with no horizontal scroll at 390 px.
3. If the gate fails: fix within the step's scope (max 2 attempts). Still failing → discard that step's
   uncommitted changes, mark it BLOCKED with the reason, and continue with the next step.
4. Pass → commit "stage-a(<step>): <summary>", push, and append the step's report to
   docs/design/STAGE-A-REPORT-WEB.md (section "Part 2") (what changed, pages, screenshots, tests, what I must verify locally with
   both branches running, open questions).

Decisions: never invent business rules. Use GLOBAL-RULES.md §6 and DECISIONS-STAGE-A.md. Anything else that needs a business decision or
missing business data → OPEN QUESTION in the report; hide that element instead of using sample data; continue.

Never merge or open a PR to main, never force-push.
Do NOT read whole prototype HTML files — grep only what you need.
When all steps are done: commit and push the report, then stop with a summary table
(step · status PASS/BLOCKED · commits · pages to check at localhost:3001 · open questions) and wait for me.
~~~~