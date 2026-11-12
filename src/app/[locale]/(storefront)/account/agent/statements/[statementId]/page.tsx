import { routeOldAgentPage } from "@/features/customer/agent/api.server";
import { requireCustomer } from "@/features/customer/auth/guard.server";

/** Moved to getpack Agent (D-467): an agent gets a 308 to `/statements/{id}` there; anyone else goes to `/account/agent`. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ statementId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCustomer();
  const [{ statementId }, query] = await Promise.all([params, searchParams]);
  return routeOldAgentPage(["statements", statementId], query);
}
