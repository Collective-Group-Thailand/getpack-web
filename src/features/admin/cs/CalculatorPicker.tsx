"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Icon } from "@/ui/icons";

import { useActor } from "../console";
import { CALCULATORS } from "./calculators";

/** The seven instant calculators of D-100, one card each. */
export function CalculatorPicker() {
  const t = useTranslations("cs.picker");
  const actor = useActor();
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {CALCULATORS.filter((calculator) => !calculator.flag || actor.featureFlags.includes(calculator.flag)).map(
        (calculator) => (
          <li key={calculator.key}>
            <Link
              href={`/cs/${calculator.key}`}
              className="border-border bg-surface hover:border-border-strong hover:bg-surface-subtle flex h-full gap-3 rounded-lg border p-4"
            >
              <Icon name={calculator.icon} size={24} className="text-primary shrink-0" />
              <span>
                <span className="block font-medium">{t(`types.${calculator.key}.name`)}</span>
                <span className="text-muted block text-sm">{t(`types.${calculator.key}.description`)}</span>
              </span>
            </Link>
          </li>
        ),
      )}
    </ul>
  );
}
