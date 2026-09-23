# `src/domain` — domain presentation and client-side schemas

What a _value from the API_ means in the UI, shared by all three zones. No fetching, no
business rules, no money or date arithmetic — the API owns all of that (CLAUDE.md).

| Folder     | Holds                                       | State                             |
| ---------- | ------------------------------------------- | --------------------------------- |
| `status/`  | tone + icon + label key per status          | shape F0.2, eleven maps F1 1.3    |
| `schemas/` | zod schemas for client-side form validation | F1, with the forms that need them |

## `status/`

`StatusMeta` is `{ tone, icon, labelKey }` — a status is never rendered from colour alone
(design-system.md §2), so a tone always arrives with an icon and words. `src/ui`'s
`StatusBadge` takes a `StatusMeta` and a resolved label; it cannot be handed a raw string, so
there is nowhere for a second colour map to grow.

`defineStatusMap<T>()` makes the map exhaustive. The type argument comes from
[`status/contract.ts`](./status/contract.ts), which is the one file that changes when the
backend publishes its enums:

```ts
// today
export type OrderStatus = "waiting_payment" | "paid" | …;
// the day packio-api ships the component
export type OrderStatus = Schemas["OrderStatus"];
```

Every map imports its union from there and never declares one inline, so that switch is a
one-file edit and the differences arrive as type errors naming the exact values that moved —
the mechanism 00-master-plan.md §5 asks for. `statusMeta()` still falls back to a visible "?"
badge at runtime, because a customer should never see a blank where a status belongs.

`contract.ts` records, per vocabulary, whether the values are **sourced** (legacy §5.2 for
order/payment/artwork, `accounting-design.md` for document) or **proposed** — the seven
workflows Packio has no prior vocabulary for. The proposals are a request to the backend,
logged as `status.enums` in `docs/contract-requests.md`, not a claim about the contract.

Labels live in the `status` namespace in `src/i18n`, shared by all three zones: a status must
read the same to the customer and to the CS agent looking at the same row.

## `next-action.ts`

The API decides which actions exist (`nextActions` on the entity); this only turns a key into
a label, a tone and an icon. An action key the table has never met still renders — hiding a
capability the backend just shipped is worse than a label that reads awkwardly.
