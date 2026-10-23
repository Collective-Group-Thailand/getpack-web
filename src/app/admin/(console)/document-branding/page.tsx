import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { DocumentBrandingPage } from "@/features/admin/document-branding/BrandingPages";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("docBranding"))("title") };
}

/** Logo, company seal and signatories of getpack's documents (D-428, D-429). */
export default function Page() {
  return (
    <ConsolePage>
      <DocumentBrandingPage />
    </ConsolePage>
  );
}
