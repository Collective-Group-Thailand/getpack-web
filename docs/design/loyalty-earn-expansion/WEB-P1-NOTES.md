# Web P1 notes — earn checklist and packaging profile

Branch `feat/loyalty-p1-activity-rewards` (getpack-web). Contract: `API-CHANGES-P1.md`. Design: `DESIGN-NOTES.md`,
`prototypes/p1-*.html`, `screenshots/P1/`. Nothing pushed or merged.

## 1. What was built

| Piece | File |
|---|---|
| Contract requests (zod) for `GET /v1/store/loyalty/tasks`, `GET`/`PUT /v1/store/loyalty/packaging-profile` | `src/lib/api/requests/store-loyalty.ts` (+ registry, `awaiting-triage.ts`, rows in `docs/contract-requests.md`, `docs/contract-requests.openapi.json`) |
| Stateful MSW (one held, three done; PUT completes `packaging_profile`) | `mocks/store/loyalty.ts`, fixtures `mocks/store/loyalty-fixtures.ts` |
| Server reads | `getLoyaltyTasks()` (null on failure), `getPackagingProfile()` in `src/features/customer/account/api.server.ts` |
| Task routes, display split, toast diff | `src/features/customer/account/earn-tasks.ts` |
| `EarnChecklist` (query + toast) / `EarnChecklistView` (full, compact) | `src/features/customer/account/EarnChecklist.tsx` |
| `/account` banner | `src/features/customer/account/EarnBanner.tsx` |
| Packaging-profile form + rules | `PackagingProfileForm.tsx`, `packaging-profile.ts`, page `src/app/[locale]/(storefront)/account/packaging-profile/page.tsx` |
| New `src/ui` primitive (multi-choice tiles) | `src/ui/components/CheckboxTiles.tsx` |
| Wiring | `/account/points` (between SummaryCards and TierProgress, `#earn`), `/account` (after "ต้องทำตอนนี้"), `/liff/points` (compact, above the latest movements), new tab "การใช้บรรจุภัณฑ์" under ข้อมูลบัญชี (`sections.ts`) |
| Copy | `account.points.earn.*`, `account.points.tasks.<code>.title/description/action`, `account.home.earnBanner*`, `account.tabs.packagingProfile`, `account.packagingProfile.*` (th + en) |
| Stories / tests | `EarnChecklist.stories.tsx` (Held, Fresh, CapReached, AllDone, Loading, Failed, Compact, AccountBanner); `earn-tasks.test.ts`, `EarnChecklist.test.tsx`, `PackagingProfileForm.test.tsx` |

### Routes map (task → page)

| Code | Route | Note |
|---|---|---|
| `signup` | `/account` | always done in practice |
| `line_link`, `google_link`, `apple_link` | `/account/notifications#linked-accounts` | the linked sign-in methods panel |
| `phone_verified` | `/account/notifications#linked-accounts` | **closest page**: no separate phone-verification page; the phone identity lives in that panel |
| `profile_completed` | `/account/addresses` | **closest page**: there is no profile-edit page (display name, business type, product category) yet |
| `tax_profile` | `/account/addresses#book-tax` | |
| `address` | `/account/addresses#book-addresses` | |
| `brand_kit` | `/business/assets` | **closest page**: company brand assets; a customer without a company is redirected by `requireMember` |
| `first_design` | `/studio/new?step=start` (`studioHref()`) | |
| `team_invite` | `/business/members` | |
| `packaging_profile` | `/account/packaging-profile` | new |
| `line_oa_friend` | `https://line.me/R/ti/p/<id>` (new tab) | id = `NEXT_PUBLIC_LINE_OA_ID`, else `store.support.channels.lineOaId`; none → `/help/chat` |

## 2. Contract assumptions

- Built against API-CHANGES-P1 exactly; until the getpack-api release is adopted the three operations run through
  the repo's contract-request layer (the rule in CLAUDE.md: no hand-written types beside `schema.d.ts`). After
  `pnpm gen:api --adopt --tag <release>`, `registry.test.ts` names the three entries: delete `store-loyalty.ts`'s
  requests and the mock, call `serverApi`/`browserApi`, keep `LoyaltyTasks`/`PackagingProfile` as `Schemas[...]`.
- The web never re-sorts: rows are the API order minus the `recommended` task, which moves to the "แนะนำถัดไป"
  block (not repeated in the list).
- Held and done rows are not links and carry no chevron; only todo rows are links.
- "ทำแล้ว n จาก m" counts `done` over all tasks returned (held is not done); the bar uses the same ratio.
- Cap reached = `capRemainingPoints <= 0`: no next block, muted points, footer explains. `remainingPoints` drives
  the banner (hidden at 0).
- `points` are integers rendered with the number formatter; `pointValue` is not used by the card.
- Realtime: `RealtimeProvider` exists, but its frames carry `{ type, id }` only (api-conventions §6) and invalidate by
  resource, so `loyalty.points_awarded` refetches `[customer, "loyalty", …]`. The toast comes from comparing the
  previous and new task lists (todo/held → done), deduped per page life; held entries are never toasted. The list
  also refetches on window focus; the form drops the `loyalty` cache and calls `router.refresh()` after saving.
  The payload's `points/taskCode` are not read (would need a provider change).
- `GET packaging-profile` with null fields = not saved. The PDPA acknowledgement is required on every save (the
  checkbox starts ticked when a saved profile has `purposeAccepted: true`).
- Toast on first completion: "+{points} แต้ม — กรอกข้อมูลการใช้บรรจุภัณฑ์", using the checklist's figure for the
  task (`rewardPoints`), only when the task is still todo and the cap is not used up; otherwise "บันทึกข้อมูลแล้ว".
- A failed tasks read hides the checklist and the banner (the account pages' rule: a convenience read never
  breaks a page). Loading/error states exist in the view for client refetches and Storybook.

## 3. Gate results (run in the Linux VM against the Mac's `node_modules`)

Native binaries in `node_modules` are darwin-only; Linux arm64 builds of rolldown and esbuild were installed
**outside the repo** (`$HOME/linuxbind`) and pointed at with `NAPI_RS_NATIVE_LIBRARY_PATH` / `ESBUILD_BINARY_PATH`.

| Gate | Result |
|---|---|
| `tsc --noEmit` (whole repo) | **SKIPPED** — takes > 170 s here; each call is capped at 180 s and background processes are killed between calls |
| `tsc` on every changed file and its import graph (temporary config, 200 src files incl. `schema.d.ts`) | **PASS** (verified the config reports a planted error) |
| ESLint on every changed file | **PASS** (one `react-hooks/purity` finding fixed) |
| Prettier `--check` on every changed file | **PASS** |
| Vitest: new tests (23) | **PASS** |
| Vitest: `src/features/customer/account`, `src/lib/api`, `src/i18n` (keys used, parity, wording, hard-coded strings), `mocks`, `src/lib/realtime`, `design-language.test.ts` — 40 files / 337 tests | **PASS** |
| `gen:api` (regenerated `contract-requests.openapi.json`) and `gen:api --check` | **PASS** |
| `tokens:check`, `contrast` (165 pairs × 3 themes) | **PASS** |
| Storybook build / run | **SKIPPED** — needs Vite + Tailwind's native bindings and a browser on the Mac |
| `next build`, e2e, Lighthouse | **SKIPPED** — no Next native SWC for Linux here, no API server |
| Visual compare of the real pages | **SKIPPED** — needs `pnpm dev:mock` on the Mac |

## 4. Commands for the owner (Mac)

```sh
cd getpack-web   # on feat/loyalty-p1-activity-rewards
pnpm install
pnpm gen:api:check                 # contract-requests.openapi.json in sync
pnpm typecheck && pnpm lint && pnpm test
pnpm tokens:check && pnpm contrast
pnpm storybook                     # Customer/Account/Earn checklist — check every story renders (Link under Vite)
pnpm build
pnpm dev:mock                      # MSW: one held, three done
#   http://localhost:3000/account/points       (checklist between the figures and the tier)
#   http://localhost:3000/account              (banner after "ต้องทำตอนนี้")
#   http://localhost:3000/liff/points          (compact)
#   http://localhost:3000/account/packaging-profile  (save → toast "+40 แต้ม — กรอกข้อมูลการใช้บรรจุภัณฑ์")
pnpm e2e
# Visual compare, prototype vs page: 1440, 1054, 390 light; 390 dark (dark follows the tokens)
#   prototypes/p1-earn-checklist.html, prototypes/p1-packaging-profile.html  vs the pages above
# When getpack-api publishes P1:
pnpm gen:api --adopt --tag vX.Y.Z  # registry.test.ts then lists the three requests to retire
```

## 5. Deviations and open issues

1. **"แต้ม" vs "คะแนน".** The existing points pages say "คะแนน" (title "คะแนนสะสม", balance, history); the
   owner-approved P1 copy says "แต้ม". P1 follows the approved copy, so `/account/points` now shows both words.
   Decide one word and swap the other namespace's strings (one pass over `account.points`, `account.home`, `liff`).
2. **Required marker.** The form uses the repo's `Field` convention (red asterisk + sr-only "จำเป็น") rather than the
   prototype's visible "จำเป็น" text; months are "(ไม่บังคับ)" in the label.
3. **Volume tiles on phone** are 2 × 2 (`RadioCards columns={4}`), not the prototype's single column.
4. **Missing pages** for `profile_completed`, `phone_verified` and `brand_kit` (for customers without a company):
   linked to the closest pages above. A profile-edit page is needed for `profile_completed` to be doable.
5. **Realtime toast** relies on the refetch diff, not the event payload (see §2).
6. **Storybook** stories render `Link` from `@/i18n/navigation` under `@storybook/react-vite`; not verified here.
   If it fails, add a `next/navigation` mock to `.storybook/preview.tsx`.
7. No form story (the form needs `useRouter` and a query client); the form is covered by vitest.
