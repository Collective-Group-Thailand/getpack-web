"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { PROPOSAL_LINE_STATUS, PROPOSAL_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";
import { cn } from "@/ui/lib/cn";

import { ConfirmAction, problemMessage, QueryError, StatusChip, useCan, useProductTypes } from "../console";
import { adminBrowserApis } from "../console/api";

type Proposal = Schemas["PriceProposalDto"];
type Line = Schemas["PriceProposalLineDto"];
type Component = Schemas["PriceComponentDto"];
type Decision = "accept" | "reject" | "counter";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Columns that differ between two value sets — what the review should draw the eye to. */
function changed(current: Record<string, unknown> | null, proposed: Record<string, unknown> | null) {
  if (!current || !proposed) return new Set<string>();
  return new Set(Object.keys(proposed).filter((key) => String(current[key]) !== String(proposed[key])));
}

function Values({ values, highlight }: { values: Record<string, unknown> | null; highlight?: Set<string> }) {
  if (!values) return <span className="text-muted">–</span>;
  return (
    <span className="flex flex-wrap gap-x-2 font-mono text-xs">
      {Object.entries(values).map(([key, value]) => {
        const text = value === null ? "–" : String(value);
        // A catalogue reference is an id: its tail is enough to tell lines apart; the whole id is on hover.
        const reference = UUID.test(text);
        return (
          <span
            key={key}
            title={reference ? text : undefined}
            className={cn(highlight?.has(key) && "bg-warning-subtle text-warning-subtle-fg rounded px-1 font-semibold")}
          >
            {key} {reference ? `…${text.slice(-6)}` : text}
          </span>
        );
      })}
    </span>
  );
}

/**
 * One price proposal (D-040, D-042, D-044). A factory's proposal is decided line by line —
 * accept, reject or counter — against what is in force and, for staff with the right to see them,
 * the suggested value with its basis and deviation (D-040 note; flagged against a band only once
 * one is set, D-172), plus a 90-day impact simulation. A rate card Packio drafts for a
 * platform-rate-card factory is edited here and sent for the factory's acceptance.
 */
export function ProposalReview({ proposalId }: { proposalId: string }) {
  const t = useTranslations("partners.review");
  const tPartners = useTranslations("partners");
  const format = useFormat();
  const { labelOf } = useProductTypes();
  const queryClient = useQueryClient();
  const canReview = useCan("price_proposals.review");
  const canSuggest = useCan("price_suggestions.read");
  const key = queryKeys.detail("admin", "price_proposal", proposalId);
  const [decisions, setDecisions] = useState<
    Record<string, { decision: Decision; counter: Record<string, string>; comment: string }>
  >({});
  const [confirming, setConfirming] = useState<"submit" | "withdraw" | null>(null);
  const [editing, setEditing] = useState(false);
  const [newLine, setNewLine] = useState<{
    component: string;
    action: Schemas["ProposalLineAction"];
    values: Record<string, string>;
  }>({
    component: "",
    action: "change",
    values: {},
  });
  const [submitKey] = useState(newIdempotencyKey);

  const proposal = useQuery({
    queryKey: key,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/price-proposals/{proposalId}", {
          params: { path: { proposalId } },
        })
      ).data!,
  });
  const components = useQuery({
    queryKey: queryKeys.list("admin", "price_component", {}),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/price-components")).data!,
  });
  const suggestions = useQuery({
    queryKey: queryKeys.related("admin", "price_proposal", proposalId, "suggestions"),
    queryFn: () =>
      browserRequests().call("GET /v1/admin/price-proposals/{proposalId}/suggestions", { path: { proposalId } }),
    enabled: canSuggest,
  });
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const simulation = useQuery({
    queryKey: queryKeys.related("admin", "price_proposal", proposalId, `simulation:${simulationId}`),
    queryFn: () =>
      browserRequests().call("GET /v1/admin/price-proposals/{proposalId}/simulations/{simulationId}", {
        path: { proposalId, simulationId: simulationId! },
      }),
    enabled: Boolean(simulationId),
    // The worker re-prices in the background: poll until it is done.
    refetchInterval: (query) =>
      query.state.data && ["queued", "running"].includes(query.state.data.status) ? 2000 : false,
  });

  const settle = (updated?: Proposal) => {
    if (updated) queryClient.setQueryData(key, updated);
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "price_proposal") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
  };

  const decide = useMutation({
    mutationFn: async () =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/price-proposals/{proposalId}/actions/decide", {
          params: { path: { proposalId } },
          body: {
            lines: Object.entries(decisions).map(([lineId, item]) => ({
              lineId,
              decision: item.decision,
              ...(item.decision === "counter" ? { counterValues: item.counter } : {}),
              comment: item.comment.trim() || null,
            })),
          },
        })
      ).data!,
    onSuccess: (updated) => {
      setDecisions({});
      settle(updated);
      toast.success(t("decided"));
    },
    onError: (error) => toast.error(problemMessage(error, t("decideFailed"))),
  });

  const simulate = useMutation({
    mutationFn: () =>
      browserRequests().call("POST /v1/admin/price-proposals/{proposalId}/simulations", { path: { proposalId } }),
    onSuccess: (started) => setSimulationId(started.id),
    onError: (error) => toast.error(problemMessage(error, t("simulateFailed"))),
  });

  const saveLines = useMutation({
    mutationFn: async (lines: Schemas["PriceProposalLineInput"][]) =>
      (
        await adminBrowserApis().contract.PUT("/v1/admin/price-proposals/{proposalId}/lines", {
          params: { path: { proposalId } },
          body: { lines },
        })
      ).data!,
    onSuccess: (updated) => {
      settle(updated);
      setEditing(false);
      setNewLine({ component: "", action: "change", values: {} });
      toast.success(t("linesSaved"));
    },
    onError: (error) => toast.error(problemMessage(error, t("linesFailed"))),
  });

  if (proposal.isError) return <QueryError error={proposal.error} onRetry={() => void proposal.refetch()} />;
  const item = proposal.data;
  if (!item) return null;

  const suggestionOf = new Map((suggestions.data?.lines ?? []).map((line) => [line.lineId, line]));
  const componentOf = (name: string) => components.data?.find((candidate) => candidate.component === name);
  const decidable =
    canReview &&
    item.direction === "factory_to_packio" &&
    ["submitted", "under_review", "countered"].includes(item.status);
  const editable = canReview && item.direction === "packio_to_factory" && item.status === "draft";
  const valueKeys = (component?: Component) => component?.values.map((column) => column.key) ?? [];

  const setDecision = (line: Line, decision: Decision) =>
    setDecisions((current) => ({
      ...current,
      [line.id]: {
        decision,
        comment: current[line.id]?.comment ?? "",
        counter:
          current[line.id]?.counter ??
          Object.fromEntries(
            valueKeys(componentOf(line.component)).map((column) => [
              column,
              String((line.proposedValues ?? {})[column] ?? ""),
            ]),
          ),
      },
    }));

  const lineInputs = (lines: Line[]): Schemas["PriceProposalLineInput"][] =>
    lines.map((line) => ({
      component: line.component,
      action: line.action,
      lineKey: line.lineKey,
      values: (line.action === "remove" ? line.currentValues : line.proposedValues) ?? {},
    }));

  const result = simulation.data?.result;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[
              { label: t("partners"), href: "/partners" },
              { label: t("proposals"), href: "/partners/proposals" },
              { label: `${item.factoryCode} · ${labelOf(item.productTypeCode)}` },
            ]}
          />
        }
        title={t("title", { factory: item.factoryCode, type: labelOf(item.productTypeCode) })}
        meta={
          <>
            <StatusChip map={PROPOSAL_STATUS} value={item.status} size="md" />
            <Badge>{t(`directions.${item.direction}`)}</Badge>
          </>
        }
        description={item.comment ?? undefined}
        actions={
          <>
            {canSuggest ? (
              <Button
                variant="secondary"
                iconStart="chart"
                loading={simulate.isPending}
                onClick={() => simulate.mutate()}
              >
                {t("simulate")}
              </Button>
            ) : null}
            {editable ? (
              <>
                <Button variant="ghost" onClick={() => setConfirming("withdraw")}>
                  {t("withdraw")}
                </Button>
                <Button iconStart="send" disabled={item.lines.length === 0} onClick={() => setConfirming("submit")}>
                  {t("submit")}
                </Button>
              </>
            ) : null}
            {decidable ? (
              <Button
                iconStart="check"
                loading={decide.isPending}
                disabled={Object.keys(decisions).length === 0}
                onClick={() => decide.mutate()}
              >
                {t("saveDecisions", { count: Object.keys(decisions).length })}
              </Button>
            ) : null}
          </>
        }
      />

      <Card padding="lg">
        <DescriptionList
          columns={3}
          items={[
            {
              term: t("factory"),
              description: (
                <Link href={`/partners/${item.factoryId}?tab=pricing`} className="text-primary hover:underline">
                  {item.factoryCode}
                </Link>
              ),
            },
            { term: t("productType"), description: labelOf(item.productTypeCode) },
            { term: t("effectiveFrom"), description: <When at={item.proposedEffectiveFrom} absoluteOnly /> },
            {
              term: t("base"),
              description: item.baseVersionNo ? t("versionNo", { no: item.baseVersionNo }) : t("noBase"),
            },
            {
              term: t("lineCounts"),
              description: t("counts", {
                total: item.lineCounts.total,
                pending: item.lineCounts.pending,
                accepted: item.lineCounts.accepted,
                rejected: item.lineCounts.rejected,
                countered: item.lineCounts.countered,
              }),
            },
            ...(item.resultingVersion
              ? [{ term: t("resulting"), description: t("versionNo", { no: item.resultingVersion.versionNo }) }]
              : []),
            ...(item.approvalRequestId
              ? [
                  {
                    term: t("approval"),
                    description: (
                      <Link href={`/approvals/${item.approvalRequestId}`} className="text-primary hover:underline">
                        {t("openApproval")}
                      </Link>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>

      {simulationId ? (
        <Card padding="lg">
          <CardHeader>
            <CardTitle>{t("simulationTitle")}</CardTitle>
          </CardHeader>
          {simulation.data?.status === "failed" ? (
            <Callout tone="danger" title={simulation.data.error ?? t("simulateFailed")} />
          ) : !result ? (
            <p className="text-muted text-sm">{t("simulating")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-4">
              {(
                [
                  ["quotes", format.number(result.quotesInWindow)],
                  ["price", result.priceChangePct === null ? "–" : format.percent(result.priceChangePct)],
                  ["margin", result.marginChangePct === null ? "–" : format.percent(result.marginChangePct)],
                  [
                    "share",
                    result.selectionShareChangePct === null ? "–" : format.percent(result.selectionShareChangePct),
                  ],
                ] as const
              ).map(([name, value]) => (
                <div key={name} className="rounded-md border p-3">
                  <p className="text-muted text-xs">{t(`simulation.${name}`)}</p>
                  <p className="text-xl font-semibold tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          )}
          {simulation.data ? (
            <p className="text-muted mt-2 text-xs">
              {t("window")} <When at={simulation.data.windowFrom} absoluteOnly /> –{" "}
              <When at={simulation.data.windowTo} absoluteOnly />
            </p>
          ) : null}
        </Card>
      ) : null}

      <Card padding="lg">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{t("lines")}</CardTitle>
          {editable ? (
            <Button size="sm" variant="secondary" iconStart="plus" onClick={() => setEditing(true)}>
              {t("addLine")}
            </Button>
          ) : null}
        </CardHeader>
        {!canSuggest ? <p className="text-muted mb-3 text-xs">{t("noSuggestions")}</p> : null}
        {item.lines.length === 0 ? <p className="text-muted text-sm">{t("noLines")}</p> : null}
        <ol className="flex flex-col gap-3">
          {item.lines.map((line, index) => {
            const suggestion = suggestionOf.get(line.id);
            const mine = decisions[line.id];
            const deviation = suggestion?.deviationPct ? Number(suggestion.deviationPct) : null;
            return (
              <li key={line.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="text-muted">{index + 1}.</span>
                    <span>{tPartners(`components.${line.component}`)}</span>
                    <Badge size="sm">{t(`actions.${line.action}`)}</Badge>
                    <StatusChip map={PROPOSAL_LINE_STATUS} value={line.decision} />
                  </p>
                  {decidable && line.decision === "pending" ? (
                    <SegmentedControl
                      label={t("decisionFor", { no: index + 1 })}
                      size="sm"
                      value={mine?.decision ?? ("" as Decision)}
                      onValueChange={(value) => setDecision(line, value)}
                      options={[
                        { value: "accept", label: t("accept"), icon: "check" },
                        { value: "counter", label: t("counter"), icon: "scale" },
                        { value: "reject", label: t("reject"), icon: "ban" },
                      ]}
                    />
                  ) : null}
                </div>
                <dl className="mt-2 grid gap-2 text-sm md:grid-cols-3">
                  <div>
                    <dt className="text-muted text-xs">{t("current")}</dt>
                    <dd>
                      <Values values={line.currentValues} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted text-xs">{t("proposed")}</dt>
                    <dd>
                      <Values
                        values={line.proposedValues}
                        highlight={changed(line.currentValues, line.proposedValues)}
                      />
                    </dd>
                  </div>
                  {canSuggest ? (
                    <div>
                      <dt className="text-muted flex items-center gap-1 text-xs">
                        {t("suggested")}
                        {suggestion ? <Badge size="sm">{t(`methods.${suggestion.method}`)}</Badge> : null}
                      </dt>
                      <dd>
                        <Values values={suggestion?.suggestedValues ?? null} />
                        {deviation !== null ? (
                          <p
                            className={cn(
                              "mt-1 text-xs font-medium",
                              Math.abs(deviation) >= 5 ? "text-warning-subtle-fg" : "text-muted",
                            )}
                          >
                            {t("deviation", { pct: format.percent(suggestion!.deviationPct) })}
                          </p>
                        ) : null}
                        {suggestion?.flags.length ? (
                          <p className="mt-1 flex flex-wrap gap-1">
                            {suggestion.flags.map((flag) => (
                              <Badge key={flag} size="sm" tone="warning">
                                {t.has(`flags.${flag}`) ? t(`flags.${flag}`) : flag}
                              </Badge>
                            ))}
                          </p>
                        ) : null}
                        {suggestion?.basis ? (
                          <p className="text-muted mt-1 text-xs">{basisText(suggestion.basis, t)}</p>
                        ) : null}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                {line.counterValues ? (
                  <p className="mt-2 text-sm">
                    {t("countered")} <Values values={line.counterValues} />
                  </p>
                ) : null}
                {line.comment ? <p className="text-muted mt-1 text-sm">{line.comment}</p> : null}
                {mine ? (
                  <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2">
                    {mine.decision === "counter"
                      ? Object.entries(mine.counter).map(([column, value]) => (
                          <Field key={column} label={t("counterValue", { column })}>
                            <Input
                              inputMode="decimal"
                              className="font-mono"
                              value={value}
                              onChange={(event) =>
                                setDecisions((current) => ({
                                  ...current,
                                  [line.id]: { ...mine, counter: { ...mine.counter, [column]: event.target.value } },
                                }))
                              }
                            />
                          </Field>
                        ))
                      : null}
                    <Field label={t("comment")} className="sm:col-span-2">
                      <Textarea
                        rows={2}
                        value={mine.comment}
                        onChange={(event) =>
                          setDecisions((current) => ({
                            ...current,
                            [line.id]: { ...mine, comment: event.target.value },
                          }))
                        }
                      />
                    </Field>
                  </div>
                ) : null}
                {editable ? (
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      iconStart="trash"
                      loading={saveLines.isPending}
                      onClick={() => saveLines.mutate(lineInputs(item.lines.filter((other) => other.id !== line.id)))}
                    >
                      {t("removeLine", { no: index + 1 })}
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
        {editing ? (
          <div className="mt-4 flex flex-col gap-3 rounded-md border p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("component")}>
                <Select
                  value={newLine.component || undefined}
                  placeholder={t("chooseComponent")}
                  onValueChange={(component) => setNewLine({ ...newLine, component, values: {} })}
                  options={(components.data ?? []).map((candidate) => ({
                    value: candidate.component,
                    label: tPartners(`components.${candidate.component}`),
                  }))}
                />
              </Field>
              <Field label={t("lineAction")}>
                <Select
                  value={newLine.action}
                  onValueChange={(action) =>
                    setNewLine({ ...newLine, action: action as Schemas["ProposalLineAction"] })
                  }
                  options={(["add", "change", "remove"] as const).map((value) => ({
                    value,
                    label: t(`actions.${value}`),
                  }))}
                />
              </Field>
            </div>
            {newLine.component ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ...(componentOf(newLine.component)?.dimensions ?? []),
                  ...(componentOf(newLine.component)?.values ?? []),
                ].map((column) => (
                  <Field key={column.key} label={column.key} hint={t(`columnTypes.${column.type}`)}>
                    <Input
                      className="font-mono"
                      value={newLine.values[column.key] ?? ""}
                      onChange={(event) =>
                        setNewLine({ ...newLine, values: { ...newLine.values, [column.key]: event.target.value } })
                      }
                    />
                  </Field>
                ))}
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                {t("cancel")}
              </Button>
              <Button
                size="sm"
                iconStart="save"
                disabled={!newLine.component}
                loading={saveLines.isPending}
                onClick={() =>
                  saveLines.mutate([
                    ...lineInputs(item.lines),
                    {
                      component: newLine.component as Schemas["PriceComponent"],
                      action: newLine.action,
                      values: newLine.values,
                    },
                  ])
                }
              >
                {t("saveLine")}
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <ConfirmAction
        open={confirming !== null}
        onOpenChange={(open) => (open ? undefined : setConfirming(null))}
        title={confirming === "withdraw" ? t("withdrawTitle") : t("submitTitle")}
        description={t(confirming === "withdraw" ? "withdrawBody" : "submitBody", {
          factory: item.factoryCode,
          type: labelOf(item.productTypeCode),
          count: item.lines.length,
        })}
        confirmLabel={confirming === "withdraw" ? t("withdraw") : t("submit")}
        tone={confirming === "withdraw" ? "destructive" : "primary"}
        reason={confirming === "withdraw" ? { label: t("reason"), required: true, minLength: 3 } : undefined}
        onConfirm={async ({ reason }) => {
          try {
            const api = adminBrowserApis().contract;
            const updated =
              confirming === "withdraw"
                ? (
                    await api.POST("/v1/admin/price-proposals/{proposalId}/actions/withdraw", {
                      params: { path: { proposalId } },
                      body: { reason },
                    })
                  ).data!
                : (
                    await api.POST("/v1/admin/price-proposals/{proposalId}/actions/submit", {
                      params: { path: { proposalId }, header: { "Idempotency-Key": submitKey } },
                    })
                  ).data!;
            settle(updated);
            toast.success(confirming === "withdraw" ? t("withdrawn") : t("submitted"));
          } catch (error) {
            toast.error(problemMessage(error, t("actionFailed")));
            throw error;
          }
        }}
      />
    </div>
  );
}

/** One line of why a value is suggested, from the basis the API sent — never a peer's identity. */
function basisText(basis: Record<string, unknown>, t: ReturnType<typeof useTranslations>): string {
  const index = basis.index as
    { series?: string; then?: { period: string; value: string }; now?: { period: string; value: string } } | undefined;
  if (index?.series && index.then && index.now) {
    return t("basis.index", {
      series: index.series,
      from: index.then.period,
      to: index.now.period,
      then: index.then.value,
      now: index.now.value,
    });
  }
  const peers = basis.peers as { count?: number; median?: string } | undefined;
  if (peers?.count) return t("basis.peers", { count: peers.count, median: peers.median ?? "–" });
  const driver = basis.driver as { series?: string } | undefined;
  if (driver?.series) return t("basis.driver", { series: driver.series });
  return t("basis.none");
}
