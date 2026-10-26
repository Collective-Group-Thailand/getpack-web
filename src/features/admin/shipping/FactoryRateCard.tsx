"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  ConfirmAction,
  FormDialog,
  FormError,
  problemMessage,
  QueryError,
  Section,
  useCan,
} from "../console";
import { RateLinesEditor } from "./RateLinesEditor";
import {
  editable,
  emptyLine,
  effectiveInstant,
  problemsOf,
  STATUS_TONE,
  today,
  toInput,
  type EditableLine,
} from "./rates";
import { RatesTable, type RateRow } from "./RatesTable";
import { useCustomerZones } from "./zones";

type Summary = Schemas["FactoryRateVersionSummaryDto"];
type Rate = Schemas["FactoryRateDto"];
type Answer = Schemas["ShippingCounterAnswer"];
type Confirming = { kind: "send" | "withdraw" | "delete"; version: Summary };
type Row = RateRow & { rate: Rate };

/**
 * What getpack pays a factory to deliver with its own fleet (D-013, D-042): payout lines over the
 * `customer_default` zones, drafted here, sent to the factory, which accepts the card or counters
 * line by line; the version applies only once every line is accepted. Buy prices — the tab is for
 * D-141 roles, every read is audited (D-044); suggestions never reach the factory.
 */
export function FactoryRateCard({ factoryId }: { factoryId: string }) {
  const t = useTranslations("shipping.factory");
  const tVersion = useTranslations("shipping.version");
  const format = useFormat();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const canManage = useCan("factory_shipping_rates.manage");
  const canSuggest = useCan("price_suggestions.read");
  const zones = useCustomerZones();
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ effectiveFrom: string; reason: string; copy: boolean } | null>(null);
  const [editing, setEditing] = useState<EditableLine[] | null>(null);
  const [answering, setAnswering] = useState<Record<string, Answer> | null>(null);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const path = { factoryId };

  const card = useQuery({
    queryKey: queryKeys.related("admin", "partner", factoryId, "shipping-rate-card"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/factories/{factoryId}/shipping-rate-card", {
          params: { path },
        })
      ).data!,
  });
  const versions = useQuery({
    queryKey: queryKeys.related("admin", "partner", factoryId, "shipping-rate-versions"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/factories/{factoryId}/shipping-rate-card/versions", {
          params: { path },
        })
      ).data!,
  });
  const shownId = selected ?? card.data?.open?.id ?? card.data?.current?.id ?? versions.data?.[0]?.id ?? null;
  const version = useQuery({
    queryKey: queryKeys.related("admin", "partner", factoryId, `shipping-rate-version:${shownId}`),
    enabled: Boolean(shownId),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET(
          "/v1/admin/factories/{factoryId}/shipping-rate-card/versions/{versionId}",
          {
            params: { path: { factoryId, versionId: shownId! } },
          },
        )
      ).data!,
  });
  const suggestions = useQuery({
    queryKey: queryKeys.related("admin", "partner", factoryId, `shipping-rate-suggestions:${shownId}`),
    enabled: Boolean(shownId) && canSuggest,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET(
          "/v1/admin/factories/{factoryId}/shipping-rate-card/versions/{versionId}/suggestions",
          { params: { path: { factoryId, versionId: shownId! } } },
        )
      ).data!,
  });
  const refresh = (versionId?: string) => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.related("admin", "partner", factoryId, "shipping-rate-card"),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.related("admin", "partner", factoryId, "shipping-rate-versions"),
    });
    if (shownId)
      void queryClient.invalidateQueries({
        queryKey: queryKeys.related("admin", "partner", factoryId, `shipping-rate-version:${shownId}`),
      });
    if (versionId) setSelected(versionId);
  };

  if (card.isError) return <QueryError error={card.error} onRetry={() => void card.refetch()} />;
  const shown = version.data;
  const byRate = new Map((suggestions.data ?? []).map((s) => [s.rateId, s] as const));
  const countered = (shown?.rates ?? []).filter((rate) => rate.acceptance === "countered");
  const statusBadge = (status: Summary["status"]) => (
    <Badge size="sm" tone={STATUS_TONE[status]}>
      {tVersion(`statuses.${status}`)}
    </Badge>
  );

  const versionColumns: DataTableColumn<Summary>[] = [
    {
      id: "no",
      header: tVersion("no"),
      cell: (row) => (
        <button type="button" className="text-primary font-medium hover:underline" onClick={() => setSelected(row.id)}>
          {tVersion("label", { no: row.versionNo })}
        </button>
      ),
    },
    { id: "status", header: tVersion("status"), cell: (row) => statusBadge(row.status) },
    { id: "effective", header: tVersion("effectiveFrom"), cell: (row) => <When at={row.effectiveFrom} absoluteOnly /> },
    { id: "rates", header: tVersion("rateCount"), numeric: true, cell: (row) => format.number(row.rateCount) },
    {
      id: "open",
      header: t("openLines"),
      numeric: true,
      cell: (row) => (row.status === "pending_acceptance" ? format.number(row.openLines) : "—"),
    },
    { id: "sent", header: t("sentAt"), cell: (row) => (row.sentAt ? <When at={row.sentAt} /> : "—") },
    { id: "reason", header: tVersion("reason"), cell: (row) => <span className="text-sm">{row.reason}</span> },
  ];

  const extra: DataTableColumn<Row>[] = [
    {
      id: "acceptance",
      header: t("answer"),
      cell: ({ rate }) =>
        shown?.status === "draft" ? (
          "—"
        ) : (
          <div>
            <Badge
              size="sm"
              tone={
                rate.acceptance === "accepted" ? "success" : rate.acceptance === "countered" ? "warning" : "neutral"
              }
            >
              {t(`acceptance.${rate.acceptance}`)}
            </Badge>
            {rate.acceptance === "countered" ? (
              <p className="mt-1 text-xs">
                {t("counter", { amount: format.thb(rate.counterAmount), extra: format.thb(rate.counterPerExtraKg) })}
                {rate.counterNote ? <span className="text-muted block">{rate.counterNote}</span> : null}
              </p>
            ) : null}
          </div>
        ),
    },
    ...(canSuggest
      ? [
          {
            id: "suggestion",
            header: t("suggestion"),
            cell: ({ rate }: Row) => {
              const s = byRate.get(rate.id);
              if (!s) return "—";
              return (
                <div className="text-xs">
                  {s.suggestedAmount ? (
                    <p>
                      {format.thb(s.suggestedAmount)}
                      {s.deviationPct ? (
                        <span className={Number(s.deviationPct) > 0 ? "text-danger ms-1" : "text-muted ms-1"}>
                          {t("deviation", {
                            value: `${Number(s.deviationPct) > 0 ? "+" : ""}${format.percent(s.deviationPct, 1)}`,
                          })}
                        </span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="text-muted">{t(`basis.${s.basis}`)}</p>
                  )}
                  {s.peerMedianAmount ? (
                    <p className="text-muted">
                      {t("peerMedian", { amount: format.thb(s.peerMedianAmount), count: s.peerCount })}
                    </p>
                  ) : null}
                </div>
              );
            },
          } satisfies DataTableColumn<Row>,
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5 pt-4">
      <Callout tone="info" icon="lock" title={t("auditNote")} />
      <div className="grid gap-3 md:grid-cols-3">
        {(
          [
            ["current", card.data?.current, t("noCurrent")],
            ["scheduled", card.data?.scheduled, t("noScheduled")],
            ["open", card.data?.open, t("noOpen")],
          ] as const
        ).map(([slot, summary, empty]) => (
          <div key={slot} className="border-border rounded-card border p-4">
            <p className="text-muted text-xs font-medium">{t(slot)}</p>
            {summary ? (
              <>
                <p className="mt-1 font-medium">
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setSelected(summary.id)}
                  >
                    {tVersion("label", { no: summary.versionNo })}
                  </button>{" "}
                  {statusBadge(summary.status)}
                </p>
                <p className="text-muted text-sm">
                  {tVersion("from")} <When at={summary.effectiveFrom} absoluteOnly /> ·{" "}
                  {tVersion("rates", { count: summary.rateCount })}
                </p>
              </>
            ) : (
              <p className="text-muted mt-1 text-sm">{empty}</p>
            )}
          </div>
        ))}
      </div>

      <Section
        title={t("versionsTitle")}
        actions={
          canManage && !card.data?.open ? (
            <Button
              size="sm"
              iconStart="plus"
              onClick={() => setCreating({ effectiveFrom: today(), reason: "", copy: Boolean(card.data?.current) })}
            >
              {t("newVersion")}
            </Button>
          ) : null
        }
      >
        <DataTable
          caption={t("versionsTitle")}
          columns={versionColumns}
          rows={versions.data ?? []}
          getRowId={(row) => row.id}
          loading={versions.isPending}
          rowTone={(row) => (row.id === shownId ? "info" : undefined)}
          empty={<EmptyState icon="truck" title={t("noVersions")} description={t("noVersionsHint")} />}
        />
      </Section>

      {shown ? (
        <Section
          title={tVersion("title", { no: shown.versionNo })}
          description={
            <>
              {tVersion("from")} <When at={shown.effectiveFrom} absoluteOnly /> · {shown.reason}
              {shown.factoryAcceptedAt ? (
                <>
                  {" · "}
                  {t("acceptedAt")} <When at={shown.factoryAcceptedAt} />
                </>
              ) : null}
            </>
          }
          actions={
            <span className="flex flex-wrap gap-2">
              {statusBadge(shown.status)}
              {canManage && shown.status === "draft" ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    iconStart="edit"
                    onClick={() =>
                      setEditing(
                        shown.rates.length
                          ? shown.rates.map((rate) => editable(rate, rate.payoutAmount))
                          : [emptyLine(zones.data?.[0]?.id)],
                      )
                    }
                  >
                    {tVersion("editRates")}
                  </Button>
                  <Button
                    size="sm"
                    iconStart="send"
                    disabled={shown.rateCount === 0}
                    onClick={() => setConfirming({ kind: "send", version: shown })}
                  >
                    {t("send")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    iconStart="trash"
                    onClick={() => setConfirming({ kind: "delete", version: shown })}
                  >
                    {tVersion("delete")}
                  </Button>
                </>
              ) : null}
              {canManage && shown.status === "pending_acceptance" ? (
                <>
                  {countered.length ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        setAnswering(Object.fromEntries(countered.map((rate) => [rate.id, "accept_counter" as Answer])))
                      }
                    >
                      {t("answerCounters", { count: countered.length })}
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => setConfirming({ kind: "withdraw", version: shown })}>
                    {tVersion("withdraw")}
                  </Button>
                </>
              ) : null}
            </span>
          }
        >
          <RatesTable<Row>
            caption={tVersion("title", { no: shown.versionNo })}
            amountLabel={t("payout")}
            rows={shown.rates.map((rate) => ({
              ...rate,
              zoneName: locale === "en" ? rate.zoneNameEn : rate.zoneNameTh,
              amount: rate.payoutAmount,
              rate,
            }))}
            extraColumns={extra}
          />
        </Section>
      ) : version.isError ? (
        <QueryError error={version.error} onRetry={() => void version.refetch()} />
      ) : null}

      {creating ? (
        <FormDialog
          title={t("newVersionTitle")}
          description={t("newVersionIntro")}
          submitLabel={t("createDraft")}
          onClose={() => setCreating(null)}
          onSubmit={async () => {
            if (creating.reason.trim().length < 3) throw new FormError(t("reasonRequired"));
            const { data } = await adminBrowserApis().contract.POST(
              "/v1/admin/factories/{factoryId}/shipping-rate-card/versions",
              {
                params: { path },
                body: {
                  effectiveFrom: effectiveInstant(creating.effectiveFrom),
                  reason: creating.reason.trim(),
                  ...(creating.copy && card.data?.current
                    ? { copyFromVersionId: card.data.current.id }
                    : { rates: [] }),
                },
              },
            );
            toast.success(t("drafted"));
            refresh(data!.id);
          }}
        >
          <Field label={tVersion("effectiveFrom")} required>
            <Input
              type="date"
              min={today()}
              value={creating.effectiveFrom}
              onChange={(e) => setCreating({ ...creating, effectiveFrom: e.target.value })}
            />
          </Field>
          <Field label={tVersion("reason")} required>
            <Input value={creating.reason} onChange={(e) => setCreating({ ...creating, reason: e.target.value })} />
          </Field>
          {card.data?.current ? (
            <SegmentedControl
              label={t("startFrom")}
              value={creating.copy ? "copy" : "empty"}
              onValueChange={(value) => setCreating({ ...creating, copy: value === "copy" })}
              options={[
                { value: "copy", label: t("copyCurrent", { no: card.data.current.versionNo }) },
                { value: "empty", label: t("startEmpty") },
              ]}
            />
          ) : null}
        </FormDialog>
      ) : null}

      {editing && shown ? (
        <FormDialog
          size="xl"
          title={tVersion("editTitle", { no: shown.versionNo })}
          description={tVersion("editIntro")}
          submitLabel={tVersion("saveRates")}
          onClose={() => setEditing(null)}
          onSubmit={async () => {
            if (problemsOf(editing).size) throw new FormError(tVersion("fixLines"));
            await adminBrowserApis().contract.PUT(
              "/v1/admin/factories/{factoryId}/shipping-rate-card/versions/{versionId}/rates",
              {
                params: { path: { factoryId, versionId: shown.id } },
                body: {
                  rates: editing.map((line) => {
                    const { amount, ...input } = toInput(line);
                    return { ...input, payoutAmount: amount };
                  }),
                },
              },
            );
            toast.success(tVersion("ratesSaved"));
            refresh(shown.id);
          }}
        >
          <RateLinesEditor
            lines={editing}
            onChange={setEditing}
            zones={zones.data ?? []}
            problems={problemsOf(editing)}
            amountLabel={t("payout")}
          />
        </FormDialog>
      ) : null}

      {answering && shown ? (
        <FormDialog
          size="lg"
          title={t("answerTitle", { no: shown.versionNo })}
          description={t("answerIntro")}
          submitLabel={t("sendAnswers")}
          onClose={() => setAnswering(null)}
          onSubmit={async () => {
            await adminBrowserApis().contract.POST(
              "/v1/admin/factories/{factoryId}/shipping-rate-card/versions/{versionId}/actions/answer-counters",
              {
                params: { path: { factoryId, versionId: shown.id } },
                body: { lines: Object.entries(answering).map(([rateId, decision]) => ({ rateId, decision })) },
              },
            );
            toast.success(t("answered"));
            refresh(shown.id);
          }}
        >
          <ul className="divide-border flex flex-col divide-y">
            {countered.map((rate) => (
              <li key={rate.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="min-w-48">
                  <span className="tabular-nums">{rate.zoneCode}</span> {rate.postcode ?? ""} ·{" "}
                  {format.number(rate.weightMinG / 1000)}–
                  {rate.weightMaxG === null ? "∞" : format.number(rate.weightMaxG / 1000)}
                </span>
                <span>
                  {t("ours", { amount: format.thb(rate.payoutAmount) })} →{" "}
                  {t("theirs", { amount: format.thb(rate.counterAmount) })}
                  {rate.counterNote ? <span className="text-muted block text-xs">{rate.counterNote}</span> : null}
                </span>
                <SegmentedControl
                  className="ms-auto"
                  label={t("decision")}
                  value={answering[rate.id] ?? "accept_counter"}
                  onValueChange={(value) => setAnswering({ ...answering, [rate.id]: value as Answer })}
                  options={[
                    { value: "accept_counter", label: t("acceptCounter") },
                    { value: "keep", label: t("keepOurs") },
                  ]}
                />
              </li>
            ))}
          </ul>
        </FormDialog>
      ) : null}

      {confirming ? (
        <ConfirmAction
          open
          onOpenChange={(open) => !open && setConfirming(null)}
          title={t(`confirm.${confirming.kind}.title`, { no: confirming.version.versionNo })}
          description={t(`confirm.${confirming.kind}.body`)}
          confirmLabel={t(`confirm.${confirming.kind}.action`)}
          tone={confirming.kind === "send" ? "primary" : "destructive"}
          reason={
            confirming.kind === "withdraw"
              ? { label: tVersion("withdrawReason"), required: true, minLength: 3 }
              : undefined
          }
          onConfirm={async ({ reason }) => {
            const params = { path: { factoryId, versionId: confirming.version.id } };
            try {
              if (confirming.kind === "send")
                await adminBrowserApis().contract.POST(
                  "/v1/admin/factories/{factoryId}/shipping-rate-card/versions/{versionId}/actions/send",
                  { params },
                );
              else if (confirming.kind === "withdraw")
                await adminBrowserApis().contract.POST(
                  "/v1/admin/factories/{factoryId}/shipping-rate-card/versions/{versionId}/actions/withdraw",
                  { params, body: { reason } },
                );
              else
                await adminBrowserApis().contract.DELETE(
                  "/v1/admin/factories/{factoryId}/shipping-rate-card/versions/{versionId}",
                  { params },
                );
              toast.success(t(`confirm.${confirming.kind}.done`));
              if (confirming.kind === "delete") setSelected(null);
              refresh(confirming.kind === "delete" ? undefined : confirming.version.id);
              setConfirming(null);
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        />
      ) : null}
    </div>
  );
}
