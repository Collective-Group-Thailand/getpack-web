/**
 * GENERATED FILE — do not edit.
 * Source: contract/openapi.json + mocks/seed-openapi.json · Regenerate: pnpm gen:api · Gate: pnpm gen:api --check
 */

/**
 * Base handlers: every operation answered with the example from the document it came from,
 * so `pnpm dev:mock` and the e2e suite run with no backend. Data is deliberately and
 * obviously fake. Override a handler in mocks/handlers.ts rather than editing this file.
 *
 * Handlers carrying a CONTRACT-REQUEST marker are served from the seed contract and have a
 * row in docs/contract-requests.md. Both disappear when packio-api publishes the real one.
 */

import { http, HttpResponse } from "msw";

export const generatedHandlers = [
  // contract/openapi.json (packio-api 0.1.0)
  http.get("*/health", () => HttpResponse.json({"details":{"database":{"status":"up"},"redis":{"status":"up"},"storage":{"status":"up"}},"error":{},"info":{"database":{"status":"up"},"redis":{"status":"up"},"storage":{"status":"up"}},"status":"ok"}, { status: 200 })),
  // mocks/seed-openapi.json — SEED, not agreed by packio-api
  // CONTRACT-REQUEST auth.staff.login
  http.post("*/v1/auth/staff/login", () => HttpResponse.json({"accessToken":"seed.access.token.staff","accessTokenExpiresAt":"2026-09-23T14:15:00+07:00","refreshToken":"seed-refresh-token-staff","refreshTokenExpiresAt":"2026-10-23T14:00:00+07:00","subject":{"id":"00000000-0000-4000-8000-000000000002","type":"staff","roles":["cs"],"permissions":["orders.read","orders.update","quotations.create"],"scopes":["platform"]}}, { status: 200 })),
  // CONTRACT-REQUEST auth.customer.otp.request
  http.post("*/v1/auth/customer/otp/request", () => HttpResponse.json({"ref":"MOCK-4821","codeLength":6,"expiresAt":"2026-09-23T14:10:00+07:00","resendAfterSeconds":60,"attemptsRemaining":5}, { status: 200 })),
  // CONTRACT-REQUEST auth.customer.otp.verify
  http.post("*/v1/auth/customer/otp/verify", () => HttpResponse.json({"accessToken":"seed.access.token.customer","accessTokenExpiresAt":"2026-09-23T14:15:00+07:00","refreshToken":"seed-refresh-token-customer","refreshTokenExpiresAt":"2026-10-23T14:00:00+07:00","subject":{"id":"00000000-0000-4000-8000-000000000001","type":"customer","roles":["customer"],"permissions":[],"scopes":[]}}, { status: 200 })),
  // CONTRACT-REQUEST auth.customer.firebase
  http.post("*/v1/auth/customer/firebase", () => HttpResponse.json({"accessToken":"seed.access.token.customer","accessTokenExpiresAt":"2026-09-23T14:15:00+07:00","refreshToken":"seed-refresh-token-customer","refreshTokenExpiresAt":"2026-10-23T14:00:00+07:00","subject":{"id":"00000000-0000-4000-8000-000000000001","type":"customer","roles":["customer"],"permissions":[],"scopes":[]}}, { status: 200 })),
  // CONTRACT-REQUEST auth.customer.line
  http.post("*/v1/auth/customer/line", () => HttpResponse.json({"accessToken":"seed.access.token.customer","accessTokenExpiresAt":"2026-09-23T14:15:00+07:00","refreshToken":"seed-refresh-token-customer","refreshTokenExpiresAt":"2026-10-23T14:00:00+07:00","subject":{"id":"00000000-0000-4000-8000-000000000001","type":"customer","roles":["customer"],"permissions":[],"scopes":[]}}, { status: 200 })),
  // CONTRACT-REQUEST auth.partner.login
  http.post("*/v1/auth/partner/login", () => HttpResponse.json({"accessToken":"seed.access.token.partner","accessTokenExpiresAt":"2026-09-23T14:15:00+07:00","refreshToken":"seed-refresh-token-partner","refreshTokenExpiresAt":"2026-10-23T14:00:00+07:00","subject":{"id":"00000000-0000-4000-8000-000000000003","type":"partner","roles":["planner"],"permissions":["jobs.read","jobs.update"],"scopes":["factory:00000000-0000-4000-8000-0000000000f1"]}}, { status: 200 })),
  // CONTRACT-REQUEST auth.refresh
  http.post("*/v1/auth/refresh", () => HttpResponse.json({"accessToken":"seed.access.token.staff","accessTokenExpiresAt":"2026-09-23T14:15:00+07:00","refreshToken":"seed-refresh-token-staff","refreshTokenExpiresAt":"2026-10-23T14:00:00+07:00","subject":{"id":"00000000-0000-4000-8000-000000000002","type":"staff","roles":["cs"],"permissions":["orders.read","orders.update","quotations.create"],"scopes":["platform"]}}, { status: 200 })),
  // CONTRACT-REQUEST auth.logout
  http.post("*/v1/auth/logout", () => new HttpResponse(null, { status: 204 })),
  // CONTRACT-REQUEST store.me.show
  http.get("*/v1/store/me", () => HttpResponse.json({"id":"00000000-0000-4000-8000-000000000001","type":"customer","displayName":"ลูกค้าตัวอย่าง (ข้อมูลจำลอง)","userCode":"MOCK-C-0001","phone":"0812345678","email":"seed.customer@packio.invalid","locale":"th","lineLinked":false,"companies":[],"scopes":[]}, { status: 200 })),
  // CONTRACT-REQUEST admin.me.show
  http.get("*/v1/admin/me", () => HttpResponse.json({"id":"00000000-0000-4000-8000-000000000002","type":"staff","displayName":"พนักงานตัวอย่าง (ข้อมูลจำลอง)","email":"seed.staff@packio.invalid","locale":"th","roles":["cs"],"permissions":["orders.read","orders.update","quotations.create"],"scopes":["platform"],"menu":[{"key":"dashboard","href":"/","icon":"box"},{"key":"orders","href":"/orders","icon":"package","children":[{"key":"orders.all","href":"/orders"}]}],"features":{"labelCalculator":true}}, { status: 200 })),
  // CONTRACT-REQUEST partner.me.show
  http.get("*/v1/partner/me", () => HttpResponse.json({"id":"00000000-0000-4000-8000-000000000003","type":"partner","displayName":"โรงงานตัวอย่าง (ข้อมูลจำลอง)","locale":"th","roles":["planner"],"permissions":["jobs.read","jobs.update"],"scopes":["factory:00000000-0000-4000-8000-0000000000f1"],"factories":[{"id":"00000000-0000-4000-8000-0000000000f1","name":"โรงงานจำลอง หนึ่ง","status":"active"}]}, { status: 200 })),
];
