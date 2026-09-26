/**
 * The storefront surface (`/v1/store/*`): the public catalogue, the configurator and quotes,
 * RFQs, the cart, and the signed-in customer's own endpoints, published and requested.
 */

import { storeAccountHandlers } from "./account";
import { storeCartHandlers } from "./cart";
import { storeCatalogHandlers } from "./catalog";
import { storeQuoteHandlers } from "./quotes";
import { storeRfqHandlers } from "./rfq";

export const storeHandlers = [
  ...storeAccountHandlers,
  ...storeQuoteHandlers,
  ...storeRfqHandlers,
  ...storeCartHandlers,
  ...storeCatalogHandlers,
];
