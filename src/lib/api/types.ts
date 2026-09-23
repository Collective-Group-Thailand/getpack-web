/**
 * The one place the generated contract types are named.
 *
 * `ContractPaths` is what `packio-api` has actually agreed to (`contract/openapi.json`,
 * pinned by `contract.lock.json`). `SeedPaths` is the temporary auth surface hand-written in
 * `mocks/seed-openapi.json` while packio-api B1.3 is in flight — every operation behind it
 * has a row in `docs/contract-requests.md`.
 *
 * When B1.3 publishes: run `pnpm gen:api --adopt`, delete `mocks/seed-openapi.json` and
 * `src/lib/api/schema.seed.d.ts`, and remove the two seed lines below. Everything still
 * typed against the seed then fails `pnpm typecheck`, which is the point — a shape nobody
 * agreed to cannot survive quietly (ADR-0006).
 */

import type { components as SeedComponents, paths as SeedPathsGenerated } from "./schema.seed";
import type { components as ContractComponents, paths as ContractPathsGenerated } from "./schema";

/** The real, agreed contract. */
export type ContractPaths = ContractPathsGenerated;

/** SEED — remove with mocks/seed-openapi.json when packio-api B1.3 ships. */
export type SeedPaths = SeedPathsGenerated;

/** Every path this app may call: the real contract plus, for now, the seeded auth surface. */
export type ApiPaths = ContractPaths & SeedPaths;

/** Schema components from the real contract. */
export type Schemas = ContractComponents["schemas"];

/** SEED — schema components from the seed contract. */
export type SeedSchemas = SeedComponents["schemas"];

/** The session body every login and refresh endpoint returns (api-conventions §4). */
export type Session = SeedSchemas["SessionResponse"];

/** The signed-in principal, as `/v1/{surface}/me` describes it. */
export type CustomerMe = SeedSchemas["CustomerMe"];
export type StaffMe = SeedSchemas["StaffMe"];
export type PartnerMe = SeedSchemas["PartnerMe"];
export type MenuEntitlement = SeedSchemas["MenuEntitlement"];
