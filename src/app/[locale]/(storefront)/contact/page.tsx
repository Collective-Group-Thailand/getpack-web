import { ComingSoon, comingSoonMetadata } from "@/features/customer/shell/ComingSoon";

/** Contact (F3 3.7). */
export const generateMetadata = () => comingSoonMetadata("pages.contact");

export default function Page() {
  return <ComingSoon titleKey="pages.contact" />;
}
