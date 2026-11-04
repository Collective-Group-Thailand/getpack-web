# getpack Points & Deals — REPORT

## Status

| Phase | Status | Merged? | Notes |
|---|---|---|---|
| P1 — Onboarding earn + checklist | **CODE COMPLETE · GATE PENDING (Mac)** | No | Written in a workspace without Docker, pnpm, Node 24 or the UAT DB, by the owner's choice (2026-11-04). The branch lives in both repos. Gates 2, 4, 5, 7 and 9 must run on the Mac before merge. |
| P1.5 — Deals surface | Not started | — | Depends on P1 merged. |
| P2 — Lifecycle | Not started | — | — |
| P3 — Catalogue, tiers | Not started | — | — |

Commits on `feat/loyalty-p1-activity-rewards`: api 13, web 8. All are authored and committed by Superball
<Piyapan.pa@abbon.co.th>, with no trailers. The work was done in sibling clones `getpack-api-p1` / `getpack-web-p1`
and fetched into the main repos as the branch. The working trees were not touched.

## สิ่งที่คุณต้องทำ

1. **ตรวจ API บน Mac** — ใน `getpack-api` รันตามลำดับ:
   ```
   git checkout feat/loyalty-p1-activity-rewards
   pnpm install
   pnpm prisma migrate dev
   pnpm db:seed          # ×2 ต้อง idempotent
   pnpm contract:build
   pnpm typecheck
   pnpm lint
   pnpm test
   pnpm test:e2e -- loyalty
   pnpm build
   ```
   - รายละเอียดคำสั่งอยู่ใน `API-P1-NOTES.md`
   - หลัง `contract:build` unit test ที่ล้มอยู่ 1 ตัว (ตรวจว่า operation ใหม่อยู่ใน `contract/openapi.json`) ต้องผ่าน
   - รัน `scripts/launch-settings-build.ts` เพื่อยืนยันว่า `SETTINGS-REVIEW.md` ตรงกับไฟล์ที่ generate
2. **ตรวจ web บน Mac** — ใน `getpack-web` รันตามลำดับ:
   ```
   git checkout feat/loyalty-p1-activity-rewards
   pnpm install
   pnpm gen:api      # หลัง API release ให้ลบ contract-request ของ store.loyalty.tasks / packaging-profile ตามที่ registry.test แจ้ง
   pnpm typecheck
   pnpm lint
   pnpm test
   pnpm build
   pnpm storybook:build
   pnpm e2e
   ```
   แล้วเทียบ prototype กับหน้าจริงที่ 1440 / 1054 / 390 (light) และ 390 (dark) รายละเอียดอยู่ใน `WEB-P1-NOTES.md`
3. **ถ้าทุก gate ผ่าน ให้ merge** ตามลำดับ API ก่อนแล้วตามด้วย web
   (`git checkout main && git merge --no-ff feat/loyalty-p1-activity-rewards`)
   หรือสั่งผมให้รัน Block C (rerun P1) บน Claude Code ในเครื่องคุณ
4. **เลือกคำ "คะแนน" หรือ "แต้ม"** — หน้าเดิมใช้ "คะแนน" แต่ P1 ใช้ "แต้ม" ตามแผน ตอนนี้ `/account/points` จึงมีทั้งสองคำ
   ผมแนะนำ "แต้ม" เพราะสั้นกว่าและตรงกับ PLAN, LIFF และ toast เมื่อเลือกแล้วผมจะแก้ i18n ให้ทั้งระบบ
5. **ยืนยันอัตรา expected redemption กับ CPA** — ตอนนี้ตั้ง `loyalty.expected_redemption_rate_pct` = 60
   (`pending_cpa`, D-480) แทน 100
6. **ตัดสินใจเรื่องหนี้สินแต้มกิจกรรม** — แต้มจากกิจกรรมไม่มี `available_at` จึงไม่ถูกนับในรายงาน points liability
   ปัญหานี้มีมาก่อน P1 แต่ P1 เพิ่มแต้มกิจกรรมได้สูงสุด 600 แต้มต่อบัญชี ควรตัดสินใจว่าจะนับใน P2 analytics (ข้อเสนอ: นับ)
7. **ตรวจ approval policy ใหม่** — Marketing ต้องมีสิทธิ์ใน policy `loyalty_reward_review` เพราะรางวัลที่ถูก hold
   ไปอยู่ใน approvals inbox ไม่ได้อยู่ในรายการ referral

## P1 — Onboarding earn + checklist · CODE COMPLETE (gate pending)

- **Branches:** api `feat/loyalty-p1-activity-rewards` @ `60c5c23d`; web same name @ `e7ae2b85`. No merge.
- **Delivered:**
  - **Schema:** migration `20270101000003_loyalty_activity_rewards`
    - 10 new `earn_*` types and `points_ledger.meta`;
    - a one-off unique index per provider, replacing `ux_points_ledger__one_off_rewards`;
    - a wider sign check;
    - `profile_details_completed_at` and `packaging_profiles`;
    - a documented down path.
  - **Settings:** `loyalty.activity_rewards` (all PLAN §2.1 values), `loyalty.activity_cap` 1,500 baht, and
    `expected_redemption_rate_pct` 60 % pending CPA.
  - **Events:**
    - emitted: `profile_completed`, `phone_verified`, `packaging_profile_completed`, `line_oa_followed` (LINE `follow`);
    - mapped to existing: `brand_kit.created` / `company.brand_asset_added`, `company.member_joined`.
  - **Handler:** generic `onActivity` rules map, with the DEC-4 cap (rewards refused whole, held ones counted) and the
    DEC-5 hold via the new approval policy `loyalty_reward_review`. LINE linking is generalised to Google/Apple
    (`earn_identity_link` + provider).
  - **Endpoints:** `GET /v1/store/loyalty/tasks`, `GET/PUT /v1/store/loyalty/packaging-profile`, and a realtime
    `loyalty.points_awarded` signal (ids only).
  - **Accounting:** activity rewards post like sign-up (P10), with tests; `accounting-design.md` §5 note.
  - **Web:**
    - "ทำสิ่งนี้รับแต้ม" checklist on `/account/points` ("แนะนำถัดไป" block, one sorted list, whole-row links, todo/held/done marks, cap footer);
    - banner on `/account`;
    - compact checklist on `/liff/points`;
    - `/account/packaging-profile` form with PDPA purpose text;
    - a "+N แต้ม" toast;
    - th + en copy.
  - **Prototypes:** `prototypes/p1-earn-checklist.html` and `p1-packaging-profile.html`, screenshots in `screenshots/P1/`.
  - **Tests:** unit (rules map, 600/601 cap, hold, once-per-account, provider), e2e cases (written, not run),
    confidentiality spec extended, UAT seed (3 done + 1 held), 23 new vitest tests + stories.
- **Decisions recorded:** D-473 … D-486 (DEC-1…9, PLAN §9 items 3/4/6/7, ticket colour), identical rows in both repos.
- **Gate results (this workspace):**

  | Check | api | web |
  |---|---|---|
  | lint / prettier on changed files | pass | pass |
  | typecheck | changed files pass · full skipped (OOM) | changed files + imports pass · full skipped (time) |
  | unit | 1,694 pass · 1 expected fail (openapi not regenerated) | 23 new + 337 related pass |
  | prisma validate / generate | pass | — |
  | gen:api --check · tokens:check · contrast | — | pass |
  | e2e · migrate · seed ×2 · build · Storybook · Lighthouse · prototype compare · responsive sweep | skipped (no Docker/DB/Node 24) | skipped |

- **Differences vs prototype:** not compared yet (gate 5 runs on the Mac). Two deliberate choices:
  - the recommended task is not repeated in the list below it;
  - on phone, todo rows show only the title.
- **Assumptions:**
  - Profile completeness = display name + own profile save + verified phone (there is no product-category field).
  - `profile_completed_at` already had another meaning, so a new `profile_details_completed_at` is used.
  - A held reward that Marketing rejects disappears from the checklist.
  - The cap counts held rewards.
  - API dates use +07:00 like every other API date.
  - Operation ids are `store.loyalty.getPackagingProfile` / `updatePackagingProfile`.
- **Open questions:**
  - Routes without a page: `profile_completed` and `phone_verified` link to the closest page, and `brand_kit` goes to
    `/business/assets`, which needs a company. A small page for each, or the existing profile page, is a P1.5 follow-up.
  - Whether the Storybook stories need a `next/navigation` mock under the Vite builder.
- **Screenshots:** `docs/design/loyalty-earn-expansion/screenshots/P1/` (390 and 1440, both prototypes).
