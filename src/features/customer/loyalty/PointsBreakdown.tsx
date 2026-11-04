"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { multiplierParts, shortMultiplier } from "@/features/shared/loyalty-p2/multipliers";
import type { CheckoutPointsP2Fields } from "@/lib/api/requests/store-loyalty-p2";

/**
 * What the order earns at checkout (loyalty P2, D-490, D-495): "รับ 22 แต้มเมื่อคำสั่งซื้อเสร็จสิ้น" with the
 * multipliers that are not ×1 ("ระดับสมาชิก ×1.25 · สั่งซ้ำ ×1.5"), and — when the chosen method does not already
 * earn it — the QR / transfer hint with the API's `toEarnWithPaymentBonus`. Every figure is the API's.
 */
export function PointsBreakdown({ toEarn, p2 }: { toEarn: number; p2: CheckoutPointsP2Fields }) {
  const t = useTranslations("account.lifecycle");
  const tFlow = useTranslations("checkout.flow");
  const format = useFormat();
  const parts = multiplierParts(p2.multipliers);
  const bonus =
    p2.paymentBonus && p2.toEarnWithPaymentBonus !== null && p2.toEarnWithPaymentBonus > toEarn
      ? p2.paymentBonus
      : null;
  return (
    <div className="text-muted m-0 flex flex-col gap-0.5 text-xs">
      <p className="m-0">
        {tFlow("summary.pointsToEarn", { points: format.number(toEarn) })}
        {parts.length ? ` · ${parts.map(({ part, value }) => t(`multipliers.${part}`, { value })).join(" · ")}` : null}
        {p2.multipliers?.capped ? ` · ${t("capped")}` : null}
      </p>
      {bonus ? (
        <p className="text-primary-subtle-fg m-0 font-medium">
          {t("paymentHint", {
            multiplier: shortMultiplier(bonus.multiplier),
            points: format.number(p2.toEarnWithPaymentBonus!),
          })}
        </p>
      ) : null}
    </div>
  );
}
