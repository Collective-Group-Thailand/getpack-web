/**
 * The storefront surface (`/v1/store/*`): the public catalogue and the signed-in customer's
 * own endpoints, published and requested.
 */

import { storeAccountHandlers } from "./account";
import { storeCatalogHandlers } from "./catalog";

export const storeHandlers = [...storeAccountHandlers, ...storeCatalogHandlers];
