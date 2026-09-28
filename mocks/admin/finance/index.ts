/**
 * The finance workspace's mocks (F6): the books every module posts to, and one module per desk.
 * Stateful over the published B5 surface; contract requests where it has a gap.
 */

import { ledgerHandlers } from "./ledger";
import { receivableHandlers } from "./receivables";

export const financeHandlers = [...receivableHandlers, ...ledgerHandlers];
