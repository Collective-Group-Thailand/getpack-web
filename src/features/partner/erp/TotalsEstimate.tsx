"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";

import { plainNumber } from "./format";

/**
 * The document's totals worked out while typing (in satang, so 0.1 + 0.2 stays 0.30): before VAT, VAT and total for
 * prices that exclude VAT, include it, or carry none. An estimate — the saved document's figures are the API's.
 */
export function TotalsEstimate({
  lines,
  vatMode,
  vatRatePct = "7",
  fallback,
  plain = false,
}: {
  lines: { quantity: string; price?: string; discountPct?: string }[];
  vatMode: "exclusive" | "inclusive" | "none";
  vatRatePct?: string;
  fallback: string;
  /** Inside a summary panel: no box of its own. */
  plain?: boolean;
}) {
  const t = useTranslations("partnerErp.common.estimate");
  const format = useFormat();
  const num = (v: string | undefined) => {
    const n = Number(plainNumber(v ?? ""));
    return Number.isFinite(n) ? n : 0;
  };
  const gross = lines.reduce(
    (total, line) => total + Math.round(num(line.quantity) * num(line.price) * (1 - num(line.discountPct) / 100) * 100),
    0,
  );
  if (gross <= 0) return <p className="text-muted text-sm">{fallback}</p>;
  const rate = vatMode === "none" ? 0 : num(vatRatePct) / 100;
  const net = vatMode === "inclusive" ? Math.round(gross / (1 + rate)) : gross;
  const vat = vatMode === "inclusive" ? gross - net : Math.round(net * rate);
  const thb = (n: number) => format.thb((n / 100).toFixed(2));
  return (
    <dl
      className={
        plain
          ? "grid w-full grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm"
          : "border-border bg-surface ms-auto grid w-full max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 rounded-xl border p-3 text-sm"
      }
      aria-live="polite"
    >
      <dt className="text-muted">{t("subtotal")}</dt>
      <dd className="text-end tabular-nums">{thb(net)}</dd>
      {vatMode !== "none" ? (
        <>
          <dt className="text-muted">{t("vat", { rate: plainNumber(vatRatePct) || "0" })}</dt>
          <dd className="text-end tabular-nums">{thb(vat)}</dd>
        </>
      ) : null}
      <dt className={plain ? "border-border mt-1 border-t pt-2 font-semibold" : "font-semibold"}>{t("total")}</dt>
      <dd
        className={
          plain
            ? "border-border mt-1 border-t pt-2 text-end text-base font-semibold tabular-nums"
            : "text-end font-semibold tabular-nums"
        }
      >
        {thb(net + vat)}
      </dd>
      <dd className="text-muted col-span-2 text-xs">{t("note")}</dd>
    </dl>
  );
}
