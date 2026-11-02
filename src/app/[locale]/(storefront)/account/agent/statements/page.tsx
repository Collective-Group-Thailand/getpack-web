import { routeOldAgentPage } from "@/features/customer/agent/api.server";
import { requireCustomer } from "@/features/customer/auth/guard.server";

/** Moved to getpack Agent (D-467): an agent gets a 308 to `/statements` there; anyone else goes to `/account/agent`. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCustomer();
  return routeOldAgentPage(["statements"], await searchParams);
}
