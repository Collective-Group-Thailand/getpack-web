# ADR-0006 — Contract consumption and mocks

**Status:** Accepted (2026-09-22) · implemented in F1

## Context

`packio-api` and `packio-web` are separate repositories (D-002) built in parallel, and
F2–F6 run in parallel worktrees against backend deliverables that do not exist yet. The
failure mode to avoid is a frontend that compiles happily against a shape the backend
never agreed to, and only fails in integration.

## Decision

**The OpenAPI contract is the only thing the two repositories share, and the frontend
never hand-writes a type the contract can produce.**

- `pnpm gen:api` reads `API_CONTRACT_SOURCE` (locally `../packio-api/contract/openapi.json`;
  in CI the release asset pinned in `contract.lock.json` with its sha256), runs
  `openapi-typescript` into `src/lib/api/schema.d.ts`, and regenerates the MSW base
  handlers in `mocks/generated/`. The generated file is **committed**.
- CI fails if regenerating produces a diff. Upgrading the backend contract is therefore a
  PR that bumps `contract.lock.json`; the resulting type errors are the change list.
- `src/domain/status/*` is typed `Record<Schemas["OrderStatus"], StatusMeta>` and friends,
  so a new backend enum value **fails this build** until it has a Thai label, an English
  label, a tone and an icon.
- An endpoint that does not exist yet is written into `docs/contract-requests.md` (method,
  path, purpose, fields) and mocked in MSW behind a `// CONTRACT-REQUEST <id>` marker.
  Inventing a response shape silently is not allowed.
- A screen is not done while a `CONTRACT-REQUEST` mock is still serving it; the Definition
  of Done requires it to run against the real backend in the integration environment.

## Consequences

- Breaking backend changes surface as compile errors in the PR that adopts them, not at
  runtime.
- `pnpm dev:mock` runs the whole app against MSW with no backend, which is what lets
  F2–F6 proceed in parallel.
- Every `CONTRACT-REQUEST` marker is a tracked debt with a row in
  `docs/contract-requests.md`; both disappear together when the contract ships.
