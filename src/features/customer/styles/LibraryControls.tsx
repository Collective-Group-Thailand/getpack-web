"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";
import { IconButton } from "@/ui/components/IconButton";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { toast } from "@/ui/components/Toast";

import { trackCatalog } from "@/lib/analytics/catalog";
import { defaultSort, listHref, toSearch, type ListParams } from "./query";

/** The order of the results — a choice of the view, so it replaces the URL rather than adding to history. */
export function SortSelect({ params, sorts }: { params: ListParams; sorts: { value: string; label: string }[] }) {
  const t = useTranslations("styles.library");
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (
    <SearchableSelect
      aria-label={t("sort")}
      className="w-full md:w-auto md:min-w-44"
      value={params.sort ?? defaultSort(params)}
      options={sorts.map((s) => ({ value: s.value, label: t("sortOption", { sort: s.label }) }))}
      onValueChange={(sort) =>
        startTransition(() => router.replace(listHref({ ...params, sort, style: undefined }), { scroll: false }))
      }
    />
  );
}

/** Copies this view's URL — its canonical spelling (short names, no defaults), quick view included. */
export function CopyLinkButton({ params }: { params: ListParams }) {
  const t = useTranslations("styles.library");
  return (
    <IconButton
      name="link"
      variant="secondary"
      label={t("copyLink")}
      onClick={async () => {
        const search = toSearch(params);
        const url = `${window.location.origin}${window.location.pathname}${search ? `?${search}` : ""}`;
        try {
          await navigator.clipboard.writeText(url);
          toast.success(t("linkCopied"));
        } catch {
          // Clipboard refused (an old browser, a permission): show the link to copy by hand.
          toast(url);
        }
      }}
    />
  );
}

/**
 * Counts a search once its results are known (`catalog_search`): the server rendered them, so the
 * count is this page's. Searches with no result are the point — they become synonyms or new styles.
 */
export function SearchTracker({ query, resultCount }: { query: string | undefined; resultCount: number }) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!query || last.current === query) return;
    last.current = query;
    trackCatalog("catalog_search", { query, mode: "word", result_count: resultCount });
  }, [query, resultCount]);
  return null;
}
