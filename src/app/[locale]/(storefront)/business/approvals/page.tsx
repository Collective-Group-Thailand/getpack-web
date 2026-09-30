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

/** What waits for the company's approver, and what was decided (F3 3.7, D-123). */
export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string; sent?: string }> }) {
  const company = await requireMember();
  const { view, sent } = await searchParams;
  const decided = view === "decided";
  // CONTRACT-GAP store.company-approvals: the published list has the pending ones only.
  const [t, approvals] = await Promise.all([
    getTranslations("business.approvals"),
    decided ? Promise.resolve([]) : getApprovals(company.id),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
        <p className="text-muted">{company.can.approveOrders ? t("introApprover") : t("introBuyer")}</p>
        <nav aria-label={t("views")} className="flex gap-2">
          <Link
            href="/business/approvals"
            aria-current={!decided ? "page" : undefined}
            className="aria-[current=page]:bg-primary-subtle rounded-lg px-3 py-1.5 text-sm"
          >
            {t("pending")}
          </Link>
          <Link
            href="/business/approvals?view=decided"
            aria-current={decided ? "page" : undefined}
            className="aria-[current=page]:bg-primary-subtle rounded-lg px-3 py-1.5 text-sm"
          >
            {t("decided")}
          </Link>
        </nav>
      </header>
      {sent ? (
        <Callout tone="success" role="status" title={t("sentTitle", { request: sent })}>
          {t("sent")}
        </Callout>
      ) : null}
      {decided ? <Callout tone="info">{t("decidedUnavailable")}</Callout> : null}
      <ApprovalsList companyId={company.id} approvals={approvals ?? []} canApprove={company.can.approveOrders} />
    </div>
  );
}
