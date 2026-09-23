import { setupServer } from "msw/node";

import { handlers } from "./handlers";

/** The mock API for `pnpm dev:mock` and the e2e suite. Started from `src/instrumentation.ts`. */
export const server = setupServer(...handlers);
