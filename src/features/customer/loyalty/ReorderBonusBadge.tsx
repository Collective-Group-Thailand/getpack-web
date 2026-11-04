"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { shortMultiplier } from "@/features/shared/loyalty-p2/multipliers";
import { cn } from "@/ui/lib/cn";

/**
 * The reorder campaign on a suggestion, an order or a cart line (loyalty P2, D-492; prototype `p2-lifecycle.html`):
 * a small solid "แต้ม ×1.5" tag and "สั่งซ้ำรับแต้มเพิ่ม · ถึง 12 พ.ย. 2569". The end is a static date — never a
 * countdown or "เหลือ n ชม." (D-481). `md` sits on a `primary-subtle` band inside a card; `sm` is the bare line.
 */
export function ReorderBonusBadge({
  multiplier,
  endsAt,
  size = "md",
  className,
}: {
  multiplier: string;
  endsAt: string;
  size?: "md" | "sm";
  className?: string;
}) {
  const t = useTranslations("account.lifecycle");
  const format = useFormat();
  return (
    <p
      className={cn(
        "text-primary-subtle-fg flex items-center leading-snug",
        size === "md"
          ? "bg-primary-subtle rounded-control gap-2.5 px-3 py-2 text-[0.84375rem]"
          : "gap-2 text-[0.8125rem]",
        className,
      )}
    >
      <span className="bg-primary text-primary-fg inline-flex h-[1.375rem] shrink-0 items-center rounded-md px-[0.4375rem] text-[0.78125rem] font-semibold tabular-nums">
        {t("bonusTag", { multiplier: shortMultiplier(multiplier) })}
      </span>
      <span>
        {t.rich("bonusUntil", {
          date: format.date(endsAt),
          b: (chunk) => <b className="font-semibold">{chunk}</b>,
        })}
      </span>
    </p>
  );
}
