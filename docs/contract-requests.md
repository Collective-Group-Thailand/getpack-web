# Contract requests (frontend → packio-api)

Endpoints or fields the frontend needs that are not yet in `contract/openapi.json`. Each entry is mirrored by an MSW mock marked `// CONTRACT-REQUEST <id>`; remove both when the contract ships.

| Id | Date | Zone / screen | Method & path | Purpose | Request / response fields | Legacy reference | Status |
|---|---|---|---|---|---|---|---|
| otp.code-length | 2026-09-23 | customer / sign-in sheet | `POST /v1/auth/customer/otp/request` | `OtpChallengeDto` carries `challengeId`, `expiresAt` and `resendAvailableAt`, but not how many digits the code has. The OTP field has to size itself, and the verify button has to know when the code is complete, so the UI currently assumes 6 — the value B1-foundation specifies. | add `codeLength: integer` to `OtpChallengeDto` | — | Open — UI assumes 6 (`OTP_CODE_LENGTH`) |
| otp.attempts-remaining | 2026-09-23 | customer / sign-in sheet | `POST /v1/auth/customer/otp/verify` | Nothing tells a customer how many tries are left before the challenge is locked, so the first they learn of a limit is being refused. A count would let the sheet warn on the last attempt. | add `attemptsRemaining: integer` to `OtpChallengeDto`, or return it on a failed verify | — | Open |
| partner.factory-name | 2026-09-23 | partner / shell (F5), admin / partners (F2.6) | `GET /v1/partner/me` | `FactoryAccessDto` gives `factoryId` and `roles`. A partner user who works for more than one factory cannot be shown which one they are acting for, so the shell has nothing to label the switcher with. | add `name: string` to `FactoryAccessDto` | — | Open — the zone currently shows roles |

## Resolved

| Id | Resolved | Note |
|---|---|---|
| auth.* , {store,admin,partner}.me | 2026-09-23 | packio-api **B1.3** published the whole auth surface — staff, partner, customer OTP, Firebase, LINE, refresh, logout, JWKS, client credentials, device PINs and all three `/me` endpoints. The seed contract F1.2 built against (`mocks/seed-openapi.json`, `schema.seed.d.ts`) is deleted; `pnpm gen:api --adopt` took the real one and the differences surfaced as type errors, which is what ADR-0006 designed for. |

## Policy values the UI reads rather than hard-codes

`CLAUDE.md` forbids hard-coding anything a decision marks configurable. B1.3 settled most of these by putting them in the contract; what is left is listed above.

| Value | Where the UI reads it | State |
|---|---|---|
| OTP expiry | `OtpChallengeDto.expiresAt` | in the contract |
| OTP resend cooldown | `OtpChallengeDto.resendAvailableAt` | in the contract — an instant, which the countdown uses directly |
| OTP code length | — | **not in the contract**; see `otp.code-length` above |
| OTP attempt limit | — | **not in the contract**; see `otp.attempts-remaining` above |
| Access-token lifetime | `TokenPairDto.accessTokenExpiresAt` | in the contract |
| Refresh lifetime | `TokenPairDto.refreshTokenExpiresAt` | in the contract |
| Partner device-PIN policy | `PartnerLoginDto` makes only `email` required, so either a password or a PIN signs in | in the contract — the API decides which a factory allows |
