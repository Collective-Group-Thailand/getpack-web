# Contract requests (frontend → packio-api)

Endpoints or fields the frontend needs that are not yet in `contract/openapi.json`. Each entry is mirrored by an MSW mock marked `// CONTRACT-REQUEST <id>`; remove both when the contract ships.

The rows below are all served by `mocks/seed-openapi.json`, the seed contract F1 1.2 wrote so the clients, the BFF and the login screens could be built without hand-writing response types. They are **not invented**: every path and field is taken from `docs/contract/api-conventions.md` §4, `packio-api/docs/adr/0004-auth-audiences-and-tokens.md`, or `packio-api/docs/prompts/B1-foundation.md` Deliverable 1.3, which names each endpoint literally. They are expected to land as-is, or close to it, with backend B1.3 — at which point the seed file, `src/lib/api/schema.seed.d.ts` and every row here are deleted together.

| Id | Date | Zone / screen | Method & path | Purpose | Request / response fields | Legacy reference | Status |
|---|---|---|---|---|---|---|---|
| auth.staff.login | 2026-09-23 | admin / login | `POST /v1/auth/staff/login` | Staff sign-in | req `{ email, password }` → `SessionResponse` | — | Seeded, awaiting B1.3 |
| auth.customer.otp.request | 2026-09-23 | customer / sign-in sheet | `POST /v1/auth/customer/otp/request` | Send a login OTP by SMS (D-143) | req `{ phone }` → `{ ref, codeLength, expiresAt, resendAfterSeconds, attemptsRemaining }` | — | Seeded, awaiting B1.3 |
| auth.customer.otp.verify | 2026-09-23 | customer / sign-in sheet | `POST /v1/auth/customer/otp/verify` | Exchange an OTP for a session | req `{ phone, ref, code }` → `SessionResponse` | — | Seeded, awaiting B1.3 |
| auth.customer.firebase | 2026-09-23 | customer / sign-in sheet | `POST /v1/auth/customer/firebase` | Exchange a Firebase ID token (Google/Apple) | req `{ idToken }` → `SessionResponse` | — | Seeded, awaiting B1.3 |
| auth.customer.line | 2026-09-23 | customer / sign-in sheet, LIFF | `POST /v1/auth/customer/line` | LINE Login (code) or LIFF (access token), with linking (D-151) | req `{ code, redirectUri }` or `{ accessToken }` → `SessionResponse` | — | Seeded, awaiting B1.3 |
| auth.partner.login | 2026-09-23 | partner / login | `POST /v1/auth/partner/login` | Partner sign-in, optional shared-device PIN | req `{ username, password, devicePin? }` → `SessionResponse` | — | Seeded, awaiting B1.3 |
| auth.refresh | 2026-09-23 | all zones (proxy + BFF) | `POST /v1/auth/refresh` | Rotate a refresh token | req `{ refreshToken }` → `SessionResponse` | — | Seeded, awaiting B1.3 |
| auth.logout | 2026-09-23 | all zones | `POST /v1/auth/logout` | Revoke the session; idempotent so sign-out never fails | req `{ refreshToken }` → `204` | — | Seeded, awaiting B1.3 |
| store.me.show | 2026-09-23 | customer / account guard | `GET /v1/store/me` | The signed-in customer | → `{ id, type, displayName, userCode, phone, email, locale, lineLinked, companies[], scopes[] }` | — | Seeded, awaiting B1.3 |
| admin.me.show | 2026-09-23 | admin / shell guard, sidebar (F1 1.3) | `GET /v1/admin/me` | Staff identity, permissions, **menu entitlements**, feature flags (D-140, D-141) | → `{ id, type, displayName, email, locale, roles[], permissions[], scopes[], menu[], features{} }` | `menu.blade.php` role menu (F2 Appendix A.1) | Seeded, awaiting B1.3 |
| partner.me.show | 2026-09-23 | partner / shell guard | `GET /v1/partner/me` | Partner identity and the factories they may act for | → `{ id, type, displayName, locale, roles[], permissions[], scopes[], factories[] }` | — | Seeded, awaiting B1.3 |

## Policy values the UI must read, never hard-code

`CLAUDE.md` forbids hard-coding anything a decision marks configurable, and **no `D-###` owns these numbers** — `docs/decisions.md` establishes only *that* SMS OTP exists (D-143). The seed therefore returns them on the OTP challenge, and the sign-in sheet renders what it is given. They need a home in the backend's settings (packio-api ADR-0005 effective-dated configuration), and backend ADR-0004 already lists them as "open for B1.3":

| Value | Where the UI reads it today | Needs |
|---|---|---|
| OTP code length | `OtpChallenge.codeLength` | confirm, and whether it can differ per channel |
| OTP expiry | `OtpChallenge.expiresAt` | confirm |
| OTP resend cooldown | `OtpChallenge.resendAfterSeconds` | confirm |
| OTP attempt limit | `OtpChallenge.attemptsRemaining` | confirm, plus the lock-out `code` returned on exhaustion |
| Access-token lifetime (10–15 min) | `SessionResponse.accessTokenExpiresAt` | nothing — the UI only reads the timestamp |
| Refresh lifetime / idle timeout per audience | `SessionResponse.refreshTokenExpiresAt` | confirm whether idle timeout is separate from absolute expiry |
| Partner device-PIN policy | not surfaced | decide whether the PIN is required per factory, and how the UI learns that |
