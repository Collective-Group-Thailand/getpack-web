# `src/domain` — domain presentation and client-side schemas

What a _value from the API_ means in the UI, shared by all three zones. No fetching, no
business rules, no money or date arithmetic — the API owns all of that (CLAUDE.md).

| Folder     | Holds                                       | State                             |
| ---------- | ------------------------------------------- | --------------------------------- |
| `status/`  | tone + icon + label key per status          | shape in F0.2, maps in F1         |
| `schemas/` | zod schemas for client-side form validation | F1, with the forms that need them |

## `status/`

`StatusMeta` is `{ tone, icon, labelKey }` — a status is never rendered from colour alone
(design-system.md §2), so a tone always arrives with an icon and words. `src/ui`'s
`StatusBadge` takes a `StatusMeta` and a resolved label; it cannot be handed a raw string, so
there is nowhere for a second colour map to grow.

`defineStatusMap<T>()` makes the map exhaustive. In F1 the type argument becomes a generated
contract enum:

```ts
export const ORDER_STATUS = defineStatusMap<Schemas["OrderStatus"]>({ … });
```

A new status on the backend then fails `pnpm typecheck` until it has a tone, an icon and a
label — the mechanism 00-master-plan.md §5 asks for. `statusMeta()` still falls back to a
visible "?" badge at runtime, because a customer should never see a blank where a status
belongs.

Labels live in the `status` message namespace in `src/i18n`, added in F1 with the maps.
