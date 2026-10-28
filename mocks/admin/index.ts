/**
 * The back-office mocks, composed. Contract requests (`mockRequest`) and stateful mocks of the
 * published surface; see each module for what it stands in for.
 */

import { analyticsContractHandlers } from "./analytics";
import { artworkContractHandlers } from "./artwork";
import { catalogueHandlers } from "./catalogue";
import { companyHandlers } from "./companies";
import { consoleHandlers } from "./console";
import { customerHandlers } from "./customers";
import { fileAccessLogHandlers } from "./file-access-logs";
import { financeHandlers } from "./finance";
import { governanceHandlers } from "./governance";
import { logisticsHandlers } from "./logistics";
import { loyaltyHandlers } from "./loyalty";
import { marketingContractHandlers, marketingHandlers } from "./marketing";
import { orderHandlers } from "./orders";
import { partnerHandlers } from "./partners";
import { platformHandlers } from "./platform";
import { designContractHandlers, prepressHandlers } from "./prepress";
import { productionHandlers } from "./production";
import { rfqHandlers } from "./rfq";
import { salesHandlers } from "./sales";
import { shipmentHandlers } from "./shipments";
import { styleLibraryContentHandlers } from "./style-library-content";
import { adminConversationHandlers } from "../store/conversations";

export const adminHandlers = [
  ...styleLibraryContentHandlers,
  ...adminConversationHandlers,
  ...consoleHandlers,
  ...fileAccessLogHandlers,
  ...productionHandlers,
  ...orderHandlers,
  ...customerHandlers,
  ...salesHandlers,
  ...rfqHandlers,
  ...artworkContractHandlers,
  ...designContractHandlers,
  ...prepressHandlers,
  ...catalogueHandlers,
  ...governanceHandlers,
  ...partnerHandlers,
  ...marketingContractHandlers,
  ...marketingHandlers,
  ...companyHandlers,
  ...financeHandlers,
  ...loyaltyHandlers,
  ...shipmentHandlers,
  ...logisticsHandlers,
  ...analyticsContractHandlers,
  ...platformHandlers,
];
