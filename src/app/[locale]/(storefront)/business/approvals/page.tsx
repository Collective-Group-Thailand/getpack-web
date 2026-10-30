import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getApprovals } from "@/features/customer/business/api.server";
import { ApprovalsList } from "@/features/customer/business/ApprovalsList";
import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { TabBar } from "@/features/customer/account/AccountTabs";
import { requireMember } from "@/features/customer/business/guard.server";
import { Callout } from "@/ui/components/Callout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("business.approvals");
  return { title: t("pageTitle"), robots: { index: false, follow: false } };
}

/**
 * What waits for the company's approver, and what was decided (F3 3.7, D-123; round 2 B2): tabs
 * รออนุมัติ · ตัดสินแล้ว · ทั้งหมด, and `?request=` from the approver's notification opens on it.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; sent?: string; request?: string }>;
}) {
  const company = await requireMember();
  const { view, sent, request } = await searchParams;
  const current = view === "decided" || view === "all" ? view : "pending";
  const [t, approvals] = await Promise.all([getTranslations("business.approvals"), getApprovals(company.id, current)]);
  const tabs = [
    { key: "pending", href: "/business/approvals", label: t("pending") },
    { key: "decided", href: "/business/approvals?view=decided", label: t("decided") },
    { key: "all", href: "/business/approvals?view=all", label: t("all") },
  ] as const;
  return (
    <div className="flex flex-col gap-6">
      <AccountHeader title={t("pageTitle")} lede={company.can.approveOrders ? t("introApprover") : t("introBuyer")} />
      <TabBar
        label={t("views")}
        items={tabs.map((tab) => ({
          key: tab.key,
          href: tab.href,
          label: tab.label,
          current: tab.key === current,
          count: tab.key === "pending" && current === "pending" && approvals?.length ? approvals.length : null,
        }))}
      />
      {sent ? (
        <Callout tone="success" role="status" title={t("sentTitle", { request: sent })}>
          {t("sent")}
        </Callout>
      ) : null}
      <ApprovalsList
        companyId={company.id}
        approvals={approvals ?? []}
        canApprove={company.can.approveOrders}
        focus={request ?? null}
      />
    </div>
  );
}
