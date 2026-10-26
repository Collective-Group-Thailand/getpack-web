"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { PROPOSAL_STATUS, SETTING_VERSION_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { toast } from "@/ui/components/Toast";

import { StatusChip, useCan, useProductTypes } from "../../console";
import { adminBrowserApis } from "../../console/api";
import { bangkokDay, useFactoryPart } from "../hooks";
import { FormDialog, Section } from "../parts";
import type { Factory, ProposalSummary } from "../resources";

type List = Schemas["PriceListDto"];
type Row = Schemas["PriceRowDto"];

/** A price row's columns as `key value` pairs — the component registry names the columns. */
export function formatValues(values: Record<string, unknown> | null | undefined): string {
  if (!values) return "–";
  return Object.entries(values)
    .map(([key, value]) => `${key} ${value === null ? "–" : String(value)}`)
    .join(" · ");
}

/**
 * The factory's prices (D-040, D-042, D-044): each product type's price list with the version in
 * force and any scheduled, its lines for roles allowed to see cost (D-141), and its proposals. A
 * platform-rate-card factory gets its rate cards from getpack: a new one starts here as a draft.
 */
export function Pricing({ factory }: { factory: Factory }) {
  const t = useTranslations("partners.pricing");
  const tPartners = useTranslations("partners");
  const format = useFormat();
  const { labelOf } = useProductTypes();
  const router = useRouter();
  const canCost = useCan("factory_buy_prices.read");
  const canPropose = useCan("price_proposals.review");
  const lists = useFactoryPart(factory.id, "/v1/admin/factories/{factoryId}/price-lists");
  const [viewing, setViewing] = useState<string | null>(null);
  const [component, setComponent] = useState<Schemas["PriceComponent"]>("material_prices");
  const components = useQuery({
    queryKey: queryKeys.list("admin", "price_component", {}),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/price-components")).data!,
    enabled: canCost,
  });
  const [drafting, setDrafting] = useState<List | null>(null);
  const [draft, setDraft] = useState({ effectiveFrom: "", comment: "" });

  const proposals = useQuery({
    queryKey: queryKeys.list("admin", "price_proposal", { factoryId: factory.id }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/price-proposals", {
          params: { query: { factoryId: factory.id } },
        })
      ).data!,
  });
  const lines = useQuery({
    queryKey: [...queryKeys.related("admin", "price_list_version", viewing ?? "none", "lines"), component],
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/price-list-versions/{versionId}/lines", {
          params: { path: { versionId: viewing! }, query: { component } },
        })
      ).data!,
    enabled: Boolean(viewing && canCost),
  });

  const lineColumns: DataTableColumn<Row>[] = [
    {
      id: "component",
      header: t("component"),
      cell: (row) => <span className="text-xs tabular-nums">{row.component}</span>,
    },
    {
      id: "values",
      header: t("values"),
      cell: (row) => <span className="text-xs tabular-nums">{formatValues(row.values)}</span>,
    },
  ];
  const proposalColumns: DataTableColumn<ProposalSummary>[] = [
    {
      id: "type",
      header: t("proposal"),
      cell: (row) => (
        <Link href={`/partners/proposals/${row.id}`} className="text-primary hover:underline">
          {t("proposalName", { type: labelOf(row.productTypeCode), date: format.date(row.proposedEffectiveFrom) })}
        </Link>
      ),
    },
    { id: "direction", header: t("direction"), cell: (row) => t(`directions.${row.direction}`) },
    { id: "status", header: t("status"), cell: (row) => <StatusChip map={PROPOSAL_STATUS} value={row.status} /> },
    { id: "lines", header: t("lines"), numeric: true, cell: (row) => row.lineCounts.total },
    { id: "createdAt", header: t("created"), cell: (row) => <When at={row.createdAt} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Section title={t("lists")} description={t("listsNote")}>
        <ul className="flex flex-col gap-3">
          {(lists.data ?? []).map((list) => (
            <li key={list.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{labelOf(list.productTypeCode)}</p>
                <div className="flex flex-wrap gap-2">
                  {canCost && list.current ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setViewing(viewing === list.current!.id ? null : list.current!.id)}
                    >
                      {viewing === list.current.id ? t("hideLines") : t("showLines", { count: list.current.lineCount })}
                    </Button>
                  ) : null}
                  {canPropose ? (
                    <Button size="sm" variant="secondary" iconStart="plus" onClick={() => setDrafting(list)}>
                      {t("newRateCard")}
                    </Button>
                  ) : null}
                </div>
              </div>
              {list.current ? (
                <p className="text-muted mt-1 flex flex-wrap items-center gap-2 text-sm">
                  {t("version", { no: list.current.versionNo })}
                  <StatusChip map={SETTING_VERSION_STATUS} value={list.current.status} />
                  <Badge size="sm">{t(`origins.${list.current.origin}`)}</Badge>
                  {t("since")} <When at={list.current.effectiveFrom} absoluteOnly />
                </p>
              ) : (
                <p className="text-muted mt-1 text-sm">{t("noVersion")}</p>
              )}
              {list.upcoming.length > 0 ? (
                <p className="text-warning-subtle-fg mt-1 text-sm">{t("upcoming", { count: list.upcoming.length })}</p>
              ) : null}
              {viewing && viewing === list.current?.id ? (
                <div className="mt-3 max-w-xs">
                  <Field label={t("component")}>
                    <SearchableSelect
                      value={component}
                      onValueChange={(value) => setComponent(value as Schemas["PriceComponent"])}
                      options={(components.data ?? []).map((item) => ({
                        value: item.component,
                        label: tPartners(`components.${item.component}`),
                      }))}
                    />
                  </Field>
                </div>
              ) : null}
              {viewing && viewing === list.current?.id ? (
                <DataTable
                  className="mt-3"
                  caption={t("linesOf", { type: labelOf(list.productTypeCode) })}
                  columns={lineColumns}
                  rows={lines.data?.data ?? []}
                  getRowId={(row) => row.lineKey}
                  loading={lines.isPending}
                  density="compact"
                />
              ) : null}
            </li>
          ))}
        </ul>
        {!canCost ? <p className="text-muted mt-3 text-xs">{t("costHidden")}</p> : null}
      </Section>

      <Section title={t("proposals")}>
        <DataTable
          caption={t("proposals")}
          columns={proposalColumns}
          rows={proposals.data?.data ?? []}
          getRowId={(row) => row.id}
          loading={proposals.isPending}
          density="compact"
          empty={<p className="text-muted p-3 text-sm">{t("noProposals")}</p>}
        />
      </Section>

      {drafting ? (
        <FormDialog
          title={t("newRateCard")}
          description={t("newRateCardBody", { type: labelOf(drafting.productTypeCode), code: factory.code })}
          submitLabel={t("createDraft")}
          onClose={() => setDrafting(null)}
          onSubmit={async () => {
            const created = (
              await adminBrowserApis().contract.POST("/v1/admin/factories/{factoryId}/price-proposals", {
                params: { path: { factoryId: factory.id } },
                body: {
                  productTypeId: drafting.productTypeId,
                  ...(draft.effectiveFrom ? { proposedEffectiveFrom: bangkokDay(draft.effectiveFrom) } : {}),
                  comment: draft.comment.trim() || null,
                },
              })
            ).data!;
            toast.success(t("draftCreated"));
            router.push(`/partners/proposals/${created.id}`);
          }}
        >
          <Field label={t("effectiveFrom")}>
            <Input
              type="date"
              value={draft.effectiveFrom}
              onChange={(event) => setDraft({ ...draft, effectiveFrom: event.target.value })}
            />
          </Field>
          <Field label={t("comment")}>
            <Textarea
              rows={2}
              value={draft.comment}
              onChange={(event) => setDraft({ ...draft, comment: event.target.value })}
            />
          </Field>
        </FormDialog>
      ) : null}
    </div>
  );
}
