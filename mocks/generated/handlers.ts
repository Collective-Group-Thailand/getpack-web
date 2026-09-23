/**
 * GENERATED FILE — do not edit.
 * Source: contract/openapi.json · Regenerate: pnpm gen:api · Gate: pnpm gen:api --check
 */

/**
 * Base handlers: every operation answered with the example the contract carries for it,
 * so `pnpm dev:mock` and the e2e suite run with no backend. Data is deliberately and
 * obviously fake. Override a handler in mocks/handlers.ts rather than editing this file.
 */

import { http, HttpResponse } from "msw";

export const generatedHandlers = [
  // contract/openapi.json (packio-api 0.1.0)
  http.get("*/health", () => HttpResponse.json({"details":{"database":{"status":"up"},"redis":{"status":"up"},"storage":{"status":"up"}},"error":{},"info":{"database":{"status":"up"},"redis":{"status":"up"},"storage":{"status":"up"}},"status":"ok"}, { status: 200 })),
  http.get("*/v1/admin/me", () => HttpResponse.json({"displayName":"การเงิน ทดสอบ","email":"finance.one@example.com","featureFlags":[],"id":"0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b","locale":"th","menu":[{"key":"dashboard","path":"/admin"},{"key":"approvals","path":"/admin/approvals"},{"key":"audit_logs","path":"/admin/audit-logs"}],"permissions":["approvals.act","approvals.read","audit_logs.read"],"roles":["finance"]}, { status: 200 })),
  http.get("*/v1/auth/.well-known/jwks.json", () => HttpResponse.json({"keys":[{"alg":"EdDSA","crv":"Ed25519","kid":"packio-2026-09","kty":"OKP","use":"sig","x":"11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo"}]}, { status: 200 })),
  http.post("*/v1/auth/customer/firebase", () => HttpResponse.json({"accessToken":"eyJhbGciOiJFZERTQSIsImtpZCI6ImV4YW1wbGUiLCJ0eXAiOiJhdCtqd3QifQ.eyJzdWIiOiJleGFtcGxlIn0.c2lnbmF0dXJl","accessTokenExpiresAt":"2026-09-23T14:15:00+07:00","refreshToken":"rt_example_Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0","refreshTokenExpiresAt":"2026-09-23T16:05:00+07:00","subject":{"id":"0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b","permissions":[],"roles":[],"scopes":[],"type":"customer"}}, { status: 200 })),
  http.post("*/v1/auth/customer/line", () => HttpResponse.json({"accessToken":"eyJhbGciOiJFZERTQSIsImtpZCI6ImV4YW1wbGUiLCJ0eXAiOiJhdCtqd3QifQ.eyJzdWIiOiJleGFtcGxlIn0.c2lnbmF0dXJl","accessTokenExpiresAt":"2026-09-23T14:15:00+07:00","refreshToken":"rt_example_Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0","refreshTokenExpiresAt":"2026-09-23T16:05:00+07:00","subject":{"id":"0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b","permissions":[],"roles":[],"scopes":[],"type":"customer"}}, { status: 200 })),
  http.post("*/v1/auth/customer/otp/request", () => HttpResponse.json({"challengeId":"0192f3a0-7c1e-7d2a-9b1f-00000000c0de","expiresAt":"2026-09-23T14:10:00+07:00","resendAvailableAt":"2026-09-23T14:06:00+07:00"}, { status: 200 })),
  http.post("*/v1/auth/customer/otp/verify", () => HttpResponse.json({"accessToken":"eyJhbGciOiJFZERTQSIsImtpZCI6ImV4YW1wbGUiLCJ0eXAiOiJhdCtqd3QifQ.eyJzdWIiOiJleGFtcGxlIn0.c2lnbmF0dXJl","accessTokenExpiresAt":"2026-09-23T14:15:00+07:00","refreshToken":"rt_example_Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0","refreshTokenExpiresAt":"2026-09-23T16:05:00+07:00","subject":{"id":"0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b","permissions":[],"roles":[],"scopes":[],"type":"customer"}}, { status: 200 })),
  http.post("*/v1/auth/logout", () => new HttpResponse(null, { status: 204 })),
  http.post("*/v1/auth/partner/login", () => HttpResponse.json({"accessToken":"eyJhbGciOiJFZERTQSIsImtpZCI6ImV4YW1wbGUiLCJ0eXAiOiJhdCtqd3QifQ.eyJzdWIiOiJleGFtcGxlIn0.c2lnbmF0dXJl","accessTokenExpiresAt":"2026-09-23T14:15:00+07:00","refreshToken":"rt_example_Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0","refreshTokenExpiresAt":"2026-09-23T16:05:00+07:00","subject":{"id":"0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b","permissions":["factory_profile.read","factory_users.manage"],"roles":["factory_owner"],"scopes":["factory:0192f3a0-7c1e-7d2a-9b1f-000000000f01"],"type":"partner"}}, { status: 200 })),
  http.post("*/v1/auth/refresh", () => HttpResponse.json({"accessToken":"eyJhbGciOiJFZERTQSIsImtpZCI6ImV4YW1wbGUiLCJ0eXAiOiJhdCtqd3QifQ.eyJzdWIiOiJleGFtcGxlIn0.c2lnbmF0dXJl","accessTokenExpiresAt":"2026-09-23T14:15:00+07:00","refreshToken":"rt_example_Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0","refreshTokenExpiresAt":"2026-09-23T16:05:00+07:00","subject":{"id":"0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b","permissions":["approvals.act","approvals.read"],"roles":["finance"],"scopes":[],"type":"staff"}}, { status: 200 })),
  http.post("*/v1/auth/staff/login", () => HttpResponse.json({"accessToken":"eyJhbGciOiJFZERTQSIsImtpZCI6ImV4YW1wbGUiLCJ0eXAiOiJhdCtqd3QifQ.eyJzdWIiOiJleGFtcGxlIn0.c2lnbmF0dXJl","accessTokenExpiresAt":"2026-09-23T14:15:00+07:00","refreshToken":"rt_example_Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0","refreshTokenExpiresAt":"2026-09-23T16:05:00+07:00","subject":{"id":"0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b","permissions":["approvals.act","approvals.read"],"roles":["finance"],"scopes":[],"type":"staff"}}, { status: 200 })),
  http.post("*/v1/auth/token", () => HttpResponse.json({"access_token":"eyJhbGciOiJFZERTQSIsImtpZCI6ImV4YW1wbGUiLCJ0eXAiOiJhdCtqd3QifQ.eyJzdWIiOiJleGFtcGxlIn0.c2lnbmF0dXJl","expires_in":600,"scope":"factory:0192f3a0-7c1e-7d2a-9b1f-000000000f01","token_type":"Bearer"}, { status: 200 })),
  http.get("*/v1/partner/me", () => HttpResponse.json({"displayName":"โรงงาน ทดสอบ","email":"planner@factory.example","factories":[{"factoryId":"0192f3a0-7c1e-7d2a-9b1f-000000000f01","roles":["factory_planner"]}],"id":"0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b","locale":"th","permissions":["factory_profile.read"],"roles":["factory_planner"]}, { status: 200 })),
  http.post("*/v1/partner/me/device-pins", () => new HttpResponse(null, { status: 204 })),
  http.delete("*/v1/partner/me/device-pins/:deviceId", () => new HttpResponse(null, { status: 204 })),
  http.get("*/v1/store/me", () => HttpResponse.json({"displayName":"ลูกค้า ทดสอบ","email":"customer.one@example.com","id":"0192f3a0-7c1e-7d2a-9b1f-3c4d5e6f7a8b","identities":[{"linkedAt":"2026-09-23T14:05:00+07:00","provider":"phone_otp"}],"locale":"th","permissions":[],"phone":"+66810001234","roles":[],"scopes":[]}, { status: 200 })),
];
