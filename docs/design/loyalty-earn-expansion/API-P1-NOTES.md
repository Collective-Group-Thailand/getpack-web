# P1 — API build notes (onboarding earn + checklist)

Branch `feat/loyalty-p1-activity-rewards` (getpack-api) · 2026-11-04 · not pushed, not merged.
Contract: `API-CHANGES-P1.md` (updated where the API had to deviate — see "Contract deviations").
Decisions: D-475 (values), D-476 (cap), D-477 (hold), D-483 (LINE OA follow), D-131 (point value).

## What was built

| # | Item | Where |
|---|---|---|
| 1 | Migration `20270101000003_loyalty_activity_rewards` (hand-written, commented DOWN): 10 new `points_entry_type` values; `points_ledger.meta jsonb` (object check, fixed by the append-only guard); `ux_points_ledger__one_off_rewards` replaced by a partial unique index on `(user_id, entry_type, coalesce(meta->>'provider',''))` for `earn_signup`, `earn_line_link` and every new `earn_*`; `ck_points_ledger__sign` widened; `ck_points_ledger__pending` lets a held reward have no `available_at`; `customer_profiles.profile_details_completed_at`; `packaging_profiles` (PK/FK user, value checks per the contract, GIN indexes on categories and regions). Prisma schema to match. | `prisma/migrations/…`, `prisma/schema/commerce.prisma`, `iam.prisma` |
| 2 | `loyalty.activity_rewards` gains every D-475 key (JSON shape in `valueSchema`) with an `amendInForce` that adds the missing keys once to a database seeded before P1 (never changes a value someone set; `identityLinkBaht` copies the `lineLinkingBaht` in force). New `loyalty.activity_cap` `{ bahtPer12m: "1500.00" }` (D-476). New approval policy `loyalty_reward_review` (Marketing, D-477). `SETTINGS-REVIEW.md` regenerated. | `prisma/seed/data/settings.ts`, `approval-policies.ts`, `setting-keys.ts` |
| 3 | Events emitted: `customer.phone_verified`, `customer.profile_completed`, `customer.packaging_profile_completed` (+ `customer.packaging_profile_updated`), `customer.line_oa_followed`. | `customer-login.service.ts`, `customers.service.ts`, `packaging-profile.service.ts`, `line-webhook.service.ts` |
| 4 | `ActivityRewardsService`: rules map (`activity-rewards.ts`), generic `onActivity`, D-476 cap, D-477 hold + review outcome, identity links for LINE/Google/Apple, realtime signal. `LoyaltyService.reward` takes `meta`; `issued` / `record` are public; the hourly credit job skips held rewards. | `src/modules/loyalty/activity-rewards*.ts`, `loyalty.service.ts` |
| 5 | `GET /v1/store/loyalty/tasks` (`store.loyalty.tasks`), `GET/PUT /v1/store/loyalty/packaging-profile` (`store.loyalty.getPackagingProfile` / `updatePackagingProfile`), DTOs with examples and validation. | `loyalty.controller.ts`, `activity-rewards.dto.ts` |
| 6 | Accounting: P10 does not switch on the entry type, so the new rewards post exactly like `earn_signup`; test added; `accounting-design.md` §5 note. | `test/unit/posting-rules.spec.ts` |
| 7 | Tests: `activity-rewards.spec.ts` (rules map vs real events and vs the migration index, checklist, cap 600th/601st, hold, approve/reject, once per account / per provider, realtime), `packaging-profile.spec.ts` (validation, null profile, profile completeness), `points-math.spec.ts` (cap property test), `seed-data.spec.ts` (settings + amendment), confidentiality spec (P1 DTOs + contract presence), `loyalty.e2e-spec.ts` (6 P1 cases), UAT seed `uat-loyalty.ts`. | — |

## Event-name mapping (verified against the emitters)

| Entry type | Event (real name) | Customer resolved from | Filter |
|---|---|---|---|
| `earn_signup` (unchanged handler) | `customer.registered` | aggregate id | not `via: cs` |
| `earn_identity_link` (meta.provider) | `customer.identity_linked` (`customer-login.service.ts`) | aggregate id | provider `line`→line, `firebase_google`→google, `firebase_apple`→apple; `phone_otp` ignored |
| `earn_phone_verified` | `customer.phone_verified` (**new**; OTP sign-up with a phone, or first OTP verification of an existing account) | aggregate id | — |
| `earn_profile_completed` | `customer.profile_completed` (**new**, once) | aggregate id | see "Profile completeness" |
| `earn_tax_profile` | `customer.tax_profile_created` | aggregate id | — |
| `earn_address` | `customer.address_created` | aggregate id | — |
| `earn_brand_kit` | `brand_kit.created` (studio, **not** `studio.brand_kit_created`) and `company.brand_asset_added` | the acting user | — |
| `earn_first_design` | `design.created`, `design.saved` (designs) | design owner | the design has ≥ 1 saved version |
| `earn_team_invite` | `company.member_joined` (**not** `company.member_accepted`) | the member's inviter (`invited_by`) | the joined user is a distinct, phone-verified account |
| `earn_packaging_profile` | `customer.packaging_profile_completed` (**new**) | aggregate id | — |
| `earn_line_oa_friend` | `customer.line_oa_followed` (**new**, from `follow` when the OA user maps to a customer) and `customer.identity_linked` (provider line, when that LINE user already follows the OA) | aggregate id | only when `LINE_MESSAGING_CHANNEL_SECRET` is set |

Consumers: `loyalty.activity` (all P1 events but identity links), `loyalty.line_link` (identity links — the pre-P1 consumer name, kept so already-handled events are not replayed), `loyalty.reward_review` (approval outcomes), `loyalty.points_awarded` (realtime), `customers.profile_completed` (phone verified → completeness check).

## Contract deviations (all written into API-CHANGES-P1.md)

1. **Operation ids** `store.loyalty.packagingProfile.get/put` → `store.loyalty.getPackagingProfile` / `store.loyalty.updatePackagingProfile`: `@ApiEndpoint` only accepts `<surface>.<tag>.<action>` and refuses to boot otherwise.
2. **Realtime payload**: api-conventions §6 allows type + id only, so `loyalty.points_awarded` is `{ type, id: <entry public id> }`; the web refetches the tasks and diffs to build the toast.
3. **Dates** use the Bangkok offset (`+07:00`) like every other API date; the examples were updated.
4. **Rejected held reward**: its task is omitted from the list (it can never be earned again).

## Assumptions (most conservative option where the plan was silent)

- **Profile completeness** (`customer.profile_completed`): display name set, phone verified, and the customer saved their profile themselves (`profile_completed_at`, U-B0.1 — that save confirms the customer type, which defaults to `individual`). The customer profile has **no product-category field**; that part of PLAN §2.1 is carried by the packaging profile (its own reward). `customer_profiles.profile_completed_at` already existed with the U-B0.1 meaning, so the once-stamp is the new `profile_details_completed_at`.
- **DEC-5 matcher**: phone = another non-anonymised user (any kind, so a staff account counts) has the same `users.phone`, or a `phone` fingerprint is shared (D-136 table); tax ID = the same `tax_id` on another account's live tax profile. Applied to every P1 activity reward (not to sign-up). Marketing sees the other account ids in the approval payload; the customer never does.
- **Review queue**: approval policies are bound to one subject type, so held rewards use a new policy `loyalty_reward_review` (subject `points_entry`, Marketing step — the same role and approvals inbox as `referral_review`). They do **not** appear in the referral list (`admin.referrals.list`); the web's approvals inbox needs to render subject `points_entry` (link to the customer's points ledger).
- **Cap (D-476)** counts `earn_signup`, `earn_line_link`, `earn_review`, `earn_bonus` and all P1 types, statuses pending/available/expired (held rewards reserve cap; reversed ones free it), created in the last 365 days. A reward is refused whole (never split), audit row `loyalty.activity_reward_refused` (finance, denied). Sign-up and review rewards are counted but their handlers are not capped in P1.
- **Team invite** is earned by the inviter; **brand kit** by whoever creates the company's first kit or brand asset (one per account, not per company).
- **Rewards created by CS** for a customer (address, tax profile) earn too: the reward is for the data.
- **Packaging profile PUT** has no `If-Match` (single-owner form, last write wins); every save re-stamps `purpose_accepted_at`.
- `pendingPoints` on `store.loyalty.get` includes held rewards (they are pending).

## Open issues

- `contract/openapi.json` is **not regenerated**: `pnpm contract:build` runs `nest build` with the swagger plugin, which needs the full TypeScript program (> 3.4 GB; this VM has 3.9 GB). Until the owner runs it, the new confidentiality test "are in the committed contract" fails by design.
- Migration name `20261104000001_*` (as requested) sorts **before** migrations already applied on the Mac (latest `20270101000002`) and shares its timestamp with `20261104000001_pouch_pricing`. `migrate deploy` applies it; `migrate dev` may report it as applied out of order — if so, rename the folder to `20270102000001_loyalty_activity_rewards` (update the path in `activity-rewards.spec.ts`).
- The new enum values are used later in the same migration (precedent: `20261111000001_target_price_levers`). If PostgreSQL reports "unsafe use of new value", split the `ALTER TYPE` lines into their own migration.
- The expression index cannot be declared in Prisma; check that `prisma migrate diff --from-migrations … --to-schema …` (CI drift) stays clean as it does for `ux_settings__key__scope`.
- Existing (pre-P1) `reward()` rows have no `available_at`, so the points-liability report (`operations.reports.ts`) does not count activity rewards as "earned"; P1 rewards inherit that. Approved held rewards do set `available_at`. Not changed here (accounting report, needs Finance).
- `loyalty.expected_redemption_rate_pct` is still seeded at 100 (D-480 says 60 provisional) — out of P1 scope, noted for the D-480 slice.
- Web: admin `LoyaltySettings.tsx` fields for the new keys and `loyalty.activity_cap`; approvals inbox rendering of `points_entry`.

## Gate results here (Linux VM, no Docker/Postgres, 3.9 GB RAM)

| Gate | Result |
|---|---|
| `prisma validate` / client generation (`scripts/prisma-clients.mjs`, into the clone's ignored `src/generated`) | **pass** |
| Full `tsc --noEmit` | **skipped** — out of heap at 3.35 GB (the owner's script uses 6 GB) |
| Targeted `tsc --noEmit` over every changed `.ts` (and what they import) | **pass** (0 errors); the e2e spec type-checked against stubs of `test/support/commerce-e2e.ts` |
| ESLint (changed files incl. the e2e spec) | **pass** |
| Prettier (changed files) | **pass** |
| Unit tests (`--selectProjects unit`, all 228 suites, Node 24 + Linux native bindings installed outside the repo) | **1694 pass, 1 fail by design** (contract presence of the P1 operations — needs `pnpm contract:build`) |
| e2e / integration | **not run** (no Postgres/Redis) |
| `pnpm contract:build` / `contract:lint` | **not run** (see open issues) |

## Commands for the owner (Mac, Node 24, Docker up)

```bash
cd getpack-api && git fetch && git checkout feat/loyalty-p1-activity-rewards   # or work in the -p1 clone
pnpm install                     # regenerates both Prisma clients (postinstall)
docker compose up -d
pnpm db:migrate                  # prisma migrate dev — applies 20270101000003_loyalty_activity_rewards
pnpm exec prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema --exit-code   # drift
pnpm db:seed:dev && pnpm db:seed:dev   # twice: the second run must add nothing (amendInForce idempotent)
pnpm db:seed:uat && pnpm db:seed:uat   # on the UAT rehearsal DB: P1 customer points-p1@example.invalid, 3 done + 1 held, idempotent
pnpm typecheck
pnpm lint
pnpm contract:build && pnpm contract:lint   # then commit contract/openapi.json (fixes the confidentiality test)
pnpm test
pnpm test:e2e -- test/e2e/loyalty.e2e-spec.ts
pnpm test:e2e
pnpm build
```
