import { ComingSoon, comingSoonMetadata } from "@/features/customer/shell/ComingSoon";

/** The LINE LIFF surface (D-151, F3 3.7). */
export const generateMetadata = () => comingSoonMetadata("pages.liff");

export default function Page() {
  return <ComingSoon titleKey="pages.liff" />;
}
