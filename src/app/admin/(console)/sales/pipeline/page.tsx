import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { adminServerApis } from "@/features/admin/console/api.server";
import { SalesBoard, SalesLeadTable } from "@/features/admin/sales/Pipeline";
import { SalesNav } from "@/features/admin/sales/SalesNav";
import { LeadCard } from "@/features/shared/sales/LeadCard";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { PageHeader } from "@/ui/components/PageHeader";
import { ViewTabs } from "@/ui/components/ViewTabs";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("sales.pipeline"))("title") };
}

type Search = {
  view?: string;
  stage?: string;
  q?: string;
  sort?: string;
  order?: string;
  layout?: string;
  kind?: string;
  rep?: string;
  score?: string;
};
type LeadView = Schemas["AgentLeadView"];
type LeadSort = Schemas["AgentLeadSort"];

const VIEWS = [
  { key: "all", view: "open" },
  { key: "today", view: "follow_up_today" },
  { key: "ending", view: "protection_ending" },
  { key: "closed", view: "closed" },
] as const satisfies readonly { key: string; view: LeadView }[];
const SORTS = new Set<LeadSort>([
  "createdAt",
  "updatedAt",
  "nextFollowUpAt",
  "protectedUntil",
  "expectedValue",
  "score",
]);
/** D-471 quick filters by score — reading presets for a long list, not a business threshold (the rules are the API's). */
const SCORE_FLOORS = ["60", "80"] as const;

/**
 * The staff pipeline (D-469 item 1): the same lead model, stages and "ย้ายไปขั้น…" menu as the agent zone, through the
 * shared components (`src/features/shared/sales`). A rep sees their own employee agent's leads (the API scopes); a
 * manager sees every rep's, can narrow to one, and can read freelance agents' leads (read-only — no stage menu).
 * Table on a desk, cards below 1024 px, a board by stage on request.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const { contract } = await adminServerApis();
  const [t, tAgent, me] = await Promise.all([
    getTranslations("sales.pipeline"),
    getTranslations("agentSales.list"),
    contract.GET("/v1/admin/me").then((response) => response.data!),
  ]);
  const manage = me.permissions.includes("sales.pipeline.manage");
  const tab = VIEWS.find((candidate) => candidate.key === search.view) ?? VIEWS[0];
  const sort = SORTS.has(search.sort as LeadSort) ? (search.sort as LeadSort) : "updatedAt";
  const order = search.order === "asc" ? "asc" : "desc";
  const kind = manage && search.kind === "freelance" ? "freelance" : "employee";
  const repAgentId = manage && search.rep ? search.rep : undefined;
  const q = search.q?.trim().slice(0, 100) || undefined;
  const minScore = SCORE_FLOORS.find((floor) => floor === search.score);
  const board = search.layout === "board" && tab.view !== "closed";
  const [list, reps] = await Promise.all([
    contract
      .GET("/v1/admin/sales/leads", {
        params: {
          query: {
            view: tab.view,
            sort,
            order,
            limit: 100,
            agentKind: kind,
            ...(repAgentId ? { agentId: repAgentId } : {}),
            ...(q ? { q } : {}),
            ...(minScore ? { minScore: Number(minScore) } : {}),
          },
        },
      })
      .then((response) => response.data!),
    manage ? contract.GET("/v1/admin/sales/reps").then((response) => response.data ?? []) : Promise.resolve([]),
  ]);
  const readOnly = kind === "freelance";

  const hrefWith = (changes: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = {
      view: tab.key === "all" ? undefined : tab.key,
      q,
      sort: sort === "updatedAt" ? undefined : sort,
      order: order === "desc" ? undefined : order,
      layout: board ? "board" : undefined,
      kind: kind === "employee" ? undefined : kind,
      rep: repAgentId,
      score: minScore,
      ...changes,
    };
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
    const query = params.toString();
    return query ? `/sales/pipeline?${query}` : "/sales/pipeline";
  };
  const sortHref = (key: LeadSort) =>
    hrefWith({
      sort: key === "updatedAt" && sort !== key ? undefined : key,
      order:
        sort === key
          ? order === "asc"
            ? "desc"
            : "asc"
          : key === "expectedValue" || key === "updatedAt" || key === "score"
            ? undefined
            : "asc",
    });

  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={manage ? t("descriptionManager") : t("descriptionRep")} />
      <SalesNav />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewTabs
          label={tAgent("views")}
          current={tab.key}
          items={VIEWS.map((view) => ({
            key: view.key,
            href: hrefWith({
              view: view.key === "all" ? undefined : view.key,
              layout: view.key === "closed" ? undefined : board ? "board" : undefined,
            }),
            label: tAgent(`viewLabels.${view.key}`),
          }))}
        />
        <div className="flex flex-wrap items-center gap-2">
          {manage ? (
            <ViewTabs
              label={t("kindLabel")}
              current={kind}
              items={(["employee", "freelance"] as const).map((value) => ({
                key: value,
                href: hrefWith({ kind: value === "employee" ? undefined : value, rep: undefined }),
                label: t(`kinds.${value}`),
              }))}
            />
          ) : null}
          <ViewTabs
            label={t("scoreLabel")}
            current={minScore ?? "any"}
            items={[
              { key: "any", href: hrefWith({ score: undefined }), label: t("scoreAny") },
              ...SCORE_FLOORS.map((floor) => ({
                key: floor,
                href: hrefWith({ score: floor }),
                label: t("scoreFrom", { score: floor }),
              })),
            ]}
          />
          {tab.view !== "closed" ? (
            <ViewTabs
              label={t("layoutLabel")}
              current={board ? "board" : "table"}
              className="max-lg:hidden"
              items={[
                { key: "table", href: hrefWith({ layout: undefined }), label: t("layouts.table") },
                { key: "board", href: hrefWith({ layout: "board" }), label: t("layouts.board") },
              ]}
            />
          ) : null}
        </div>
      </div>
      {manage && kind === "employee" && reps.length ? (
        <nav aria-label={t("repLabel")} className="-mt-2 flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-muted me-1">{t("repLabel")}</span>
          {[
            { id: undefined as string | undefined, name: t("allReps") },
            ...reps.filter((rep) => rep.agent).map((rep) => ({ id: rep.agent!.id, name: rep.displayName })),
          ].map((rep) => (
            <Link
              key={rep.id ?? "all"}
              href={hrefWith({ rep: rep.id })}
              aria-current={repAgentId === rep.id ? "page" : undefined}
              className={
                repAgentId === rep.id
                  ? "bg-primary-subtle text-primary-subtle-fg focus-visible:ring-focus-ring inline-flex min-h-9 items-center rounded-lg px-2.5 font-semibold outline-none focus-visible:ring-2"
                  : "text-muted hover:bg-surface-subtle hover:text-fg focus-visible:ring-focus-ring inline-flex min-h-9 items-center rounded-lg px-2.5 outline-none focus-visible:ring-2"
              }
            >
              {rep.name}
            </Link>
          ))}
        </nav>
      ) : null}
      {readOnly ? <p className="text-muted -mt-2 text-sm">{t("freelanceReadOnly")}</p> : null}

      {list.data.length === 0 ? (
        <EmptyState
          title={t(`empty.${tab.key}`)}
          description={manage ? t("emptyHintManager") : t("emptyHintRep")}
          icon="users"
          action={
            <Button asChild variant="secondary" iconStart="inbox">
              <Link href="/sales">{t("toInbox")}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:hidden" aria-label={tAgent("listLabel")}>
            {list.data.map((lead) => (
              <li key={lead.id}>
                <LeadCard lead={lead} surface="admin" readOnly={readOnly} />
              </li>
            ))}
          </ul>
          <div className="hidden lg:block">
            {board ? (
              <SalesBoard leads={list.data} readOnly={readOnly} />
            ) : (
              <SalesLeadTable
                leads={list.data}
                readOnly={readOnly}
                caption={tAgent("tableCaption", { view: tAgent(`viewLabels.${tab.key}`) })}
                sort={sort}
                order={order}
                sortHrefs={{
                  score: sortHref("score"),
                  nextFollowUpAt: sortHref("nextFollowUpAt"),
                  protectedUntil: sortHref("protectedUntil"),
                  expectedValue: sortHref("expectedValue"),
                  updatedAt: sortHref("updatedAt"),
                }}
                showAgent={manage}
              />
            )}
          </div>
        </>
      )}
    </ConsolePage>
  );
}
