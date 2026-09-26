import { requireCustomer } from "@/features/customer/auth/guard.server";
import { ComingSoon } from "@/features/customer/shell/ComingSoon";

/** The account home (F3 3.4). Signed-in customers only. */
export default async function Page() {
  await requireCustomer();
  return <ComingSoon titleKey="nav.account" />;
}
