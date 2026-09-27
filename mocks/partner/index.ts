/**
 * The partner-factory surface (`/v1/partner/*`): the published B2.2 endpoints over the back
 * office's own factory rows, and the partner zone's contract requests — the production floor over
 * the commerce mock's orders and jobs, shipping over the logistics mock's shipments. See
 * `./support.ts` for the rules every handler applies (own factory only, roles from rbac.md).
 */

import { billingRequestHandlers } from "./billing";
import { factoryHandlers } from "./factories";
import { jobRequestHandlers } from "./jobs";
import { onboardingRequestHandlers } from "./onboarding";
import { shipmentRequestHandlers } from "./shipments";

export const partnerZoneHandlers = [
  ...onboardingRequestHandlers,
  ...jobRequestHandlers,
  ...shipmentRequestHandlers,
  ...billingRequestHandlers,
  ...factoryHandlers,
];
