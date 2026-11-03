import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AgentPage } from "@/features/agent/AgentPage";
import { getPipeline, type LeadSort, type LeadStage, type LeadView } from "@/features/agent/api.server";
import { requireActiveAgent } from "@/features/agent/context.server";
import { PendingDrafts } from "@/features/agent/drafts/PendingDrafts";
import { ExportLeads } from "@/features/agent/pipeline/ExportLeads";
import { LeadBoard } from "@/features/agent/pipeline/LeadBoard";
import { LeadCard } from "@/features/agent/pipeline/LeadCard";
import { LeadFilters } from "@/features/agent/pipeline/LeadFilters";
import { LeadTable } from "@/features/agent/pipeline/LeadTable";
import { NewLead } from "@/features/agent/pipeline/NewLead";
import { PipelineEmpty } from "@/features/agent/pipeline/PipelineEmpty";
import { zoneOrigin } from "@/lib/zones/origin.server";
import { Button } from "@/ui/components/Button";
import { ViewTabs } from "@/ui/components/ViewTabs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agentZone.titles");
  return { title: t("leads") };
}

type Search = {
  view?: string;
  stage?: string;
  q?: string;
  sort?: string;
  order?: string;
  cursor?: string;
  layout?: string;
};

/** The list's four views (D-468 §1): ทั้งหมด = the open pipeline; closed ones have their own view. */
const VIEWS = [
  { key: "all", view: "open" },
  { key: "today", view: "follow_up_today" },
  { key: "ending", view: "protection_ending" },
  { key: "closed", view: "closed" },
] as const satisfies readonly { key: string; view: LeadView }[];
const STAGES = new Set<LeadStage>(["new", "contacted", "quoted", "negotiating", "won", "lost"]);
const SORTS = new Set<LeadSort>(["createdAt", "updatedAt", "nextFollowUpAt", "protectedUntil", "expectedValue"]);

/**
 * ลูกค้ามุ่งหวัง (D-468, PROMPT P3 Web 1): the pipeline in four views. A phone shows cards (filters in a bottom
 * sheet), a tablet two columns of cards, a desktop a sortable table — or a board by stage — with export and import.
 * Every card and row carries "ย้ายไปขั้น…"; leads kept on the device while offline sit above the list as "รอส่ง".
 */
export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const { agent, programme } = await requireActiveAgent();
  const search = await searchParams;
  const tab = VIEWS.find((candidate) => candidate.key === search.view) ?? VIEWS[0];
  const stage = STAGES.has(search.stage as LeadStage) ? (search.stage as LeadStage) : undefined;
  const sort = SORTS.has(search.sort as LeadSort) ? (search.sort as LeadSort) : "updatedAt";
  const order = search.order === "asc" ? "asc" : "desc";
  const q = search.q?.trim().slice(0, 100) || undefined;
  const board = search.layout === "board" && tab.view !== "closed";
  const [t, tz, list, storefront] = await Promise.all([
    getTranslations("agentSales.list"),
    getTranslations("agentZone.titles"),
    getPipeline({
      view: tab.view,
      stage,
      q,
      sort,
      order,
      cursor: board ? undefined : search.cursor,
      limit: board ? 100 : 50,
    }),
    zoneOrigin("customer"),
  ]);
  const active = agent.status === "active";
  const partnerPageUrl = `${storefront}/partner-with-us`;

  const hrefWith = (changes: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { view: tab.key === "all" ? undefined : tab.key, stage, q, sort: sort === "updatedAt" ? undefined : sort, order: order === "desc" ? undefined : order, layout: board ? "board" : undefined, ...changes };
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
    const query = params.toString();
    return query ? `/leads?${query}` : "/leads";
  };
  const sortHref = (key: LeadSort) =>
    hrefWith({
      sort: key === "updatedAt" && sort !== key ? undefined : key,
      order: sort === key ? (order === "asc" ? "desc" : "asc") : key === "expectedValue" || key === "updatedAt" ? undefined : "asc",
      cursor: undefined,
    });
  const filtered = Boolean(stage || q);

  return (
    <AgentPage
      title={tz("leads")}
      intro={t("intro", { days: programme.leadProtectionDays })}
      actions={
        <>
          <ExportLeads />
          <Button asChild variant="secondary" iconStart="upload" className="max-sm:hidden">
            <Link href="/leads/import">{t("import")}</Link>
          </Button>
          {active ? <NewLead protectionDays={programme.leadProtectionDays} partnerPageUrl={partnerPageUrl} /> : null}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ViewTabs
          label={t("views")}
          current={tab.key}
          items={VIEWS.map((view) => ({
            key: view.key,
            href: view.key === "all" ? "/leads" : `/leads?view=${view.key}`,
            label: t(`viewLabels.${view.key}`),
          }))}
        />
        <LeadFilters boardAvailable={tab.view !== "closed"} />
      </div>

      <PendingDrafts />

      {list.data.length === 0 ? (
        <PipelineEmpty
          view={tab.key}
          filtered={filtered}
          clearHref={hrefWith({ stage: undefined, q: undefined })}
          action={
            active && tab.key === "all" && !filtered ? (
              <NewLead protectionDays={programme.leadProtectionDays} partnerPageUrl={partnerPageUrl} fab={false} />
            ) : null
          }
        />
      ) : board ? (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {list.data.map((lead) => (
              <li key={lead.id}>
                <LeadCard lead={lead} />
              </li>
            ))}
          </ul>
          <div className="hidden lg:block">
            <LeadBoard leads={list.data} />
          </div>
        </>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:hidden" aria-label={t("listLabel")}>
            {list.data.map((lead) => (
              <li key={lead.id}>
                <LeadCard lead={lead} />
              </li>
            ))}
          </ul>
          <div className="hidden lg:block">
            <LeadTable
              leads={list.data}
              caption={t("tableCaption", { view: t(`viewLabels.${tab.key}`) })}
              sort={sort}
              order={order}
              sortHrefs={{
                nextFollowUpAt: sortHref("nextFollowUpAt"),
                protectedUntil: sortHref("protectedUntil"),
                expectedValue: sortHref("expectedValue"),
                updatedAt: sortHref("updatedAt"),
              }}
            />
          </div>
        </>
      )}

      {list.nextCursor && !board ? (
        <div className="flex justify-center">
          <Button asChild variant="secondary" iconStart="chevron-down">
            <Link href={hrefWith({ cursor: list.nextCursor })}>{t("more")}</Link>
          </Button>
        </div>
      ) : null}
      <Button asChild variant="link" className="self-start sm:hidden">
        <Link href="/leads/import">{t("importPhone")}</Link>
      </Button>
    </AgentPage>
  );
}
