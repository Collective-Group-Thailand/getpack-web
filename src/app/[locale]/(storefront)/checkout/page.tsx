import { ComingSoon, comingSoonMetadata } from "@/features/customer/shell/ComingSoon";

/** Checkout (F3 3.3). */
export const generateMetadata = () => comingSoonMetadata("pages.checkout");

export default function Page() {
  return <ComingSoon titleKey="pages.checkout" />;
}
