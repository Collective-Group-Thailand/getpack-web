/**
 * `src/domain/status` — how a status looks and reads, for every zone.
 *
 * F0.2 lays down the shape only: the type, the `defineStatusMap` helper that enforces
 * completeness, and the tone vocabulary shared with `src/ui`. The real maps (order, payment,
 * graphic, job, shipment, claim — D-140 and the status tables in docs/decisions.md) arrive in
 * F1, keyed to the generated contract enums, together with their `status` message namespace.
 *
 * Nothing here imports from a feature or an app route: a status means the same thing in the
 * customer's order page, the admin queue and the partner job card.
 */

export { defineStatusMap, statusMeta, UNKNOWN_STATUS, type StatusMeta, type StatusTone } from "./types";
