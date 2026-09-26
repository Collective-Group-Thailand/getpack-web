import { ComingSoon, comingSoonMetadata } from "@/features/customer/shell/ComingSoon";

/** One order: timeline, instalments, documents (F3 3.4). The global search links here. */
export const generateMetadata = () => comingSoonMetadata("pages.order");

export default function Page() {
  return <ComingSoon titleKey="pages.order" />;
}
