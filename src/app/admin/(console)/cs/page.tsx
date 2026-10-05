import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { CalculatorPicker } from "@/features/admin/cs";
import Link from "next/link";

import { Button } from "@/ui/components/Button";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("cs.picker"))("title") };
}

export default async function CalculatorsPage() {
  const t = await getTranslations("cs.picker");
  return (
    <ConsolePage>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          // The inbox has no menu entry yet (CONTRACT-REQUEST admin.menu-inbox), so CS reach it from here.
          <Button asChild variant="secondary" iconStart="inbox">
            <Link href="/inbox">{(await getTranslations("cs.inbox"))("title")}</Link>
          </Button>
        }
      />
      <CalculatorPicker />
    </ConsolePage>
  );
}
