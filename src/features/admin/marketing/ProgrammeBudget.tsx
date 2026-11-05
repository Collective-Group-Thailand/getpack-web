"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { ProgrammeBudget } from "@/lib/api/requests/admin-loyalty-p4";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input, Textarea } from "@/ui/components/Input";
import { Meter } from "@/ui/components/Meter";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis, QueryError, useCan } from "../console";
import { useP4Problem } from "./p4-problems";

export const BUDGET_PAGE = "/marketing/loyalty/budget";
const budgetKey = (month?: string) => queryKeys.list("admin", "programme_budget", { month: month ?? "current" });

/** This Bangkok month and the eleven before it, newest first (`YYYY-MM`). */
export function budgetMonths(now: Date, count = 12): string[] {
  const bangkok = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return Array.from({ length: count }, (_, back) => {
    const date = new Date(Date.UTC(bangkok.getUTCFullYear(), bangkok.getUTCMonth() - back, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

const card = "border-border bg-surface rounded-panel border";

/**
 * `/marketing/loyalty/budget` (loyalty P4, D-507; prototype `p4-admin-budget.html`): the month's programme budget —
 * used of budget with a plain meter and the first alert as a tick, the spend by part (the factory's share as a
 * negative line), what the state means, the alerts fired, the month's budget, a pending override and "ขอเพิ่มงบเดือนนี้"
 * (Finance Manager, then C-Level). Every figure is the API's; the web adds nothing.
 */
export function ProgrammeBudgetPage() {
  const t = useTranslations("marketing.programmeBudget");
  const format = useFormat();
  const [now] = useState(() => new Date());
  const months = budgetMonths(now);
  const [month, setMonth] = useState(months[0]!);
  const query = useQuery({
    queryKey: budgetKey(month),
    queryFn: async () =>
      adminBrowserApis().requests.call("GET /v1/admin/loyalty/programme-budget", { query: { month } }),
    staleTime: 60_000,
  });
  const data = query.data;
  const current = month === months[0];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field label={t("month")} className="w-48">
          <NativeSelect
            value={month}
            onValueChange={setMonth}
            options={months.map((value) => ({
              value,
              label: format.date(`${value}-01T00:00:00+07:00`, { style: "month" }),
            }))}
          />
        </Field>
        {data ? (
          <p className="text-muted text-sm tabular-nums">{t("asOf", { at: format.dateTime(data.asOf) })}</p>
        ) : null}
      </div>
      {query.isError ? <QueryError error={query.error} onRetry={() => void query.refetch()} /> : null}
      {query.isPending ? <Skeleton className="h-72 w-full" /> : null}
      {data ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_23.5rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <BudgetUse data={data} />
            <Alerts data={data} />
          </div>
          <aside className="flex min-w-0 flex-col gap-4">
            <BudgetFacts data={data} />
            {current && data.pendingOverride ? <PendingOverride data={data} /> : null}
            {current ? <OverrideForm data={data} /> : null}
          </aside>
        </div>
      ) : null}
    </div>
  );
}

/** The figure, the meter and the breakdown — the page's main card (and the story's). */
export function BudgetUse({ data }: { data: ProgrammeBudget }) {
  const t = useTranslations("marketing.programmeBudget");
  const format = useFormat();
  const exhausted = data.state === "exhausted";
  const first = data.alertPcts.find((pct) => pct < 100);
  const valueText = t("valueText", {
    spent: format.thb(data.spent.total),
    budget: format.thb(data.budget.effective),
    pct: format.percent(data.usedPct),
  });
  const parts: { key: string; label: string; hint?: string; amount: string; minus?: boolean }[] = [
    { key: "points", label: t("parts.points"), hint: t("parts.pointsHint"), amount: data.spent.points },
    { key: "discounts", label: t("parts.discounts"), hint: t("parts.discountsHint"), amount: data.spent.discounts },
    { key: "tierPerks", label: t("parts.tierPerks"), amount: data.spent.tierPerks },
    { key: "factoryShare", label: t("parts.factoryShare"), amount: data.spent.factoryShare, minus: true },
  ];
  return (
    <section aria-labelledby="budget-use" className={card}>
      <div className="p-5">
        <h2 id="budget-use" className="sr-only">
          {t("used")}
        </h2>
        <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="text-[1.75rem] leading-tight font-semibold tracking-tight tabular-nums sm:text-[2rem]">
            {format.thb(data.spent.total)}
          </span>
          <span className="text-muted tabular-nums">{t("of", { budget: format.thb(data.budget.effective) })}</span>
          <span className={cn("ms-auto font-semibold tabular-nums", exhausted && "text-danger")}>
            {format.percent(data.usedPct)}
          </span>
        </p>
        <Meter
          className="mt-3"
          value={Number(data.usedPct)}
          label={t("used")}
          valueText={valueText}
          tone={exhausted ? "danger" : "primary"}
          marker={first}
        />
        <p className="mt-4 flex items-start gap-2 text-sm">
          {data.state === "warning" ? (
            <Badge size="sm" tone="accent" className="tabular-nums">
              {format.percent(String(first ?? 80), 0)}
            </Badge>
          ) : exhausted ? (
            <Icon name="pause" size={16} aria-hidden="true" className="text-danger mt-0.5 shrink-0" />
          ) : null}
          <span>{t(`state.${data.state}`)}</span>
        </p>
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">{t("partsTitle")}</caption>
        <tbody>
          {parts.map((part) => (
            <tr key={part.key} className="border-border border-t">
              <th scope="row" className="px-5 py-2.5 text-start font-normal">
                {part.label}
                {part.hint ? <span className="text-muted block text-xs">{part.hint}</span> : null}
              </th>
              <td
                className={cn(
                  "px-5 py-2.5 text-end whitespace-nowrap tabular-nums",
                  part.minus && "text-success-subtle-fg",
                )}
              >
                {part.minus ? t("minus", { amount: format.thb(part.amount) }) : format.thb(part.amount)}
              </td>
            </tr>
          ))}
          <tr className="border-border-strong border-t font-semibold">
            <th scope="row" className="px-5 py-2.5 text-start">
              {t("parts.total")}
            </th>
            <td className="px-5 py-2.5 text-end tabular-nums">{format.thb(data.spent.total)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function Alerts({ data }: { data: ProgrammeBudget }) {
  const t = useTranslations("marketing.programmeBudget");
  const format = useFormat();
  return (
    <section aria-labelledby="budget-alerts" className={cn(card, "p-5")}>
      <h2 id="budget-alerts" className="font-semibold">
        {t("alerts.title")}
      </h2>
      <p className="text-muted text-sm">{t("alerts.note")}</p>
      {data.alerts.length === 0 ? (
        <p className="text-muted mt-3 text-sm">{t("alerts.none")}</p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {data.alerts.map((alert) => (
            <li
              key={`${alert.thresholdPct}-${alert.firedAt}`}
              className="border-border flex flex-wrap items-center justify-between gap-2 border-t py-2.5 text-sm"
            >
              <span className="flex items-center gap-2">
                <Badge size="sm" tone={alert.thresholdPct >= 100 ? "danger" : "accent"} className="tabular-nums">
                  {format.percent(String(alert.thresholdPct), 0)}
                </Badge>
                <span className="tabular-nums">{format.dateTime(alert.firedAt)}</span>
              </span>
              <span className="text-muted tabular-nums">
                {t("alerts.spent", { spent: format.thb(alert.spent), budget: format.thb(alert.budget) })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BudgetFacts({ data }: { data: ProgrammeBudget }) {
  const t = useTranslations("marketing.programmeBudget");
  const format = useFormat();
  return (
    <section aria-labelledby="budget-facts" className={cn(card, "p-5")}>
      <h2 id="budget-facts" className="font-semibold">
        {t("facts.title")}
      </h2>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-muted">{t("facts.monthly")}</dt>
        <dd className="text-end tabular-nums">{format.thb(data.budget.monthlyBaht)}</dd>
        {data.budget.override ? (
          <>
            <dt className="text-muted">{t("facts.override")}</dt>
            <dd className="text-end tabular-nums">{format.thb(data.budget.override)}</dd>
          </>
        ) : null}
        <dt className="text-muted">{t("facts.effective")}</dt>
        <dd className="text-end font-semibold tabular-nums">{format.thb(data.budget.effective)}</dd>
        <dt className="text-muted">{t("facts.alertsAt")}</dt>
        <dd className="text-end tabular-nums">
          {data.alertPcts.map((pct) => format.percent(String(pct), 0)).join(" · ")}
        </dd>
      </dl>
    </section>
  );
}

function PendingOverride({ data }: { data: ProgrammeBudget }) {
  const t = useTranslations("marketing.programmeBudget.pending");
  const format = useFormat();
  const pending = data.pendingOverride!;
  return (
    <section aria-labelledby="budget-pending" className={cn(card, "border-s-primary border-s-[3px] p-5")}>
      <h2 id="budget-pending" className="font-semibold">
        {t("title")}
      </h2>
      <p className="text-muted mt-1 text-sm tabular-nums">
        {t("body", {
          amount: format.thb(pending.amount),
          name: pending.requestedBy.displayName,
          at: format.dateTime(pending.requestedAt),
        })}
      </p>
      <p className="text-muted mt-1 text-sm">{t("steps")}</p>
      <Link
        href={`/approvals/${pending.approvalId}`}
        className="text-primary mt-2 inline-block text-sm font-medium hover:underline"
      >
        {t("open")}
      </Link>
    </section>
  );
}

function OverrideForm({ data }: { data: ProgrammeBudget }) {
  const t = useTranslations("marketing.programmeBudget.override");
  const p4Message = useP4Problem();
  const format = useFormat();
  const queryClient = useQueryClient();
  const canRequest = useCan("loyalty.programme.manage");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  if (!canRequest) return null;
  const pending = Boolean(data.pendingOverride);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const number = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(number) || number <= Number(data.budget.effective)) return setError(t("mustRaise"));
    if (reason.trim().length < 10) return setError(t("needReason"));
    setError(null);
    setBusy(true);
    try {
      await adminBrowserApis().requests.call("POST /v1/admin/loyalty/programme-budget/overrides", {
        idempotencyKey: key,
        body: { month: data.month, amount: number.toFixed(2), reason: reason.trim() },
      });
      toast.success(t("done"));
      setAmount("");
      setReason("");
      setKey(crypto.randomUUID());
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "programme_budget") });
    } catch (failure) {
      setError(p4Message(failure, t("failed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void submit(event)}
      aria-labelledby="budget-override"
      className={cn(card, "flex flex-col gap-3 p-5")}
    >
      <div>
        <h2 id="budget-override" className="font-semibold">
          {t("title")}
        </h2>
        <p className="text-muted text-sm">{t("body")}</p>
      </div>
      <Field label={t("amount")} required hint={t("current", { amount: format.thb(data.budget.effective) })}>
        <Input
          inputMode="decimal"
          value={amount}
          disabled={pending}
          onChange={(event) => setAmount(event.target.value)}
        />
      </Field>
      <Field label={t("reason")} required hint={t("reasonHint")}>
        <Textarea rows={2} value={reason} disabled={pending} onChange={(event) => setReason(event.target.value)} />
      </Field>
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={busy} disabled={pending}>
        {pending ? t("pending") : t("submit")}
      </Button>
    </form>
  );
}

const DISMISS_KEY = "getpack.admin.budgetBanner";

/**
 * The admin shell's budget line (loyalty P4, D-507), for users with `loyalty.read`: from the first alert, a neutral
 * banner with the small amber threshold badge; at 100 % the danger-toned sentence that new activations wait until the
 * month ends (no amber fill). Dismissible for the session, per month and state.
 */
export function BudgetBanner() {
  const canRead = useCan("loyalty.read");
  const query = useQuery({
    queryKey: budgetKey(),
    enabled: canRead,
    retry: false,
    staleTime: 5 * 60_000,
    queryFn: async () => adminBrowserApis().requests.call("GET /v1/admin/loyalty/programme-budget"),
  });
  const [dismissed, setDismissed] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.sessionStorage.getItem(DISMISS_KEY),
  );
  const data = query.data;
  if (!canRead || !data || data.state === "ok") return null;
  const stamp = `${data.month}:${data.state}`;
  if (dismissed === stamp) return null;
  return (
    <BudgetBannerView
      data={data}
      onDismiss={() => {
        window.sessionStorage.setItem(DISMISS_KEY, stamp);
        setDismissed(stamp);
      }}
    />
  );
}

export function BudgetBannerView({ data, onDismiss }: { data: ProgrammeBudget; onDismiss?: () => void }) {
  const t = useTranslations("marketing.programmeBudget.banner");
  const format = useFormat();
  const exhausted = data.state === "exhausted";
  const first = data.alertPcts.find((pct) => pct < 100) ?? 80;
  return (
    <div
      role="status"
      className="border-border bg-surface rounded-card mb-4 flex items-center gap-3 border px-3.5 py-2.5 text-sm"
    >
      {exhausted ? (
        <Icon name="pause" size={16} aria-hidden="true" className="text-danger shrink-0" />
      ) : (
        <Badge size="sm" tone="accent" className="shrink-0 tabular-nums">
          {format.percent(String(first), 0)}
        </Badge>
      )}
      <span className={cn("min-w-0 flex-1", exhausted && "text-danger font-medium")}>
        {exhausted ? t("exhausted") : t("warning", { pct: format.percent(data.usedPct, 0) })}
      </span>
      <Link href={BUDGET_PAGE} className="text-primary shrink-0 font-medium underline underline-offset-4">
        {t("open")}
      </Link>
      {onDismiss ? <IconButton name="close" size="sm" label={t("dismiss")} onClick={onDismiss} /> : null}
    </div>
  );
}
