"use client";

import { useTranslations } from "next-intl";

import { SectionNav } from "../console";
import { useActor } from "../console/actor";

/**
 * The company sales desk's pages (D-469, D-470). Each page is offered only to who may open it: the pipeline pages to
 * either pipeline permission (a rep's own, a manager's all), the dashboard to managers, the approval desk, playbook,
 * reports and the access log to their own permissions.
 */
export function SalesNav() {
  const t = useTranslations("sales.nav");
  const { permissions } = useActor();
  const has = (...any: string[]) => any.some((permission) => permissions.includes(permission));
  const pipeline = has("sales.pipeline.self", "sales.pipeline.manage");
  const items = [
    pipeline && { href: "/sales", label: t("inbox"), exact: true },
    pipeline && { href: "/sales/pipeline", label: t("pipeline") },
    pipeline && { href: "/sales/quotes", label: t("quotes") },
    has("sales.pipeline.manage") && { href: "/sales/dashboard", label: t("dashboard") },
    has("discount_approvals.read") && { href: "/sales/approvals", label: t("approvals"), exact: true },
    has("sales_playbook.manage") && { href: "/sales/playbook", label: t("playbook") },
    has("sales_reports.read") && { href: "/sales/reports/negotiations", label: t("negotiations") },
    has("sales_reports.read") && { href: "/sales/reports/lost-to-price", label: t("lostToPrice") },
    has("sales_reports.read") && { href: "/sales/reports/post-deal", label: t("postDeal") },
    has("sales_waterfall_views.read") && { href: "/sales/approvals/views", label: t("views") },
  ].filter((item): item is { href: string; label: string; exact?: boolean } => Boolean(item));
  return <SectionNav label={t("label")} items={items} />;
}
