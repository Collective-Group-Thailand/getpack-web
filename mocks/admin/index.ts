/**
 * The back-office mocks, composed. Contract requests (`mockRequest`) and stateful mocks of the
 * published surface; see each module for what it stands in for.
 */

import { analyticsHandlers } from "./analytics";
import { catalogueHandlers } from "./catalogue";
import { commerceHandlers } from "./commerce";
import { companyHandlers } from "./companies";
import { consoleHandlers } from "./console";
import { governanceHandlers } from "./governance";
import { logisticsHandlers } from "./logistics";
import { loyaltyHandlers } from "./loyalty";
import { marketingHandlers } from "./marketing";
import { partnerHandlers } from "./partners";
import { platformHandlers } from "./platform";
import { prepressHandlers } from "./prepress";
import { rfqHandlers } from "./rfq";
import { salesHandlers } from "./sales";

export const adminHandlers = [
  ...consoleHandlers,
  ...commerceHandlers,
  ...salesHandlers,
  ...rfqHandlers,
  ...prepressHandlers,
  ...catalogueHandlers,
  ...governanceHandlers,
  ...partnerHandlers,
  ...marketingHandlers,
  ...companyHandlers,
  ...loyaltyHandlers,
  ...logisticsHandlers,
  ...analyticsHandlers,
  ...platformHandlers,
];
