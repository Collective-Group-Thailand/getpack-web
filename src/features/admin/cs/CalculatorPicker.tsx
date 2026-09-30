"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/ui/components/Badge";
import { Icon } from "@/ui/icons";

import { useActor, useProductTypes } from "../console";
import { CALCULATORS, isPublished } from "./calculators";

/**
 * The seven instant calculators of D-100, one card each. A type is priced here only when its
 * calculator is published and the catalogue has it `instant`; the rest say RFQ-only (U1 §U-F0.2–0.4).
 */
export function CalculatorPicker() {
  const t = useTranslations("cs.picker");
  const actor = useActor();
  const { types } = useProductTypes();
  const instant = (key: string) => types.some((type) => type.calculatorKey === key && type.quoteMode === "instant");
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {CALCULATORS.filter((calculator) => !calculator.flag || actor.featureFlags.includes(calculator.flag)).map(
        (calculator) => {
          const live = isPublished(calculator.key) && instant(calculator.key);
          return (
            <li key={calculator.key}>
              <Link
                href={`/cs/${calculator.key}`}
                className="border-border bg-surface hover:border-border-strong hover:bg-surface-subtle flex h-full gap-3 rounded-lg border p-4"
              >
                <Icon name={calculator.icon} size={24} className="text-primary shrink-0" />
                <span>
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {t(`types.${calculator.key}.name`)}
                    {live ? null : <Badge size="sm">{t("rfqOnly")}</Badge>}
                  </span>
                  <span className="text-muted block text-sm">{t(`types.${calculator.key}.description`)}</span>
                </span>
              </Link>
            </li>
          );
        },
      )}
    </ul>
  );
}
