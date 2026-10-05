# Real-backend end to end — `pnpm e2e:integration`

U1 §U-F0.5. The mock suite (`pnpm e2e`, the `chromium` project) checks every screen against the MSW mock API and its fixtures. This suite checks the **R1 launch path against a real packio-api**: the same production build, with no mock, on its own port.

## What runs where

| Project | Backend | Specs | Data |
|---|---|---|---|
| `chromium` (`pnpm e2e`) | in-process mock (`API_MOCKS=1`) | `e2e/*.spec.ts` | the mock's fixtures: personas, order codes, factory F001 |
| `journeys` (`pnpm e2e:journeys`) | mock | `e2e/journeys/` | as above |
| `integration` (`pnpm e2e:integration`) | packio-api at `INTEGRATION_API_URL` | `e2e/integration/*.spec.ts` | packio-api's dev seed, plus what each spec creates |

The backend is chosen by `E2E_BACKEND=real`, which the script sets. It is an environment variable, not a CLI flag, because Playwright re-evaluates the config in every worker. In that mode only the integration projects exist, so a spec written against the mock's fixtures can never run against the real API. A test that needs mock-only behaviour (the `?mock=` scenario switcher, time travel, fixture codes) belongs in the mock project, never in `e2e/integration/`.

## Running it locally

1. **packio-api's infrastructure.** In a packio-api checkout, run `docker compose up -d` (Postgres, Redis, LocalStack, Mailpit).
2. **The integration stack:**

   ```sh
   PACKIO_API_REPO=../packio-api scripts/integration-stack.sh up
   ```

   - It makes a packio-api worktree at the tag `contract.lock.json` pins (`../packio-api-it`) and installs it.
   - It writes that worktree's `.env` from packio-api's `.env.example`, with:
     - port 3400;
     - database `packio_it_web`, Redis db 5, bucket `packio-it-web`;
     - `INTEGRATIONS_MODE=fake`;
     - throttles raised, because the suite signs in from one address.
   - It migrates, runs the dev seed, and starts the API and its worker.
   - Nothing it starts shares data or queues with a developer's own API on port 3000.

   Other commands:
   - `reset`: drops and re-seeds the database, for a clean run;
   - `down`: stops the API and the worker;
   - `status`: shows the stack's state.

   Run it without piping its output: the API it leaves running keeps a pipe open.
3. **The suite:** `pnpm build`, then `pnpm e2e:integration`. Playwright serves the build on port 3500 with `API_INTERNAL_URL=http://localhost:3400` (or `INTEGRATION_API_URL`). It reuses a server already on that port.

## Accounts

| Who | How |
|---|---|
| Staff, one per D-140 role | The dev seed: `<role-with-dashes>@example.invalid` (`dpo@` for the Data Protection Officer), password `IT_SEED_PASSWORD` (default `packio-it-password`, the stack's `DEV_SEED_PASSWORD`). They sign in through the real login form |
| F9001's factory users, one per role | The setup project (`e2e/integration/global.setup.ts`): a Partner Manager creates the owner (`admin.factories.createOwnerAccount`), and the owner creates the others. Accounts are deterministic (`<role>@f9001.example.invalid`) and written to `e2e/integration/.state/accounts.json` (git-ignored). They sign in through the real login form |
| Customers | A new one per spec, from packio-api's fake Firebase verifier (`fake-firebase.google.<uid>.<email>`). The spec gets the token pair from the API and plants the customer zone's own session cookies. The Google SDK the sign-in button opens cannot be driven by a test; everything after the token is the real path |

The setup project also prices the folding test product online. The dev seed leaves every type RFQ-only and the product without a difficulty level, so an Admin:
- switches `folding_carton` to instant (`changeQuoteMode`, with a reason);
- gives `dev-tuck-end-box` the seed's difficulty level and a quantity range.

## Writing a spec here
- Create the data the spec needs; never assume what an earlier run left behind. `runId()` gives names unique to the run.
- Go through the app. Call packio-api directly only for setup that has no screen (`support.ts` → `api()`).
- Expect the dev seed's values: `DEV`-prefixed document numbers (D-210), the test area at postcode `99999`, factory F9001.
- A mismatch between the app and the API is fixed here, or raised in `docs/contract-requests.md` with the failing response attached.

## Defects found in packio-api by this suite

| Found | Operation | What happens | Workaround here | Status |
|---|---|---|---|---|
| 2026-10-05 (U4.5) | `store.studio.runChecks` (and `store.studio.order`, which runs it) | Two **concurrent** runs of the same version: both miss the stored run (`findUnique`), both `create`, the second breaks the unique index `ux_design_check_runs__version__rules__source__context` and answers **500**. A later run returns the stored one correctly. | The studio asks for a version's run once (versions are immutable; `staleTime: Infinity`); the step panel that fired two at once is rendered once now. | To report to packio-api: create-or-return (upsert, or catch P2002 and re-read). |
| 2026-10-05 (U4.6) | every `Idempotency-Key` endpoint (`store.studio.saveQuote`, `store.studio.order`) | A key that is not a uuid is refused (`Idempotency-Key ต้องเป็น uuid`). The studio first sent readable composite keys. | Fixed here: `stableIdempotencyKey(name)` — a name-based uuid (v5 layout), the same for a retry of the same design, version and option. | Not a defect: api-conventions §3; the mock now gets the same uuids. |
| 2026-10-05 (U4.6) | `store.files.presign` on the dev stack | The upload URL is a placeholder (`https://fake-s3.invalid/…`): no browser upload can complete, and the CSP refuses the origin anyway. The studio's renders therefore never reach packio-api here, so `store.studio.order` cannot be exercised end to end on this stack. | `e2e/integration/studio-order.spec.ts` checks the studio stops at the upload with its message and adds nothing to the cart, then that packio-api refuses an order for a version without renders (`studio.renders_missing` / `studio.print_unavailable`). The full order runs against the mock (`e2e/storefront-studio-order.spec.ts`). | Environment: needs a MinIO (or S3) in the integration stack and its origin in `NEXT_PUBLIC_ASSET_BASE_URL`. |
| 2026-10-05 (U4.8) | `store.studio.requestDesignService` | Refused with `422 cart.design_option_unavailable` when the version's quotation has no design fee: packio-api prices the design service from the studio quotation, and that has a fee only if the version's calculator spec asks for graphic design (`design.graphic`). | The studio marks the handed-over version `designService`, so its spec asks for graphic design, then saves and quotes it before the hand-off; the button only shows where the product offers hired design. `e2e/integration/handoff.spec.ts` is green. | Not a defect; worth a sentence in the operation's description. |
| 2026-10-05 (U2.F2) | `store.dielines.download`, `store.orders.getSpecSheet` | The dev seed publishes no styles (`store.styles.list` is empty) and has no order with approved artwork, so neither can be exercised on this stack. | `e2e/integration/downloads.spec.ts` skips with that reason; the flows are covered on the mock (`e2e/storefront-downloads.spec.ts`). | Seed: publish one style with size ranges and approve one order's artwork. |
