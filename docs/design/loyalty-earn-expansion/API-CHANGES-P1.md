# API changes — P1 (contract both sides build against)

All amounts are decimal strings; points are integers. Store surface, customer audience only (403 for anyone else).
Errors use the existing `DomainException` codes.
Date-times are ISO 8601 with the Bangkok offset (`+07:00`), as every other API date (api-conventions §2); the examples
below were updated from `Z` to match (same instants are equally valid ISO 8601 for the web parser).

## GET /v1/store/loyalty/tasks — `store.loyalty.tasks`

The earn checklist, derived from settings and the ledger (no new table). It is sorted for display: `todo` and
`held` by points desc, then `done` by `doneAt` desc.

```json
{
  "tasks": [
    {
      "code": "tax_profile",
      "points": 40,
      "status": "todo",
      "doneAt": null,
      "heldReason": null,
      "recommended": true
    },
    { "code": "address", "points": 8, "status": "held", "doneAt": null, "heldReason": "duplicate_identity", "recommended": false },
    { "code": "phone_verified", "points": 8, "status": "done", "doneAt": "2026-11-02T10:10:00+07:00", "heldReason": null, "recommended": false }
  ],
  "earnedPoints": 56,
  "remainingPoints": 136,
  "capPoints": 600,
  "capRemainingPoints": 564,
  "pointValue": "2.50"
}
```

- `code` ∈ `signup | line_link | google_link | apple_link | phone_verified | profile_completed | tax_profile |
  address | brand_kit | first_design | team_invite | packaging_profile | line_oa_friend`. The **web owns titles,
  descriptions and routes** (i18n `account.points.tasks.<code>.*`), so the API sends no copy and no hrefs.
- `recommended`: exactly one todo task, the one with the highest points (ties broken by the order above), or none.
- `remainingPoints` = sum of todo points, capped by `capRemainingPoints`.
- A task whose reward is 0 in settings is omitted. `line_oa_friend` is omitted when the LINE OA is not configured.
- `held` only when DEC-5 applies (the entry is `pending` with meta reason `held_duplicate_identity`).
  `heldReason` is the enum `duplicate_identity`, and the UI shows only "รอตรวจสอบ".
- A held reward Marketing **rejects** can never be earned again (one per account), so its task is omitted from the
  list (API decision, P1 build). A `done` task shows the points actually written, which may differ from today's
  setting if the value changed since.
- `line_link` is `done` for customers rewarded before P1 (`earn_line_link`) as well as for `earn_identity_link`
  with `meta.provider = line`.

## GET /v1/store/loyalty/packaging-profile — `store.loyalty.getPackagingProfile`
## PUT /v1/store/loyalty/packaging-profile — `store.loyalty.updatePackagingProfile`

> **Operation ids changed by the API (2026-11-04, P1 build).** The requested ids `store.loyalty.packagingProfile.get`
> / `.put` have four segments; `@ApiEndpoint` only accepts `<surface>.<tag>.<action>` (`OPERATION_ID_PATTERN`,
> api-conventions §5) and refuses to boot otherwise. They follow `admin.styleLibrary.getSettings` /
> `updateSettings`. Paths, methods, bodies and responses are unchanged; only generated client method names differ.

```json
{
  "monthlyBoxVolume": "500_2000",
  "productCategories": ["food", "cosmetics"],
  "shipToRegions": ["bangkok_metro", "north"],
  "peakMonths": [11, 12],
  "purposeAccepted": true,
  "completedAt": "2026-11-04T15:00:00+07:00",
  "updatedAt": "2026-11-04T15:00:00+07:00"
}
```

- GET returns `null` fields (and `completedAt: null`) when the profile doesn't exist yet. It never returns 404.
- The PUT body takes the same fields minus the timestamps. Validation:
  - `monthlyBoxVolume` ∈ `lt_500 | 500_2000 | 2000_10000 | gt_10000`;
  - `productCategories` ⊆ `food | beverage | cosmetics | apparel | electronics | ecommerce | industrial | other` (1–8);
  - `shipToRegions` ⊆ `bangkok_metro | central | north | northeast | east | west | south` (1–7);
  - `peakMonths` ⊆ 1…12 (0–12);
  - `purposeAccepted` must be `true` (PDPA purpose shown on the form).
- The first complete save sets `completedAt`, emits `customer.packaging_profile_completed` and earns
  `earn_packaging_profile` once.
- The data is internal: never on a public or store response other than this endpoint, and never exported outside the
  Marketing and Finance roles.

## Realtime — `loyalty.points_awarded` (user channel)

> **Changed by the API (2026-11-04, P1 build).** The user channel exists (`user:<customer public id>`, SSE through
> `RealtimePublisher`), but `docs/contract/api-conventions.md` §6 allows **type + id only** in realtime payloads ("no
> business data; the client refetches"). The signal is therefore:
>
> `{ "type": "loyalty.points_awarded", "id": "<points entry public id>" }`
>
> sent after commit when an onboarding reward is credited (`points.issued`) or held (`points.reward_held`). The web
> refetches `GET /v1/store/loyalty/tasks`, diffs it with the list it had, and shows the toast for the task that
> became `done` ("+40 แต้ม — เพิ่มข้อมูลผู้เสียภาษี") or `held` ("รอตรวจสอบ"). Points, task code and status come from
> the tasks response, never from the signal. Without a live stream the web still refetches on focus and after the
> form saves.

Original request (kept for reference, not implemented): `{ "entryType": "earn_tax_profile", "taskCode":
"tax_profile", "points": 40, "status": "available" | "pending" }`.

## Settings

- `loyalty.activity_rewards` (new version, baht strings):
  - `signupBaht 50.00`, `identityLinkBaht 20.00` (LINE/Google/Apple each), `phoneVerifiedBaht 20.00`;
  - `profileCompletedBaht 50.00`, `taxProfileBaht 100.00`, `addressBaht 20.00`, `brandKitBaht 50.00`;
  - `firstDesignBaht 20.00`, `teamInviteBaht 50.00`, `packagingProfileBaht 100.00`, `lineOaFriendBaht 20.00`;
  - `reviewBaht 10.00` (unchanged in P1);
  - `lineLinkingBaht` is kept as a read alias for older rows.
- `loyalty.activity_cap`: `{ "bahtPer12m": "1500.00" }` (DEC-4; activity + bonus only, rolling 365 days).

## Entry types

New `points_entry_type` values:
- `earn_identity_link` (replaces new uses of `earn_line_link`; meta.provider);
- `earn_phone_verified`, `earn_profile_completed`, `earn_tax_profile`, `earn_address`;
- `earn_brand_kit`, `earn_first_design`, `earn_team_invite`, `earn_packaging_profile`, `earn_line_oa_friend`.

One per account, plus `meta->>'provider'` for identity links. Accounting posts these exactly like `earn_signup` (P10).
