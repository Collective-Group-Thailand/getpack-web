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
import { storeDesignHandlers } from "./designs";
import { storeFulfilmentHandlers } from "./fulfilment";
import { storeOrderHandlers } from "./orders";
import { storeCatalogHandlers } from "./catalog";
import { quoteToolHandlers } from "./quote-tools";
import { storeQuoteHandlers } from "./quotes";
import { specsHandlers } from "./specs";
import { storeSupportHandlers } from "./support";
import { storeRfqHandlers } from "./rfq";
import { storeStyleHandlers } from "./styles";
import { storeCollabHandlers } from "./collab";
import { sampleHandlers } from "./samples";
import { storeStudioHandlers } from "./studio";

export const storeHandlers = [
  // Samples first: they also serve the evidence photos (`files/:fileId/download`) of every zone.
  ...sampleHandlers,
  ...storeAccountHandlers,
  ...quoteToolHandlers,
  ...specsHandlers,
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
  ...storeDesignHandlers,
  ...storeStudioHandlers,
  ...storeCollabHandlers,
  ...storeCatalogHandlers,
  ...storeStyleHandlers,
];
