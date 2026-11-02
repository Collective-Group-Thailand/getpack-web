# getpack Agent — AUTORUN-STATE

Maintained by the autorun (block A of `AGENT-PORTAL-AUTORUN.md`). Identical copy in `getpack-api`.

## Status

- Started: 2026-11-02 22:18 Asia/Bangkok
- Current phase: P0
- Step: api
- Overall: RUNNING

## Environment (pre-flight, 2026-11-02)

- Runs in a Linux workspace linked to the owner's folder `~/Collective/getpack` (both repos cloned from GitHub,
  the owner's unpushed main commits applied by bundle, main pushed). Node 24.11.0, pnpm 10.18.1.
- Docker: **not available** → every Docker gate (API e2e, web e2e/visual) is SKIPPED-DOCKER; unit, lint,
  typecheck, build, contract, migrate status, confidentiality and golden tests run.
- Database: local PostgreSQL 16 + pgvector with a `uuidv7()` shim (production is PostgreSQL 18); the owner's UAT
  copy DB on his Mac is not reachable from here → data jobs run dry-run against the local DB; UAT runs listed under
  "สิ่งที่คุณต้องทำ".
- Design skill `ui-ux-pro-max`: installed; its `search.py` cannot be executed here (policy) → rules applied from
  the pack's `<design-method>` and the skill's reference files (read, not run).
- Contract draft `getpack-api/docs/legal/sales-agent-agreement-v2-draft.md`: **missing** → Phase 1 skips the seed,
  OPEN QUESTION recorded.

## Branches

| Phase | Branch | api | web |
|---|---|---|---|
| docs | main | c868f281 | b3a2e015 |

## Last commit per repo

- getpack-api: c868f281 (main)
- getpack-web: b3a2e015 (main)

## BLOCKED

(none)

## Skipped phases

(none)

## Open questions

1. Agreement v2 draft not exported from Claude Docs → Phase 1 keeps the published agreement; seed when the file lands.

## Decisions recorded

(none yet)
