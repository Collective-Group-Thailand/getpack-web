/**
 * The back-office mocks, composed. Contract requests (`mockRequest`) and stateful mocks of the
 * published surface; see each module for what it stands in for.
 */

import { consoleHandlers } from "./console";
import { platformHandlers } from "./platform";

export const adminHandlers = [...consoleHandlers, ...platformHandlers];
