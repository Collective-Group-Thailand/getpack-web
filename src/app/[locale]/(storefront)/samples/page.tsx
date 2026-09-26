import { ComingSoon, comingSoonMetadata } from "@/features/customer/shell/ComingSoon";

/** The sample kit request (F3 3.7). */
export const generateMetadata = () => comingSoonMetadata("pages.samples");

export default function Page() {
  return <ComingSoon titleKey="pages.samples" />;
}
