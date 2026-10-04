/**
 * Contract requests — endpoints the frontend needs that `packio-api` has not shipped yet.
 * See `./define.ts` for what this layer is and how an entry retires itself.
 *
 * `browserRequests` and `serverRequests` are imported by path, for the same reason
 * `browserApi` and `serverApi` are (`@/lib/api/index.ts`).
 */

export * from "./define";
export {
  compactQuery,
  createRequestClient,
  fillPath,
  type CallInit,
  type RequestClient,
  type ResponseOf,
} from "./client";
export { REQUESTS, type RequestKey, type Requests } from "./registry";
export * from "./admin-logistics";
export * from "./admin-orders";
export * from "./store-quotes";
