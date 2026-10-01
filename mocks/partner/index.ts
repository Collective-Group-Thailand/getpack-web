/**
 * The partner-factory surface (`/v1/partner/*`): the published B2.2 endpoints over the back
 * office's own factory rows, and the partner zone's contract requests — the production floor over
 * the commerce mock's orders and jobs, shipping over the logistics mock's shipments. See
 * `./support.ts` for the rules every handler applies (own factory only, roles from rbac.md).
 */

import { stores } from "../admin/partners";
import { accountHandlers } from "./account";
import { billingHandlers } from "./billing";
import { factoryHandlers } from "./factories";
import { registerFactoryNames } from "./factory-names";
import { jobRequestHandlers } from "./jobs";
import { onboardingHandlers } from "./onboarding";
import { shipmentRequestHandlers } from "./shipments";

registerFactoryNames((factoryId) => {
  const factory = stores.get(factoryId)?.factory;
  return factory ? { code: factory.code, name: factory.tradeName ?? factory.legalName } : undefined;
});

export const partnerZoneHandlers = [
  ...onboardingHandlers,
  ...jobRequestHandlers,
  ...shipmentRequestHandlers,
  ...billingHandlers,
  ...accountHandlers,
  ...factoryHandlers,
];
