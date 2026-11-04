# P1 — Onboarding earn + checklist · plan

Branch: `feat/loyalty-p1-activity-rewards` (both repos). Source: PLAN.md §2.1, §3, §7 Phase 1; DEC-1…DEC-9.
Run environment for this pass: the owner chose to write P1 on branches from a workspace without Docker, pnpm, Node 24
or the UAT DB. Gates that need those are run later on the owner's Mac (see REPORT.md). **Nothing is merged to main
in this pass.**

## Scope

| # | Item | Repo |
|---|---|---|
| 1 | Schema: new `points_entry_type` values, `points_ledger.meta jsonb`, partial unique index for one-off rewards (per provider), sign check, `customer_profiles.profile_completed_at`, `packaging_profiles` table. Hand-written migration `20270101000003_loyalty_activity_rewards` with a documented down path. | api |
| 2 | Settings: new effective-dated version of `loyalty.activity_rewards` (all §2.1 keys) + `loyalty.activity_cap` `{bahtPer12m: '1500.00'}`; shape validation; admin `LoyaltySettings.tsx` fields. | api + web |
| 3 | Events: verify or emit `customer.profile_completed`, `customer.phone_verified`, `customer.packaging_profile_completed`, `studio.brand_kit_created`, `design.saved`, `company.member_accepted`, `customer.line_oa_followed` (from `line-webhook.service.ts` `follow` when the LINE user maps to a customer). | api |
| 4 | Handler: generic `onActivity(entryType, event)` with a rules map; DEC-4 cap (600 pts / rolling 12 m, activity + bonus only); DEC-5 hold on duplicate tax ID / phone → `pending` + `held_duplicate_identity`, reusing the referral review queue (Marketing). | api |
| 5 | API: `GET /v1/store/loyalty/tasks`; packaging profile `GET/PUT /v1/store/loyalty/packaging-profile`; OpenAPI; realtime `loyalty.points_awarded`. | api |
| 6 | Web: `EarnChecklist` on /account/points (between SummaryCards and TierProgress), banner on /account, /liff/points, packaging-profile form, realtime toast, th + en, Storybook, MSW. | web |
| 7 | Tests: unit (rules map, cap, hold, points math), e2e extension of `loyalty.e2e-spec.ts` (written, run on Mac), web vitest + stories; UAT seed (one customer with 3 tasks done, one held). | both |
| 8 | Docs: D-473…D-486 in `docs/decisions.md` (both), `accounting-design.md` §5 note (activity rewards post like sign-up, P10), PROGRESS entry, REPORT. | both |

## Prototypes (step 3c)

`prototypes/p1-earn-checklist.html` and `prototypes/p1-packaging-profile.html`, built from Stitch round 1 section e
("เอา" only): one sorted list, a "แนะนำถัดไป" block on `primary-subtle`, whole-row links, status marks
(todo / held / done), and a cap footer. Phone 390 + desktop 1440.

## Risks

- `ck_points_ledger__sign`, together with the existing unique index, must stay correct for historical rows. The
  migration only widens the constraint.
- The DEC-4 cap must count `earn_bonus` as well as activity rewards, but never `earn_order` or `earn_referral`.
- Duplicate-identity checks must not leak another customer's existence. The customer sees only "รอตรวจสอบ".
- Packaging profile data is internal (PDPA purpose text on the form; it is never public and never exported outside
  the Marketing and Finance roles).
