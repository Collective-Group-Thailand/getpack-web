import { ComingSoon, comingSoonMetadata } from "@/features/customer/shell/ComingSoon";

/** The configurator and instant quote (F3 3.2). */
export const generateMetadata = () => comingSoonMetadata("pages.configure");

export default function Page() {
  return <ComingSoon titleKey="pages.configure" />;
}
