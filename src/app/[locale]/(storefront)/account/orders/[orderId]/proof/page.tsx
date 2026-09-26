import { requireCustomer } from "@/features/customer/auth/guard.server";
import { ComingSoon, comingSoonMetadata } from "@/features/customer/shell/ComingSoon";

/** Linked from the order's next actions (F3 3.4); the screen itself arrives with 3.5 / 3.6. */
export const generateMetadata = () => comingSoonMetadata("pages.order_proof");

export default async function Page() {
  await requireCustomer();
  return <ComingSoon titleKey="pages.order_proof" />;
}
