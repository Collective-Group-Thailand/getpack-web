import { ComingSoon, comingSoonMetadata } from "@/features/customer/shell/ComingSoon";

/** The public tracking page, no personal data (F3 3.6). */
export const generateMetadata = () => comingSoonMetadata("pages.track");

export default function Page() {
  return <ComingSoon titleKey="pages.track" />;
}
