import { ComingSoon, comingSoonMetadata } from "@/features/customer/shell/ComingSoon";

/** Packio for business: company sign-up, approvals, credit (F3 3.7). */
export const generateMetadata = () => comingSoonMetadata("pages.business");

export default function Page() {
  return <ComingSoon titleKey="pages.business" />;
}
