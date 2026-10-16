import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ApprovalsWorkspace, type ApprovalsTab } from "@/features/admin/approvals";
import { approvalsList } from "@/features/admin/approvals/resources";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { adminServerApis } from "@/features/admin/console/api.server";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { requireActor } from "@/features/shared/auth/guard";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("approvals"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** The approval inbox (F2 §2): every approval type from the approvals engine, in one place. */
export default async function ApprovalsPage({ searchParams }: Props) {
  const params = await searchParams;
  const t = await getTranslations("approvals");
  const actor = await requireActor("admin");
  const canAct = actor?.permissions.includes("approvals.act") ?? false;
  const requested = typeof params.tab === "string" ? params.tab : undefined;
  const tab: ApprovalsTab =
    requested === "all" || requested === "delegations" || requested === "matrix" ? requested : canAct ? "inbox" : "all";

  const [initialInbox, initialAll] = await Promise.all([
    tab === "inbox" ? fetchInbox() : null,
    tab === "all" ? prefetchList(approvalsList, params) : null,
  ]);

  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      <ApprovalsWorkspace tab={tab} initialInbox={initialInbox} initialAll={initialAll} />
    </ConsolePage>
  );
}

async function fetchInbox() {
  try {
    return (await (await adminServerApis()).contract.GET("/v1/admin/approvals/inbox")).data ?? null;
  } catch {
    return null;
  }
}
