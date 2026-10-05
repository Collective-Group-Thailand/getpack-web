"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { pick } from "@/features/customer/catalog/localize";
import { SearchInput } from "@/ui/components/SearchInput";

import type { GlossaryTerm } from "./api.server";
import { DemoLoop, hasDemo } from "./DemoLoop";

/**
 * The glossary for customers (U5.6, U5.2 §3): each term in Thai and English with a plain
 * definition, one anchor per term so chips and help links land on it, and a filter over terms
 * and their aliases.
 */
export function GlossaryList({ terms }: { terms: GlossaryTerm[] }) {
  const t = useTranslations("help.glossary");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return terms;
    return terms.filter((term) =>
      [term.termTh, term.termEn ?? "", ...term.aliases].some((word) => word.toLowerCase().includes(q)),
    );
  }, [terms, query]);

  return (
    <div className="flex flex-col gap-4">
      <SearchInput
        value={query}
        onValueChange={setQuery}
        clearLabel={t("clear")}
        aria-label={t("search")}
        placeholder={t("search")}
      />
      {shown.length === 0 ? (
        <p className="text-muted text-sm">{t("noMatch", { query })}</p>
      ) : (
        <dl className="divide-border border-border divide-y rounded-xl border">
          {shown.map((term) => (
            <div key={term.slug} id={term.slug} className="target:bg-primary-subtle scroll-mt-24 p-4 transition-colors">
              <dt className="font-semibold">
                {locale === "en" ? (term.termEn ?? term.termTh) : term.termTh}
                {locale !== "en" && term.termEn ? (
                  <span className="text-muted ms-2 text-sm font-normal">{term.termEn}</span>
                ) : null}
              </dt>
              <dd className="text-muted mt-1 text-sm">{pick(locale, term.definitionTh, term.definitionEn)}</dd>
              {hasDemo(term.slug) ? (
                <dd className="mt-2 max-w-xs">
                  <DemoLoop demo={term.slug} />
                </dd>
              ) : null}
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
