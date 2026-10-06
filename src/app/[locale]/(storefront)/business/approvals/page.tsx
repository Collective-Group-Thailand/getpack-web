import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getApprovals } from "@/features/customer/business/api.server";
import { ApprovalsList } from "@/features/customer/business/ApprovalsList";
import { requireMember } from "@/features/customer/business/guard.server";
import { Link } from "@/i18n/navigation";
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("pageTitle")}</h1>
          <p className="text-muted mt-1">{company.can.approveOrders ? t("introApprover") : t("introBuyer")}</p>
        </div>
        <nav aria-label={t("views")} className="bg-surface-subtle flex gap-1 rounded-xl p-1">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={tab.key === current ? "page" : undefined}
              className="text-muted aria-[current=page]:bg-surface aria-[current=page]:text-fg rounded-lg px-3 py-1.5 text-sm font-medium aria-[current=page]:shadow-sm"
            >
              {tab.key === "pending" && current === "pending" && approvals?.length
                ? `${tab.label} · ${approvals.length}`
                : tab.label}
            </Link>
          ))}
        </nav>
      </header>
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
