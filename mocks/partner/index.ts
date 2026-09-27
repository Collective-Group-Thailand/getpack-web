/**
 * The partner-factory surface (`/v1/partner/*`): the published B2.2 endpoints over the back
 * office's own factory rows, and the partner zone's contract requests. See `./support.ts` for
 * the rules every handler applies (own factory only, roles from rbac.md).
 */

import { factoryHandlers } from "./factories";
import { onboardingRequestHandlers } from "./onboarding";

export const partnerZoneHandlers = [...onboardingRequestHandlers, ...factoryHandlers];
