import { ComingSoon, comingSoonMetadata } from "@/features/customer/shell/ComingSoon";

/** A request for quotation per category (F3 3.2). */
export const generateMetadata = () => comingSoonMetadata("pages.rfq");

export default function Page() {
  return <ComingSoon titleKey="pages.rfq" />;
}
