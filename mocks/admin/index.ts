/**
 * The back-office mocks, composed. Contract requests (`mockRequest`) and stateful mocks of the
 * published surface; see each module for what it stands in for.
 */

import { commerceHandlers } from "./commerce";
import { consoleHandlers } from "./console";
import { platformHandlers } from "./platform";
import { salesHandlers } from "./sales";

export const adminHandlers = [...consoleHandlers, ...commerceHandlers, ...salesHandlers, ...platformHandlers];
