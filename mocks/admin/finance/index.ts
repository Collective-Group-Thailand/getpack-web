/**
 * The finance workspace's mocks (F6): the books every module posts to, and one module per desk.
 * Stateful over the published B5 surface; contract requests where it has a gap. The order of the
 * imports is the order the seeds run in: customer money, then suppliers, payouts and the bank.
 */

import { assetHandlers } from "./assets";
import { bankingHandlers } from "./banking";
import { closeHandlers } from "./close";
import { ledgerHandlers } from "./ledger";
import { payableHandlers } from "./payables";
import { payoutHandlers } from "./payouts";
import { receivableHandlers } from "./receivables";
import { taxHandlers } from "./tax";

export const financeHandlers = [
  ...receivableHandlers,
  ...ledgerHandlers,
  ...payableHandlers,
  ...payoutHandlers,
  ...bankingHandlers,
  ...taxHandlers,
  ...assetHandlers,
  ...closeHandlers,
];
