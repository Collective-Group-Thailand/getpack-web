/**
 * `server.ts` is deliberately absent from this barrel: it imports `server-only`, which
 * cannot be pulled into a client bundle. Server code imports it by path.
 *
 * The schemas are absent too (import `./schema` by path): this barrel is what browser code
 * imports, and a value export of the schema would bring all of zod with it.
 */
export { clientEnv } from "./client";
export type { ClientEnv, EnvMode, ServerEnv } from "./schema";
