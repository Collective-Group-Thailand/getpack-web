/**
 * The storefront surface (`/v1/store/*`): the public catalogue, the configurator and quotes,
 * RFQs, the cart, and the signed-in customer's own endpoints, published and requested.
 */

import { storeAccountHandlers } from "./account";
import { storeArtworkHandlers } from "./artwork";
import { storeBookHandlers } from "./book";
import { storeBusinessHandlers } from "./business";
import { storeCartHandlers } from "./cart";
import { storeCheckoutHandlers } from "./checkout";
import { storeFulfilmentHandlers } from "./fulfilment";
import { storeOrderHandlers } from "./orders";
import { storeCatalogHandlers } from "./catalog";
import { storeQuoteHandlers } from "./quotes";
import { storeSupportHandlers } from "./support";
import { storeRfqHandlers } from "./rfq";

export const storeHandlers = [
  ...storeAccountHandlers,
  ...storeQuoteHandlers,
  ...storeRfqHandlers,
  ...storeCartHandlers,
  ...storeBookHandlers,
  ...storeCheckoutHandlers,
  ...storeOrderHandlers,
  ...storeArtworkHandlers,
  ...storeFulfilmentHandlers,
  ...storeSupportHandlers,
  ...storeBusinessHandlers,
  ...storeCatalogHandlers,
];
