/**
 * Prepares the integration stack's dev seed for the launch path (`e2e/integration/prepare.ts`).
 * Run by `scripts/integration-stack.sh up | reset` once the API is healthy.
 */
import { prepareCatalogue } from "../e2e/integration/prepare";

prepareCatalogue()
  .then((done) =>
    process.stdout.write(`[integration-prepare] ${done.length ? done.join("; ") : "catalogue already prepared"}\n`),
  )
  .catch((error: unknown) => {
    process.stderr.write(`[integration-prepare] ${String(error)}\n`);
    process.exit(1);
  });
