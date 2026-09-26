import { requireCustomer } from "@/features/customer/auth/guard.server";
import { ComingSoon } from "@/features/customer/shell/ComingSoon";

export default async function Page() {
  await requireCustomer();
  return <ComingSoon titleKey="nav.orders" />;
}
