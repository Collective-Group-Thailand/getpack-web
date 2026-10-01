import { test as setup } from "@playwright/test";

import {
  api,
  ApiCallError,
  DEV_FACTORY_CODE,
  DEV_INSTANT_PRODUCT,
  FACTORY_ROLES,
  partnerToken,
  staffToken,
  writeState,
  type Account,
  type FactoryRole,
} from "./support";

/**
 * Provisions what packio-api's dev seed lacks, through the API, before the integration specs:
 *
 * - a user per D-140 factory role at F9001: the owner is created by a Partner Manager
 *   (`admin.factories.createOwnerAccount`, D-171) and creates the others (`partner.factoryUsers.create`);
 * - and it checks the launch product is priced online, which `scripts/integration-prepare.ts`
 *   arranges when the stack starts.
 *
 * Idempotent on purpose. The accounts are deterministic, so a second run on the same database
 * finds them ("already exists") and goes on; `scripts/integration-stack.sh reset` gives a clean
 * one.
 */

const account = (role: FactoryRole): Account => ({
  email: `${role.replace("factory_", "")}@f9001.example.invalid`,
  // ≥ 12 characters (`CreateFactoryUserDto.initialPassword`), handed over out of band in real life.
  password: `it-${role}-password`,
  displayName: `[DEV] ${role.replace("factory_", "")} F9001`,
});

const exists = (error: unknown) => error instanceof ApiCallError && (error.status === 409 || error.status === 422);

setup("provision F9001's factory users", async () => {
  const partnerManager = await staffToken("partner_manager");
  const factories = await api<{ data: { id: string; code: string }[] }>(
    "GET",
    `/v1/admin/factories?q=${DEV_FACTORY_CODE}`,
    { token: partnerManager },
  );
  const factory = factories.data.find((row) => row.code === DEV_FACTORY_CODE);
  if (!factory)
    throw new Error(`The dev seed has no factory ${DEV_FACTORY_CODE}: run scripts/integration-stack.sh reset`);

  const accounts = Object.fromEntries(FACTORY_ROLES.map((role) => [role, account(role)])) as Record<
    FactoryRole,
    Account
  >;

  try {
    const owner = accounts.factory_owner;
    await api("POST", `/v1/admin/factories/${factory.id}/owner-account`, {
      token: partnerManager,
      idempotent: true,
      body: { email: owner.email, displayName: owner.displayName, initialPassword: owner.password },
    });
  } catch (error) {
    if (!exists(error)) throw error;
  }

  const owner = await partnerToken(accounts.factory_owner);
  const existing = await api<{ email: string }[] | { data: { email: string }[] }>(
    "GET",
    `/v1/partner/factories/${factory.id}/users`,
    { token: owner },
  );
  const emails = new Set((Array.isArray(existing) ? existing : existing.data).map((user) => user.email));
  for (const role of FACTORY_ROLES.filter((candidate) => candidate !== "factory_owner")) {
    const user = accounts[role];
    if (emails.has(user.email)) continue;
    await api("POST", `/v1/partner/factories/${factory.id}/users`, {
      token: owner,
      idempotent: true,
      body: { email: user.email, displayName: user.displayName, initialPassword: user.password, roles: [role] },
    });
  }

  writeState({ factoryId: factory.id, factory: accounts });
});

setup("the corrugated test product is priced online", async () => {
  // Prepared by scripts/integration-stack.sh (scripts/integration-prepare.ts) before any web server
  // reads the catalogue: the storefront caches it (5 minutes), so preparing it here would be too late.
  const configurator = await api<{ instant: boolean }>(
    "GET",
    `/v1/store/catalog/products/${DEV_INSTANT_PRODUCT}/configurator`,
  );
  if (!configurator.instant) {
    throw new Error(`${DEV_INSTANT_PRODUCT} is not priced online: run scripts/integration-stack.sh up (or reset)`);
  }
});
