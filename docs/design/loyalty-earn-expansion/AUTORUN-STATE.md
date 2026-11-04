# AUTORUN-STATE — getpack Points & Deals

- **Status:** PARTIAL. P1 code is complete; its gate runs on the owner's Mac.
- **Current phase:** P1 · **step:** gate (Mac).
- **Branches:** `feat/loyalty-p1-activity-rewards` in getpack-api (@ `60c5c23d`) and getpack-web (@ `e7ae2b85`). Both
  exist in the main repos (fetched) and in the sibling clones `getpack-api-p1` / `getpack-web-p1`.
- **Main:** api `27b947ce` → `b61cd4ae` (plan + autorun docs) · web `f4e0c781` → `24fd4035`.
- **Not merged:** gates 2, 4, 5, 7 and 9 need Docker, Postgres, pnpm and Node 24.
- **BLOCKED:** none (P1 is waiting on the Mac gate, not blocked).
- **Skipped phases:** P1.5, P2 and P3 have not started, because P1.5 depends on P1 being merged.
- **Decisions recorded:** D-473 … D-486.
- **Open questions:** คะแนน vs แต้ม wording · pages for profile_completed / phone_verified · whether activity rewards
  count in the points liability.
- **Resume:** on the Mac, after the gate passes and both branches are merged, run Block B (resume) or C (rerun P1).
  It continues from P1.5.
