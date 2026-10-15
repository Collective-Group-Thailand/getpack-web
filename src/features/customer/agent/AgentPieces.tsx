import { getTranslations } from "next-intl/server";

import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import type { Schemas } from "@/lib/api/types";
import { LinkPagination } from "@/ui/components/LinkPagination";

import { AgentNav } from "./AgentActions";

type Terms = Schemas["AgentPlanTermsDto"];

/** The agent pages' title and tabs (D-416). */
export async function AgentFrame({
  title,
  intro,
  actions,
  children,
}: {
  title: string;
  intro?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title leading-tight">{title}</h1>
          {intro ? <p className="text-muted mt-1">{intro}</p> : null}
        </div>
        {actions}
      </div>
      <AgentNav />
      {children}
    </div>
  );
}

/** A plan's terms in plain words (D-418, D-419), from the API's figures. */
export async function PlanTerms({ terms }: { terms: Terms }) {
  const [t, format] = await Promise.all([getTranslations("agent.terms"), getFormat()]);
  return (
    <ul className="text-muted flex list-disc flex-col gap-1 ps-5 text-sm">
      <li>{t("first", { pct: terms.firstOrderPct })}</li>
      <li>{t("repeat", { pct: terms.repeatOrderPct, months: terms.attributionMonths })}</li>
      <li>{t("cap", { pct: terms.marginCapPct })}</li>
      {Number(terms.minBaseAmount) > 0 ? <li>{t("minBase", { amount: format.thb(terms.minBaseAmount) })}</li> : null}
      {Number(terms.factoryBountyAmount) > 0 ? (
        <li>
          {t("bounty", {
            amount: format.thb(terms.factoryBountyAmount),
            jobs: terms.factoryQualifyJobs,
            days: terms.factoryQualifyDays,
          })}
        </li>
      ) : null}
      <li>{t("when")}</li>
    </ul>
  );
}

/** Page links for the agent lists (`?page=`). */
export async function AgentPager({
  page,
  total,
  perPage,
  path,
}: {
  page: number;
  total: number;
  perPage: number;
  path: string;
}) {
  const t = await getTranslations("agent.pagination");
  const pages = Math.max(1, Math.ceil(total / perPage));
  return (
    <LinkPagination
      page={page}
      pages={pages}
      hrefFor={(target) => (target === 1 ? path : `${path}?page=${target}`)}
      linkAs={Link}
      labels={{
        nav: t("nav"),
        previous: t("previous"),
        next: t("next"),
        page: (n) => t("page", { page: n }),
      }}
    />
  );
}

export const pageOf = (raw: string | undefined) => Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);
