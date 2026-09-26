import { ComingSoon, comingSoonMetadata } from "@/features/customer/shell/ComingSoon";

/** A referral landing page (F3 3.4). */
export const generateMetadata = () => comingSoonMetadata("pages.referral");

export default function Page() {
  return <ComingSoon titleKey="pages.referral" />;
}
