# ADR-0005 — BFF, cookies and token handling

**Status:** Accepted (2026-09-22) · cookie names, flags and the proxy's refresh decision
implemented in F1 Deliverable 1.1; the BFF handler, the API clients and the login flows in 1.2

## Context

Three audiences with different tokens (anonymous/customer, staff, partner) talk to one
API. Tokens must survive a page reload, must not be readable by JavaScript, and must never
leak from the storefront into a staff session. Server Components need a token at render
time; Client Components need one per request; file downloads must stream.

## Decision

The app is the only thing the browser talks to. Every browser request to the API goes
through a **backend-for-frontend route handler owned by the zone**.

- **Cookies** are host-only, `HttpOnly`, `Secure`, `SameSite=Lax`, `__Host-` prefixed:
  `__Host-pk_at` and `__Host-pk_rt`. Because zones have different hosts (ADR-0004), the
  cookies cannot cross between them. **No token ever goes to localStorage or a
  JS-readable cookie.**
- **Server Components** fetch through `serverApi(zone)`: openapi-fetch against
  `API_INTERNAL_URL`, with the access token from the zone cookie and `Accept-Language`.
  Lists render on the server and hydrate TanStack Query.
- **Client Components** use `browserApi`, base URL `/bff`, same generated types. The BFF
  allow-lists upstream prefixes per zone (customer → `/v1/store`, `/v1/auth/customer`;
  admin → `/v1/admin`; partner → `/v1/partner`), attaches the token, streams the response
  back including file downloads, refreshes once on `401`, and requires a same-origin
  `Origin` plus the header `x-packio-csrf: 1` on anything that is not a GET.
- **Token refresh** happens in `src/proxy.ts` before rendering, because Server Components
  cannot set cookies, and again inside the BFF.
- **Login** is a Server Action or route handler that calls `/v1/auth/*`, sets the cookies
  and redirects: staff username/password, customer phone OTP with Firebase and LINE as
  alternatives, partner login with an optional device PIN.
- **Authorisation in the UI** reads `/v1/{surface}/me` for roles, permissions and menu
  entitlements. The UI only hides what the user may not do; **the API is the enforcement
  point** and the UI never assumes otherwise.
- Server Actions are for auth and small progressive-enhancement forms only. Business
  mutations go through the BFF so error mapping, `Idempotency-Key` and optimistic updates
  are handled in one place.

## Consequences

- An XSS in any zone cannot read a token, and cannot reach another zone's API prefix.
- Every irreversible action (approve slip, start production manually, cancel, refund,
  credit note, payout approval, bank-account change, period close, checkout pay) sends an
  `Idempotency-Key` through the BFF; the typed confirmation dialog is the UI half of the
  same rule (`00-master-plan.md` section 8).
- Realtime payloads carry ids only; the client invalidates TanStack Query keys instead of
  trusting pushed data.
