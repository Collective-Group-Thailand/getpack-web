import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { MySignaturePage } from "@/features/admin/document-branding/BrandingPages";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("docBranding.mine"))("title") };
}

/** My signature on getpack's documents (D-429): only I set it. */
export default function Page() {
  return (
    <ConsolePage>
      <MySignaturePage />
    </ConsolePage>
  );
}
