"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import type { Schemas } from "@/lib/api/types";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { SearchInput } from "@/ui/components/SearchInput";
import { cn } from "@/ui/lib/cn";

import { PlaybookCard } from "./PlaybookCard";

type Card = Schemas["AgentPlaybookCardDto"];
type Context = Schemas["AgentPlaybookContext"];
const CONTEXTS: readonly Context[] = [
  "first_contact",
  "follow_up",
  "discount_request",
  "competitor_cheaper",
  "big_deal",
  "lead_lost_price",
];

/**
 * คู่มือการขาย (D-468 §5): every published card for agents, searchable as the agent types (title, body and the
 * suggested replies), with the situations as filter chips. A card meant for every situation (`all`) is in every one.
 */
export function PlaybookLibrary({ cards }: { cards: Card[] }) {
  const t = useTranslations("agentSales.playbook");
  const [q, setQ] = useState("");
  const [context, setContext] = useState<Context | "all">("all");
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return cards.filter((card) => {
      if (context !== "all" && !card.contexts.includes(context) && !card.contexts.includes("all")) return false;
      if (!needle) return true;
      const text = [
        card.titleTh,
        card.titleEn,
        card.bodyTh,
        card.bodyEn,
        ...card.suggestedReplies.flatMap((reply) => [reply.th, reply.en]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(needle);
    });
  }, [cards, context, q]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Field label={t("search")} labelHidden className="sm:max-w-md">
          <SearchInput
            value={q}
            onValueChange={setQ}
            clearLabel={t("clear")}
            placeholder={t("searchPlaceholder")}
            className="[&_input]:min-h-11 sm:[&_input]:min-h-0"
          />
        </Field>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("situations")}>
          {(["all", ...CONTEXTS] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={context === key}
              onClick={() => setContext(key)}
              className={cn(
                "focus-visible:ring-focus-ring border-border inline-flex min-h-11 items-center rounded-lg border px-3.5 text-sm outline-none transition-colors duration-100 focus-visible:ring-2 sm:min-h-9",
                context === key ? "bg-primary-subtle text-primary-subtle-fg border-primary/30 font-semibold" : "bg-surface hover:bg-surface-subtle",
              )}
            >
              {t(`contexts.${key}`)}
            </button>
          ))}
        </div>
        <p className="text-muted text-sm" role="status" aria-live="polite">
          {t("count", { count: shown.length })}
        </p>
      </div>
      {shown.length === 0 ? (
        <EmptyState icon="search" title={t("noMatch")} description={t("noMatchBody")} />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {shown.map((card) => (
            <li key={card.id}>
              <PlaybookCard card={card} headingLevel={2} className="h-full" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
