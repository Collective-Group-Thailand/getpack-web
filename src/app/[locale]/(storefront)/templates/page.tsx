import { ComingSoon, comingSoonMetadata } from "@/features/customer/shell/ComingSoon";

/** Dieline templates to download (F3 3.2 / F4). */
export const generateMetadata = () => comingSoonMetadata("pages.templates");

export default function Page() {
  return <ComingSoon titleKey="pages.templates" />;
}
