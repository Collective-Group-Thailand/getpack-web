"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { formatTHB } from "@/i18n/format";
import { trackBusiness } from "@/lib/analytics/business";
import { Slider } from "@/ui/components/Slider";
import { Switch } from "@/ui/components/Switch";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import type { SampleOrder } from "./samples.server";
import { overThreshold } from "./rules";

/** The visitor's own setting, not a business value: the range and start of the demo slider. */
const MAX = 100_000;
const STEP = 5_000;
const START = 20_000;

interface Step {
  key: string;
  icon: IconName;
  title: string;
  body: string;
  tag: string;
  tone: "neutral" | "warning" | "success";
  skipped?: boolean;
}

/**
 * "ใครต้องอนุมัติ ตั้งได้ตามวงเงิน" (business pack Phase 1 item 3): the visitor sets the approval amount and picks
 * one of the sample orders — real products priced by the pricing service (`samples.server.ts`) — and toggles PO
 * and credit; the flow ผู้สั่งซื้อ → ผู้อนุมัติ (required / automatic) → ฝ่ายบัญชี → ผลิต follows. Client-side only;
 * the order amount is the API's string, compared, never added to.
 */
export function ApprovalSimulator({ orders }: { orders: SampleOrder[] }) {
  const t = useTranslations("business.landing.sim");
  const format = useFormat();
  const [threshold, setThreshold] = useState(START);
  const [picked, setPicked] = useState(orders[Math.min(1, orders.length - 1)]?.key ?? "");
  const [po, setPo] = useState(true);
  const [credit, setCredit] = useState(true);
  const order = orders.find((candidate) => candidate.key === picked) ?? orders[0] ?? null;
  const thresholdText =
    threshold === 0 ? t("thresholdAll") : formatTHB(String(threshold), format.locale, { decimals: 0 });
  const reported = useRef(false);

  // One event per settled threshold (not per pixel of the drag).
  useEffect(() => {
    if (!reported.current) {
      reported.current = true;
      return;
    }
    const timer = window.setTimeout(() => trackBusiness("biz_sim_change", { threshold }), 600);
    return () => window.clearTimeout(timer);
  }, [threshold]);

  const amount = order ? format.thb(order.amount) : "";
  const needsApproval = order ? overThreshold(order.amount, threshold) : false;
  const steps: Step[] = order
    ? [
        {
          key: "buyer",
          icon: "user",
          title: t("buyer.title"),
          body: po ? t("buyer.bodyPo", { amount }) : t("buyer.body", { amount }),
          tag: t("buyer.tag"),
          tone: "neutral",
        },
        {
          key: "approver",
          icon: "shield-check",
          title: t("approver.title"),
          body: needsApproval ? t("approver.required", { threshold: thresholdText }) : t("approver.auto"),
          tag: needsApproval ? t("approver.tagRequired") : t("approver.tagAuto"),
          tone: needsApproval ? "warning" : "success",
          skipped: !needsApproval,
        },
        {
          key: "accounts",
          icon: "receipt",
          title: t("accounts.title"),
          body: credit ? t("accounts.credit") : t("accounts.prepaid"),
          tag: credit ? t("accounts.tagCredit") : t("accounts.tagPrepaid"),
          tone: "neutral",
        },
        {
          key: "production",
          icon: "factory",
          title: t("production.title"),
          body:
            order.leadTimeDays !== null ? t("production.bodyLead", { days: order.leadTimeDays }) : t("production.body"),
          tag: "",
          tone: "neutral",
        },
      ]
    : [];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="border-border bg-surface rounded-panel flex flex-col gap-5 border p-5.5">
        <h3 className="text-lg font-semibold">{t("policy")}</h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span id="sim-threshold" className="text-[13.5px]">
              {t("threshold")}
            </span>
            <b className="text-[1.375rem] font-bold tabular-nums">{thresholdText}</b>
          </div>
          <Slider
            aria-labelledby="sim-threshold"
            min={0}
            max={MAX}
            step={STEP}
            value={[threshold]}
            valueText={thresholdText}
            onValueChange={([value]) => setThreshold(value ?? 0)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span id="sim-orders" className="text-[13.5px]">
            {t("orders")}
          </span>
          {orders.length > 0 ? (
            <div role="radiogroup" aria-labelledby="sim-orders" className="flex flex-wrap gap-1.5">
              {orders.map((candidate) => {
                const on = candidate.key === order?.key;
                return (
                  <button
                    key={candidate.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setPicked(candidate.key)}
                    className={cn(
                      "rounded-control border px-3 py-1.5 text-left text-[13px] tabular-nums transition-colors",
                      on
                        ? "border-primary bg-primary text-primary-fg"
                        : "border-border-strong bg-surface text-muted hover:text-fg",
                    )}
                  >
                    {t("order", {
                      name: candidate.name,
                      qty: format.number(candidate.quantity),
                      amount: format.thb(candidate.amount),
                    })}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-muted text-sm">{t("noOrders")}</p>
          )}
          {orders.length > 0 ? <p className="text-subtle text-xs">{t("ordersHint")}</p> : null}
        </div>
        <Switch
          label={t("po")}
          labelPosition="start"
          checked={po}
          onCheckedChange={setPo}
          className="justify-between"
        />
        <Switch
          label={t("credit")}
          labelPosition="start"
          checked={credit}
          onCheckedChange={setCredit}
          className="justify-between"
        />
      </div>
      <ol aria-label={t("flowLabel")} aria-live="polite" className="bg-bg-subtle rounded-panel flex flex-col p-5.5">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className={cn(
              "relative grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 py-3",
              step.skipped && "opacity-55",
            )}
          >
            {index < steps.length - 1 ? (
              <span aria-hidden="true" className="bg-border-strong absolute top-13 -bottom-3 left-[19px] w-0.5" />
            ) : null}
            <span
              className={cn(
                "bg-surface border-border-strong relative z-[1] grid size-10 place-items-center rounded-full border",
                step.skipped && "border-dashed",
              )}
            >
              <Icon name={step.icon} size={19} aria-hidden="true" className="text-primary" />
            </span>
            <span className="min-w-0">
              <b className="block font-semibold">{step.title}</b>
              <small className="text-subtle block text-[12.5px] tabular-nums">{step.body}</small>
            </span>
            {step.tag ? (
              <span
                className={cn(
                  "rounded-control px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
                  step.tone === "warning" && "bg-warning-subtle text-warning-subtle-fg",
                  step.tone === "success" && "bg-success-subtle text-success-subtle-fg",
                  step.tone === "neutral" && "bg-surface border-border border",
                )}
              >
                {step.tag}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
