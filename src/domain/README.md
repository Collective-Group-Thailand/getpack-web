# `src/domain` — how the API's vocabulary is presented

Presentation metadata for the values the backend owns, and nothing else. No business
rules: money, lead times and business dates are computed by `packio-api` and rendered
here as they arrive.

Planned in F1, once `pnpm gen:api` produces `src/lib/api/schema.d.ts`:

- `status/` — one entry per order, payment, graphic, job, shipment and claim status:
  Thai and English label, tone and icon. Typed as `Record<Schemas["OrderStatus"], StatusMeta>`
  so a new backend enum value fails this build until someone gives it a label
  (`00-master-plan.md` §5).
- form schemas (zod) shared by more than one zone.

Never rely on colour alone for a status — always icon plus text.
