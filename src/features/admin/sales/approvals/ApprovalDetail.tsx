"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import {
  SALES_AUTHORITY_LEVEL,
  SALES_DISCOUNT_APPROVAL_STATUS,
  SALES_NEGOTIATION_OUTCOME,
  SALES_PRICE_LOCK_STATUS,
} from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { newIdempotencyKey } from "@/features/shared/sales/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { PageHeader } from "@/ui/components/PageHeader";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { toast } from "@/ui/components/Toast";
import { cn } from "@/ui/lib/cn";

import {
  adminBrowserApis,
  download,
  problemMessage,
  QueryError,
  StatusChip,
  useActor,
  useCan,
  useSlaFormat,
} from "../../console";
import { DetailSkeleton } from "../../console/DetailSkeleton";
import { Figure } from "../figure";
import type { Approval, DiscountRound, Waterfall } from "../resources";
import { WaterfallView, type WaterfallContext } from "./Waterfall";

type OptionKind = Schemas["AgentDiscountOptionKind"];
interface OptionRow {
  kind: OptionKind;
  discountPct: string;
  ratePct: string;
}
type Decision = Schemas["SalesDiscountDecision"];

/** Who may decide an approval at its level (D-470): the UI hides what the API would refuse; the API decides. */
function mayDecideLevel(roles: readonly string[], level: Schemas["SalesDiscountApprovalLevel"]): boolean {
  if (roles.includes("superadmin") || roles.includes("c_level")) return true;
  if (level === "sales_manager") return roles.includes("sales_manager");
  if (level === "rep") return roles.includes("sales_manager") || roles.includes("sales_rep");
  return false;
}

/**
 * One discount approval (D-470): who asks what for which quote, what the customer gives back, the competitor's
 * evidence side by side with ours, the waterfall in the caller's tier with the viewer's name over it, the simulator,
 * the options builder (the full-rate standard option first and fixed), the negotiation history, and the decision —
 * approve with options, counter with what to ask instead, or reject — sent once with an `Idempotency-Key`.
 */
export function ApprovalDetail({ approvalId }: { approvalId: string }) {
  const t = useTranslations("sales.approval");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const sla = useSlaFormat();
  const actor = useActor();
  const canDecide = useCan("discount_approvals.decide");
  const canExport = useCan("discount_approvals.export");
  const canReports = useCan("sales_reports.read");
  const pipeline =
    actor.permissions.includes("sales.pipeline.manage") || actor.permissions.includes("sales.pipeline.self");
  const client = useQueryClient();
  const [view, setView] = useState<string>("request");

  const query = useQuery({
    queryKey: queryKeys.detail("admin", "sales_discount_approval", approvalId),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/sales/discount-approvals/{approvalId}", {
          params: { path: { approvalId } },
        })
      ).data!,
  });
  const a = query.data;
  // The sales quote behind it (deal registration, our spec and price) — readable to whoever works the pipeline.
  const quote = useQuery({
    queryKey: queryKeys.list("admin", "sales_quote", { leadId: a?.lead.id ?? "" }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/sales/quotes", {
          params: { query: { leadId: a!.lead.id, perPage: 50 } },
        })
      ).data!,
    enabled: Boolean(a) && pipeline,
    select: (page) => page.data.find((row) => row.id === a?.agentQuoteId) ?? null,
  });

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  if (!a) return <DetailSkeleton />;
  const r = a.request;
  const pending = a.status === "pending";
  const mine = a.requestedBy.id === actor.id;
  const decidable =
    pending && canDecide && mayDecideLevel(actor.roles, a.level) && (!mine || actor.roles.includes("superadmin"));
  const context: WaterfallContext = {
    viewer: actor.displayName,
    source: { label: a.quote.quoteCode ?? t("quote"), href: `/sales/leads/${a.lead.id}` },
    asOf: new Date(query.dataUpdatedAt).toISOString(),
  };
  const selected =
    view === "request"
      ? a.waterfall
      : (a.optionWaterfalls.find((option) => option.optionId === view)?.waterfall ?? a.waterfall);
  const refresh = () => {
    void query.refetch();
    void client.invalidateQueries({ queryKey: ["admin", "list", "sales_discount_approval"] });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: "/sales/approvals", label: t("back") }}
        title={a.lead.organisationName ?? a.lead.contactName}
        meta={
          <>
            <StatusChip map={SALES_DISCOUNT_APPROVAL_STATUS} value={a.status} size="md" />
            <StatusChip map={SALES_AUTHORITY_LEVEL} value={a.authorityLevel} />
            <span className="text-muted text-sm">{t(`levels.${a.level}`)}</span>
            {pending ? (
              <SlaTimer
                dueAt={a.dueAt}
                state={a.overdue ? "breached" : undefined}
                format={sla}
                absolute={t("dueAt", { at: format.dateTime(a.dueAt) })}
              />
            ) : null}
          </>
        }
        description={t("subtitle", {
          pct: format.percent(a.requestedPct),
          code: a.quote.quoteCode ?? "—",
          round: a.round,
        })}
        actions={canExport ? <ExportButton approvalId={a.id} /> : null}
      />

      <section
        aria-label={t("header")}
        className="border-border bg-surface rounded-card grid gap-x-8 gap-y-4 border p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4"
      >
        <Fact label={t("facts.quote")}>
          <Link href={`/sales/leads/${a.lead.id}`} className="text-link font-medium tabular-nums hover:underline">
            {a.quote.quoteCode ?? "—"}
          </Link>
          <span className="text-muted block text-xs">
            {t("facts.validUntil", { date: format.date(a.quote.validUntil) })}
          </span>
        </Fact>
        <Fact label={t("facts.customer")}>
          <span className="font-medium">{a.lead.contactName}</span>
          {a.lead.organisationName ? <span className="text-muted block text-xs">{a.lead.organisationName}</span> : null}
          {a.negotiationHeavy ? (
            <span className="text-warning-subtle-fg mt-1 block text-xs font-medium">{t("facts.heavy")}</span>
          ) : null}
        </Fact>
        <Fact label={t("facts.agent")}>
          <span className="font-medium">{a.agent.legalName}</span>
          <span className="text-muted block text-xs tabular-nums">
            {a.agent.code} · {t(`kinds.${a.agent.kind}`)}
          </span>
          <span className="text-muted block text-xs">
            {t("facts.requestedBy", { name: a.requestedBy.displayName })}
          </span>
        </Fact>
        <Fact label={t("facts.deal")}>
          {quote.data?.dealRegistration ? (
            <>
              <span className="text-success-subtle-fg font-medium">{t("facts.dealRegistered")}</span>
              <span className="text-muted block text-xs">
                {t("facts.dealUntil", { date: format.date(quote.data.dealRegistration.protectedUntil) })}
              </span>
            </>
          ) : quote.data === null || (!pipeline && !quote.data) ? (
            <span className="text-muted">{pipeline ? t("facts.noDeal") : t("facts.dealHidden")}</span>
          ) : (
            <span className="text-muted">{t("facts.noDeal")}</span>
          )}
        </Fact>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title={t("ask.title")} description={t("ask.reason", { reason: t(`reasons.${r.reason}`) })}>
            {r.reasonNote ? <p className="text-sm whitespace-pre-line">{r.reasonNote}</p> : null}
            <GiveGet round={r} />
          </Panel>

          {r.competitorSpec || r.competitorFile ? <Comparison round={r} quote={quote.data ?? null} /> : null}

          <Panel
            title={t("waterfall.title")}
            description={t(`waterfall.tier.${a.waterfall.visibility}`)}
            action={
              a.optionWaterfalls.length ? (
                <SegmentedControl
                  label={t("waterfall.which")}
                  value={view}
                  onValueChange={setView}
                  options={[
                    { value: "request", label: t("waterfall.request", { pct: format.percent(a.requestedPct) }) },
                    ...a.optionWaterfalls.map((option, at) => ({
                      value: option.optionId,
                      label: t("waterfall.option", { n: at + 1, kind: t(`optionKinds.${option.kind}`) }),
                    })),
                  ]}
                />
              ) : null
            }
          >
            <WaterfallView waterfall={selected} context={context} />
          </Panel>

          {a.priceLocks?.length ? (
            <Panel title={t("locks.title")} description={t("locks.hint")}>
              <ul className="flex flex-col gap-2 text-sm">
                {a.priceLocks.map((lock) => (
                  <li key={lock.id} className="flex flex-wrap items-center justify-between gap-2">
                    <Figure
                      name="buyPrice"
                      source={context.source}
                      asOf={context.asOf}
                      className="font-medium tabular-nums"
                    >
                      {format.thb(lock.buyPrice)}
                    </Figure>
                    <span className="text-muted text-xs">
                      {t("locks.until", { date: format.date(lock.validUntil) })}
                    </span>
                    <StatusChip map={SALES_PRICE_LOCK_STATUS} value={lock.status} />
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Simulator approval={a} context={context} />

          {canReports ? <History leadId={a.lead.id} /> : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-20">
          {decidable ? (
            <DecisionPanel approval={a} onDone={refresh} />
          ) : (
            <section className="border-border bg-surface rounded-card flex flex-col gap-2 border p-4 sm:p-5">
              <h2 className="text-base font-semibold">{pending ? t("decision.waiting") : t("decision.done")}</h2>
              {pending ? (
                <p className="text-muted text-sm">
                  {mine ? t("decision.notYours") : t("decision.byLevel", { level: t(`levels.${a.level}`) })}
                </p>
              ) : (
                <>
                  <p className="text-sm">
                    {tStatus(SALES_DISCOUNT_APPROVAL_STATUS[a.status].labelKey)}
                    {a.decidedBy ? ` · ${a.decidedBy.displayName}` : ""}
                    {a.decidedAt ? ` · ${format.dateTime(a.decidedAt)}` : ""}
                  </p>
                  {a.decisionNote ? <p className="text-muted text-sm whitespace-pre-line">{a.decisionNote}</p> : null}
                  {a.selfApproved ? <Callout tone="warning" title={t("decision.selfApproved")} /> : null}
                  {r.options.length ? (
                    <ul className="flex flex-col gap-1.5 text-sm">
                      {r.options.map((option) => (
                        <li key={option.id} className="flex justify-between gap-2">
                          <span>
                            {t(`optionKinds.${option.kind}`)} · {format.percent(option.discountPct)}
                          </span>
                          <span className="text-muted tabular-nums">
                            {t("decision.rate", { rate: format.percent(option.ratePct) })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-muted text-xs">{label}</p>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-surface rounded-card flex min-w-0 flex-col gap-4 border p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? <p className="text-muted text-sm">{description}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** What the customer gives back (D-468 give-get), in words. */
function GiveGet({ round: r }: { round: DiscountRound }) {
  const t = useTranslations("sales.approval.give");
  const format = useFormat();
  const items = [
    r.quantityChange ? t("quantityChange", { count: format.number(r.quantityChange) }) : null,
    r.commitment === "call_off" ? t("callOff", { months: r.commitmentMonths ?? 0 }) : null,
    r.depositPct ? t("depositPct", { pct: format.percent(r.depositPct) }) : null,
    r.cashWithinDays ? t("cashWithinDays", { days: r.cashWithinDays }) : null,
    r.leadTimeFlexDays ? t("leadTimeFlexDays", { days: r.leadTimeFlexDays }) : null,
    r.specChange ? t("specChange", { change: r.specChange }) : null,
  ].filter(Boolean) as string[];
  return (
    <div>
      <h3 className="text-sm font-semibold">{t("title")}</h3>
      {items.length ? (
        <ul className="mt-1.5 flex flex-wrap gap-2">
          {items.map((item) => (
            <li key={item} className="bg-primary-subtle text-primary-subtle-fg rounded-md px-2.5 py-1 text-sm">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted mt-1 text-sm">{t("none")}</p>
      )}
    </div>
  );
}

/** The competitor's quote beside ours, line for line (PLAN §7 like-for-like): differences are marked in words. */
function Comparison({ round: r, quote }: { round: DiscountRound; quote: Schemas["AgentQuoteDto"] | null }) {
  const t = useTranslations("sales.approval.compare");
  const format = useFormat();
  const c = r.competitorSpec;
  const spec = (key: string) => quote?.quote.summary.specs.find((row) => row.key === key)?.valueTh ?? null;
  const rows: { key: string; ours: string | null; theirs: string | null }[] = [
    { key: "quantity", ours: format.number(r.quantity), theirs: c?.quantity ? format.number(c.quantity) : null },
    { key: "board", ours: spec("material"), theirs: c?.boardGrade ?? null },
    { key: "flute", ours: spec("flute"), theirs: c?.flute ?? null },
    {
      key: "print",
      ours: spec("print") ?? spec("printing"),
      theirs: c?.printColours ? t("colours", { colours: c.printColours, sides: c.printSides ?? 1 }) : null,
    },
    { key: "finish", ours: spec("finish") ?? spec("coating"), theirs: c?.finish ?? null },
    {
      key: "leadTime",
      ours: quote?.quote.options[0]?.leadTimeDays ? t("days", { days: quote.quote.options[0].leadTimeDays }) : null,
      theirs: c?.leadTimeDays ? t("days", { days: c.leadTimeDays }) : null,
    },
    {
      key: "price",
      ours: quote?.quote.options[0] ? t("priceExVat", { amount: format.thb(quote.quote.options[0].netAmount) }) : null,
      theirs: c?.price
        ? c.vatIncluded
          ? t("priceIncVat", { amount: format.thb(c.price) })
          : t("priceExVat", { amount: format.thb(c.price) })
        : null,
    },
    {
      key: "shipping",
      ours: t("shippingIncluded"),
      theirs: c ? (c.shippingIncluded ? t("shippingIncluded") : t("shippingExtra")) : null,
    },
  ];
  return (
    <Panel title={t("title")} description={t("hint")}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <caption className="sr-only">{t("title")}</caption>
          <thead className="text-muted text-xs">
            <tr className="border-border border-b">
              <th scope="col" className="w-36 py-2 pe-3 text-start font-medium">
                <span className="sr-only">{t("line")}</span>
              </th>
              <th scope="col" className="py-2 pe-3 text-start font-medium">
                {t("ours")}
              </th>
              <th scope="col" className="py-2 text-start font-medium">
                {t("theirs")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const differs = row.ours && row.theirs && row.ours !== row.theirs && row.key !== "price";
              return (
                <tr key={row.key} className="border-border border-b last:border-0">
                  <th scope="row" className="text-muted py-2 pe-3 text-start font-normal">
                    {t(`lines.${row.key}`)}
                  </th>
                  <td className="py-2 pe-3">{row.ours ?? <span className="text-muted">{t("unknown")}</span>}</td>
                  <td className={cn("py-2", differs && "font-medium")}>
                    {row.theirs ?? <span className="text-muted">{t("notGiven")}</span>}
                    {differs ? <span className="text-warning-subtle-fg ms-2 text-xs">{t("differs")}</span> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {r.competitorFile ? (
        <p className="text-sm">
          {t("evidence")} <span className="text-muted">{r.competitorFile.fileName}</span>
        </p>
      ) : null}
      {c?.notes ? <p className="text-muted text-sm whitespace-pre-line">{c.notes}</p> : null}
    </Panel>
  );
}

function ExportButton({ approvalId }: { approvalId: string }) {
  const t = useTranslations("sales.approval");
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      iconStart="download"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const file = (
            await adminBrowserApis().contract.GET("/v1/admin/sales/discount-approvals/{approvalId}/export", {
              params: { path: { approvalId } },
            })
          ).data!;
          download(file.url);
        } catch (error) {
          toast.error(problemMessage(error, t("exportFailed")));
        } finally {
          setBusy(false);
        }
      }}
    >
      {t("export")}
    </Button>
  );
}

/**
 * The simulator (D-470): change the discount, credit days, payment schedule, deposit or the co-fund / spiff rate and
 * the API works the waterfall out again in the caller's tier (debounced; nothing is saved, the view is logged). The
 * web only sends what was typed.
 */
function Simulator({ approval: a, context }: { approval: Approval; context: WaterfallContext }) {
  const t = useTranslations("sales.simulator");
  const canTemplates = useCan("orders.read");
  const [input, setInput] = useState({
    discountPct: a.requestedPct,
    creditDays: "",
    paymentTemplateKey: "",
    depositPct: a.request.depositPct ?? "",
    ratePct: "",
  });
  const [debounced, setDebounced] = useState(input);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(input), 400);
    return () => clearTimeout(timer);
  }, [input]);
  const templates = useQuery({
    queryKey: queryKeys.list("admin", "payment_schedule_template", {}),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/payment-schedule-templates")).data!,
    enabled: canTemplates,
    staleTime: 5 * 60_000,
  });
  const valid = /^\d+(\.\d{1,2})?$/.test(debounced.discountPct) && Number(debounced.discountPct) <= 50;
  const result = useQuery({
    queryKey: ["admin", "sales_simulation", a.id, debounced],
    enabled: valid,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/sales/discount-approvals/{approvalId}/actions/simulate", {
          params: { path: { approvalId: a.id } },
          body: {
            discountPct: debounced.discountPct,
            ...(debounced.creditDays.trim() ? { creditDays: Number(debounced.creditDays) } : {}),
            ...(debounced.paymentTemplateKey ? { paymentTemplateKey: debounced.paymentTemplateKey } : {}),
            ...(debounced.depositPct.trim() ? { depositPct: debounced.depositPct.trim() } : {}),
            ...(debounced.ratePct.trim() ? { ratePct: debounced.ratePct.trim() } : {}),
          },
        })
      ).data!,
    placeholderData: (previous) => previous,
  });
  const set = (key: keyof typeof input) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setInput((current) => ({ ...current, [key]: event.target.value.replace(/[^0-9.]/g, "") }));
  return (
    <section
      aria-labelledby="simulator-heading"
      className="border-border bg-surface rounded-card flex flex-col gap-4 border p-4 sm:p-5"
    >
      <header>
        <h2 id="simulator-heading" className="text-base font-semibold">
          {t("title")}
        </h2>
        <p className="text-muted text-sm">{t("hint")}</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label={t("discountPct")} error={valid ? undefined : t("discountInvalid")}>
          <Input value={input.discountPct} onChange={set("discountPct")} inputMode="decimal" />
        </Field>
        <Field label={t("creditDays")} hint={t("creditDaysHint")}>
          <Input value={input.creditDays} onChange={set("creditDays")} inputMode="numeric" />
        </Field>
        {canTemplates ? (
          <Field label={t("template")}>
            <NativeSelect
              value={input.paymentTemplateKey}
              onValueChange={(value) => setInput((current) => ({ ...current, paymentTemplateKey: value }))}
              options={[
                { value: "", label: t("templateNone") },
                ...(templates.data ?? []).map((template) => ({ value: template.key, label: template.nameTh })),
              ]}
            />
          </Field>
        ) : null}
        <Field label={t("depositPct")}>
          <Input value={input.depositPct} onChange={set("depositPct")} inputMode="decimal" />
        </Field>
        <Field label={t("ratePct")} hint={t("ratePctHint")}>
          <Input value={input.ratePct} onChange={set("ratePct")} inputMode="decimal" />
        </Field>
      </div>
      <div aria-live="polite" className={cn("transition-opacity", result.isFetching && "opacity-60")}>
        {result.isError ? (
          <Callout tone="danger" title={problemMessage(result.error, t("failed"))} />
        ) : result.data ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              {t("level")} <strong>{t(`levels.${result.data.level}`)}</strong>
            </p>
            <WaterfallView waterfall={result.data.waterfall as Waterfall} context={context} compact />
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** The negotiation history of the customer behind the lead (D-470 §7): rounds per quote, outcomes, the flag. */
function History({ leadId }: { leadId: string }) {
  const t = useTranslations("sales.history");
  const tLost = useTranslations("agentSales.lead.lostReasons");
  const format = useFormat();
  const history = useQuery({
    queryKey: ["admin", "sales_negotiation_history", leadId],
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/sales/negotiations/history", { params: { query: { leadId } } }))
        .data!,
  });
  return (
    <section
      aria-labelledby="history-heading"
      className="border-border bg-surface rounded-card flex flex-col gap-3 border p-4 sm:p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="history-heading" className="text-base font-semibold">
            {t("title")}
          </h2>
          {history.data ? (
            <p className="text-muted text-sm">
              {t("rule", {
                rounds: history.data.minRounds,
                quotes: history.data.minQuotes,
                last: history.data.lastQuotes,
              })}
            </p>
          ) : null}
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link href={`/sales/reports/negotiations?leadId=${leadId}`}>{t("open")}</Link>
        </Button>
      </header>
      {history.data ? (
        <HistoryBody history={history.data} tLost={tLost} format={format} />
      ) : (
        <div className="bg-surface-subtle h-24 animate-pulse rounded-md motion-reduce:animate-none" />
      )}
    </section>
  );
}

export function HistoryBody({
  history: h,
  tLost,
  format,
}: {
  history: Schemas["NegotiationHistoryDto"];
  tLost: (key: string) => string;
  format: ReturnType<typeof useFormat>;
}) {
  const t = useTranslations("sales.history");
  return (
    <div className="flex flex-col gap-3">
      {h.negotiationHeavy ? (
        <Callout tone="warning" title={t("heavy")}>
          {t("heavyHint")}
        </Callout>
      ) : null}
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-muted text-xs">{t("average")}</dt>
          <dd className="font-semibold">
            <Figure name="averageApprovedDiscount">
              {h.averageApprovedDiscountPct ? format.percent(h.averageApprovedDiscountPct) : "—"}
            </Figure>
          </dd>
        </div>
        <div>
          <dt className="text-muted text-xs">{t("won")}</dt>
          <dd className="font-semibold">
            <Figure name="won">{format.number(h.won)}</Figure>
          </dd>
        </div>
        <div>
          <dt className="text-muted text-xs">{t("lost")}</dt>
          <dd className="font-semibold">
            <Figure name="lost">{format.number(h.lost)}</Figure>
          </dd>
        </div>
      </dl>
      <ul className="divide-border flex flex-col divide-y text-sm">
        {h.quotes.map((quote) => (
          <li key={quote.agentQuoteId} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="tabular-nums">{quote.quoteCode ?? "—"}</span>
            <span className="text-muted text-xs">{format.date(quote.sentAt, { style: "dayMonth" })}</span>
            <Figure name="rounds" className="text-xs">
              {t("rounds", { count: quote.rounds })}
            </Figure>
            <span className="text-xs">
              {quote.acceptedDiscountPct ? t("accepted", { pct: format.percent(quote.acceptedDiscountPct) }) : "—"}
            </span>
            <StatusChip map={SALES_NEGOTIATION_OUTCOME} value={quote.outcome} />
          </li>
        ))}
      </ul>
      {h.lostReasons.some((row) => row.count > 0) ? (
        <p className="text-muted text-sm">
          {t("lostReasons")}{" "}
          {h.lostReasons
            .filter((row) => row.count > 0)
            .map((row) => `${tLost(row.reason)} ${format.number(row.count)}`)
            .join(" · ")}
        </p>
      ) : null}
      {h.lastCompetitor ? (
        <p className="text-sm">
          {t("lastCompetitor", { date: format.date(h.lastCompetitor.namedAt) })}{" "}
          {h.lastCompetitor.price ? (
            <strong className="tabular-nums">{format.thb(h.lastCompetitor.price)}</strong>
          ) : null}
          {h.lastCompetitor.notes ? <span className="text-muted"> · {h.lastCompetitor.notes}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The decision (D-470): approve with 1–3 options — the first is the full-rate standard option, pre-filled with the
 * asked percentage and never removable; up to two co-fund / spiff rows — or counter / reject with a note. One
 * `Idempotency-Key` per decision: made when the dialog opens, reused on a retry of the same decision.
 */
function DecisionPanel({ approval: a, onDone }: { approval: Approval; onDone: () => void }) {
  const t = useTranslations("sales.decision");
  const actor = useActor();
  const [options, setOptions] = useState<OptionRow[]>([{ kind: "standard", discountPct: a.requestedPct, ratePct: "" }]);
  const [deciding, setDeciding] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [counter, setCounter] = useState("");
  const [selfReason, setSelfReason] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const self = a.requestedBy.id === actor.id;
  const open = (decision: Decision) => {
    setDeciding(decision);
    setKey(newIdempotencyKey());
    setError(null);
  };
  const update = (at: number, patch: Partial<OptionRow>) =>
    setOptions((current) => current.map((row, index) => (index === at ? { ...row, ...patch } : row)));

  const submit = async () => {
    if (!deciding) return;
    if ((deciding === "reject" || deciding === "counter") && !note.trim()) return setError(t("noteRequired"));
    if (self && selfReason.trim().length < 10) return setError(t("selfReasonRequired"));
    if (
      deciding === "approve" &&
      options.some(
        (row) =>
          !/^\d+(\.\d{1,2})?$/.test(row.discountPct) ||
          (row.kind !== "standard" && !/^\d+(\.\d{1,2})?$/.test(row.ratePct)),
      )
    )
      return setError(t("optionsInvalid"));
    setBusy(true);
    setError(null);
    try {
      await adminBrowserApis().contract.POST("/v1/admin/sales/discount-approvals/{approvalId}/actions/decide", {
        params: { path: { approvalId: a.id }, header: { "Idempotency-Key": key } },
        body: {
          decision: deciding,
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(deciding === "approve"
            ? {
                options: options.map((row) => ({
                  kind: row.kind,
                  discountPct: row.discountPct,
                  ...(row.kind === "standard" ? {} : { ratePct: row.ratePct }),
                })),
              }
            : {}),
          ...(deciding === "counter" && counter.trim() ? { counter: { ask: counter.trim() } } : {}),
          ...(self ? { selfApprovalReason: selfReason.trim() } : {}),
        },
      });
      toast.success(t(`done.${deciding}`));
      setDeciding(null);
      onDone();
    } catch (failure) {
      setError(problemMessage(failure, t("failed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="bg-primary-subtle rounded-card flex flex-col gap-4 p-4 sm:p-5"
      aria-labelledby="decision-heading"
    >
      <header>
        <h2 id="decision-heading" className="text-base font-semibold">
          {t("title")}
        </h2>
        <p className="text-muted text-sm">{t("hint")}</p>
      </header>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">{t("options")}</legend>
        {options.map((row, at) => (
          <div
            key={at}
            className="border-border bg-surface flex flex-col gap-2 rounded-lg border p-3"
            data-option={row.kind}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{t("optionN", { n: at + 1 })}</span>
              {at === 0 ? (
                <span className="text-muted text-xs">{t("standardFixed")}</span>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  iconStart="trash"
                  onClick={() => setOptions((current) => current.filter((_, index) => index !== at))}
                >
                  {t("remove")}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {at === 0 ? (
                <Field label={t("kind")}>
                  <Input value={t("kinds.standard")} readOnly aria-readonly />
                </Field>
              ) : (
                <Field label={t("kind")}>
                  <NativeSelect
                    value={row.kind}
                    onValueChange={(value) => update(at, { kind: value as OptionKind })}
                    options={(["co_fund", "spiff"] as const).map((value) => ({ value, label: t(`kinds.${value}`) }))}
                  />
                </Field>
              )}
              <Field label={t("discountPct")}>
                <Input
                  value={row.discountPct}
                  onChange={(event) => update(at, { discountPct: event.target.value.replace(/[^0-9.]/g, "") })}
                  inputMode="decimal"
                />
              </Field>
            </div>
            {at === 0 ? (
              <p className="text-muted text-xs">{t("standardRate")}</p>
            ) : (
              <Field label={t("ratePct")} hint={t(`rateHint.${row.kind}`)}>
                <Input
                  value={row.ratePct}
                  onChange={(event) => update(at, { ratePct: event.target.value.replace(/[^0-9.]/g, "") })}
                  inputMode="decimal"
                />
              </Field>
            )}
          </div>
        ))}
        {options.length < 3 ? (
          <Button
            variant="secondary"
            iconStart="plus"
            onClick={() =>
              setOptions((current) => [...current, { kind: "co_fund", discountPct: a.requestedPct, ratePct: "" }])
            }
          >
            {t("addOption")}
          </Button>
        ) : null}
      </fieldset>
      <div className="flex flex-col gap-2">
        <Button iconStart="check" onClick={() => open("approve")}>
          {t("approve")}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" iconStart="undo" onClick={() => open("counter")}>
            {t("counter")}
          </Button>
          <Button variant="ghost" className="text-danger" iconStart="ban" onClick={() => open("reject")}>
            {t("reject")}
          </Button>
        </div>
      </div>
      <Dialog
        open={deciding !== null}
        onOpenChange={(next) => (next || busy ? undefined : setDeciding(null))}
        closeLabel={t("cancel")}
        title={deciding ? t(`confirm.${deciding}.title`) : ""}
        description={deciding ? t(`confirm.${deciding}.body`, { count: options.length }) : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeciding(null)} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button
              variant={deciding === "reject" ? "destructive" : "primary"}
              loading={busy}
              onClick={() => void submit()}
            >
              {deciding ? t(deciding) : ""}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {error ? <Callout tone="danger" title={error} /> : null}
          {deciding === "counter" ? (
            <Field label={t("counterAsk")} hint={t("counterAskHint")}>
              <Textarea value={counter} onChange={(event) => setCounter(event.target.value)} rows={2} />
            </Field>
          ) : null}
          <Field label={deciding === "approve" ? t("noteOptional") : t("note")} required={deciding !== "approve"}>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
          </Field>
          {self ? (
            <Field label={t("selfReason")} hint={t("selfReasonHint")} required>
              <Textarea value={selfReason} onChange={(event) => setSelfReason(event.target.value)} rows={2} />
            </Field>
          ) : null}
        </div>
      </Dialog>
    </section>
  );
}
