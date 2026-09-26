/**
 * The storefront surface (`/v1/store/*`): the public catalogue, the configurator and quotes,
 * RFQs, the cart, and the signed-in customer's own endpoints, published and requested.
 */

import { storeAccountHandlers } from "./account";
import { storeBookHandlers } from "./book";
import { storeCartHandlers } from "./cart";
import { storeCheckoutHandlers } from "./checkout";
import { storeCatalogHandlers } from "./catalog";
import { storeQuoteHandlers } from "./quotes";
import { storeRfqHandlers } from "./rfq";

export const storeHandlers = [
  ...storeAccountHandlers,
  ...storeQuoteHandlers,
  ...storeRfqHandlers,
  ...storeCartHandlers,
  ...storeBookHandlers,
  ...storeCheckoutHandlers,
  ...storeCatalogHandlers,
];
