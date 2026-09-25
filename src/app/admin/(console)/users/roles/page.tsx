import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { adminServerApis } from "@/features/admin/console/api.server";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { RolesMatrix } from "@/features/admin/iam";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("iam.roles"))("title") };
}

/** The D-140 role catalogue and D-141 cost/margin visibility, as the API defines them. */
export default async function RolesPage() {
  const t = await getTranslations("iam.roles");
  const tUsers = await getTranslations("iam.users");
  let initial = null;
  try {
    initial = (await (await adminServerApis()).contract.GET("/v1/admin/roles")).data ?? null;
  } catch {
    // Rendered by the client as the API answered it.
  }
  return (
    <ConsolePage>
      <PageHeader
        breadcrumbs={<Breadcrumbs label={t("breadcrumb")} items={[{ label: tUsers("title"), href: "/users" }, { label: t("title") }]} />}
        title={t("title")}
        description={t("description")}
      />
      <RolesMatrix initial={initial} />
    </ConsolePage>
  );
}
