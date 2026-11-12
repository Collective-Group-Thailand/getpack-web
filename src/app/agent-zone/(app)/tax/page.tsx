import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { AgentPage } from "@/features/agent/AgentPage";
import { getMyTaxDeclaration } from "@/features/agent/api.server";
import { requireActiveAgent } from "@/features/agent/context.server";
import { TaxDeclarationForm } from "@/features/agent/tax/TaxDeclarationForm";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { AGENT_TAX_DECLARATION_STATUS } from "@/domain/status";
import { Callout } from "@/ui/components/Callout";
import { DescriptionList } from "@/ui/components/DescriptionList";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agent.tax");
  return { title: t("title") };
}

/**
 * ล.ย.01 (D-465): the allowances an individual agent declares for the current tax year. Finance checks it; only
 * an accepted one changes the progressive withholding — otherwise the personal allowance applies. Temporary
 * home under the account until the agent zone takes the agent pages (Phase 2).
 */
export default async function Page() {
  await requireActiveAgent();
  const [t, format, mine] = await Promise.all([getTranslations("agent.tax"), getFormat(), getMyTaxDeclaration()]);
  const declaration = mine.declaration;
  // Thai readers count tax years in the Buddhist era.
  const year = (await getLocale()) === "th" ? String(mine.taxYear + 543) : String(mine.taxYear);
  return (
    <AgentPage
      title={t("title")}
      intro={t("intro")}
      status={
        declaration ? <StatusChip map={AGENT_TAX_DECLARATION_STATUS} value={declaration.status} size="md" /> : null
      }
    >
      {!mine.applicable ? (
        <Callout tone="info" title={t("notApplicable")} />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex flex-col gap-4">
            <p className="text-muted text-sm">{t("helper", { amount: format.thb(mine.personalAllowance) })}</p>
            {declaration?.status === "rejected" && declaration.decisionReason ? (
              <Callout tone="danger" title={t("status.rejected")}>
                {t("rejectedReason", { reason: declaration.decisionReason })}
              </Callout>
            ) : null}
            <TaxDeclarationForm
              initial={(declaration?.allowances ?? {}) as Record<string, string>}
              locked={declaration?.status === "submitted"}
            />
          </div>
          <aside className="border-border bg-surface rounded-card border p-4">
            <DescriptionList
              items={[
                { term: t("year"), description: year },
                {
                  term: t("total"),
                  description: declaration ? format.thb(declaration.allowancesTotal) : "—",
                },
                {
                  term: t("sentOn"),
                  description: declaration ? format.date(declaration.submittedAt) : t("status.none"),
                },
              ]}
            />
          </aside>
        </div>
      )}
    </AgentPage>
  );
}
