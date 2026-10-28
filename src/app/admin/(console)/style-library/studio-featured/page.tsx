import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { StudioFeaturedEditor, StyleLibraryNav } from "@/features/admin/style-library";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("styleLibrary.studioFeatured"))("title") };
}

/** C7 (DECISIONS-STAGE-A §2, D-455): the Studio's "แบบที่คนเริ่มบ่อย", picked by admins. */
export default async function Page() {
  const t = await getTranslations("styleLibrary.studioFeatured");
  return (
    <ConsolePage width="full" className="max-w-[72rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <StyleLibraryNav />
      <StudioFeaturedEditor />
    </ConsolePage>
  );
}
