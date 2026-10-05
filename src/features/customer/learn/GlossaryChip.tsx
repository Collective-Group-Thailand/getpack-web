"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import { pick } from "@/features/customer/catalog/localize";
import { Link } from "@/i18n/navigation";
import { browserRequests } from "@/lib/api/requests/browser";
import { queryKeys } from "@/lib/api/query-keys";
import { Popover } from "@/ui/components/Popover";
import { Icon } from "@/ui/icons";

import { DemoLoop, hasDemo } from "./DemoLoop";

/** The glossary, once per visit (`store.catalog-glossary`, CONTRACT-REQUEST). */
export function useGlossary() {
  return useQuery({
    queryKey: queryKeys.list("customer", "glossary"),
    queryFn: async () => (await browserRequests().call("GET /v1/store/catalog/glossary-terms")).data,
    staleTime: Infinity,
  });
}

/**
 * A jargon word explained where the decision is made (U5.2 §3, voice-and-tone "explain jargon
 * inline"): a small "?" beside the word opens the glossary's definition, with a link to the full
 * entry. Never blocks: the popover is non-modal and the word reads on its own.
 */
export function GlossaryChip({ slug, label }: { slug: string; label?: string }) {
  const t = useTranslations("help.glossary");
  const locale = useLocale();
  const glossary = useGlossary();
  const term = glossary.data?.find((row) => row.slug === slug);
  const name = label ?? (term ? pick(locale, term.termTh, term.termEn) : slug);
  return (
    <Popover
      aria-label={t("chipLabel", { term: name })}
      trigger={
        <button
          type="button"
          className="text-muted hover:text-primary focus-visible:ring-focus-ring inline-flex size-6 items-center justify-center rounded-full align-middle outline-none focus-visible:ring-2"
          aria-label={t("chipLabel", { term: name })}
        >
          <Icon name="help" size={14} />
        </button>
      }
    >
      {term ? (
        <div className="flex flex-col gap-2">
          <p className="font-semibold">
            {pick(locale, term.termTh, term.termEn)}
            {locale !== "en" && term.termEn ? <span className="text-muted ms-2 font-normal">{term.termEn}</span> : null}
          </p>
          <p>{pick(locale, term.definitionTh, term.definitionEn)}</p>
          {hasDemo(term.slug) ? <DemoLoop demo={term.slug} /> : null}
          <Link
            href={`/help/glossary#${term.slug}`}
            className="text-primary text-xs underline-offset-4 hover:underline"
          >
            {t("more")}
          </Link>
        </div>
      ) : (
        <p className="text-muted">{glossary.isError ? t("unavailable") : t("loading")}</p>
      )}
    </Popover>
  );
}
