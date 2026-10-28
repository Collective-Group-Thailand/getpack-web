"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";

import { usePdp } from "./PdpProvider";

/**
 * The FAQ's tolerance answer (owner 2026-10-28 14:36, DECISIONS-STAGE-A §14.9): the quantity tolerance the API
 * sends with the current calculation — the same figures the buy box and "อ่านราคาอย่างไร" show — never a fixed
 * percentage. Without figures from the API the answer says how shortfalls are handled, with no number.
 */
export function PdpToleranceAnswer() {
  const t = useTranslations("catalog.pdp.faq.items.tolerance");
  const format = useFormat();
  const { current } = usePdp();
  const shortage = current?.toleranceShortagePct ?? null;
  const overage = current?.toleranceOveragePct ?? null;
  if (shortage === null || overage === null) return <>{t("aNoFigure")}</>;
  return (
    <>
      {shortage === overage
        ? t("a", { pct: format.percent(shortage) })
        : t("aSplit", { short: format.percent(shortage), over: format.percent(overage) })}
    </>
  );
}
