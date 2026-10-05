import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AnalyticsDashboard } from "@/features/admin/analytics";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { Button } from "@/ui/components/Button";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("analytics"))("title") };
}

export default async function AnalyticsPage() {
  const t = await getTranslations("analytics");
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          // No menu entry for the assistant yet (CONTRACT-REQUEST admin.menu-assistant).
          <Button asChild variant="secondary" iconStart="sparkles">
            <Link href="/assistant">{t("assistant.title")}</Link>
          </Button>
        }
      />
      <AnalyticsDashboard />
    </ConsolePage>
  );
}
