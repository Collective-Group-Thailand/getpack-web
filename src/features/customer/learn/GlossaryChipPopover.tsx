"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { pick } from "@/features/customer/catalog/localize";
import { Link } from "@/i18n/navigation";
import { queryKeys } from "@/lib/api/query-keys";
import { Popover } from "@/ui/components/Popover";
import { Icon } from "@/ui/icons";

import { hasDemo } from "./DemoLoop";

const DemoLoop = dynamic(() => import("./DemoLoop").then((module) => module.DemoLoop));

/**
 * The glossary, once per visit and only once a chip is opened (`store.catalog-glossary`,
 * CONTRACT-REQUEST): the request client loads with it, never with the page.
 */
export function useGlossary(enabled = true) {
  return useQuery({
    queryKey: queryKeys.list("customer", "glossary"),
    queryFn: async () => {
      const { browserRequests } = await import("@/lib/api/requests/browser");
      return (await browserRequests().call("GET /v1/store/catalog/glossary-terms")).data;
    },
    staleTime: Infinity,
    enabled,
  });
}

/**
 * A jargon word explained where the decision is made (U5.2 §3, voice-and-tone "explain jargon
 * inline"): a small "?" beside the word opens the glossary's definition, with a link to the full
 * entry. Never blocks: the popover is non-modal and the word reads on its own.
 */
export default function GlossaryChipPopover({
  slug,
  label,
  initiallyOpen = false,
}: {
  slug: string;
  label?: string;
  initiallyOpen?: boolean;
}) {
  const t = useTranslations("help.glossary");
  const locale = useLocale();
  const [open, setOpen] = useState(initiallyOpen);
  const glossary = useGlossary(open);
  const term = glossary.data?.find((row) => row.slug === slug);
  const name = label ?? (term ? pick(locale, term.termTh, term.termEn) : slug);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
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
