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
export * from "./admin-console";
export * from "./admin-analytics";
export * from "./admin-companies";
export * from "./admin-customers";
export * from "./admin-finance";
export * from "./admin-logistics";
export * from "./admin-marketing";
export * from "./admin-orders";
export * from "./admin-partners";
export * from "./admin-prepress";
export * from "./admin-rfq";
export * from "./admin-sales";
export * from "./partner-account";
export * from "./partner-billing";
export * from "./partner-jobs";
export * from "./partner-onboarding";
export * from "./partner-shipments";
export * from "./store-artwork";
export * from "./store-cart";
export * from "./store-catalog";
export * from "./store-checkout";
export * from "./store-orders";
export * from "./store-quotes";
export * from "./store-rfq";
