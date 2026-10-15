import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { CannedResponsesDesk } from "@/features/admin/content";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("content.pages.canned"))("title") };
}

/** D-412: the canned responses customer service inserts into replies (D-300). */
export default async function Page() {
  const t = await getTranslations("content.pages.canned");
  const tContent = await getTranslations("content");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs label={tContent("breadcrumb")} items={[{ label: t("inbox"), href: "/inbox" }, { label: t("title") }]} />
        }
        title={t("title")}
        description={t("description")}
      />
      <CannedResponsesDesk />
    </ConsolePage>
  );
}
