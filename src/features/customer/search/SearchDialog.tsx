"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { ORDER_STATUS, statusMeta } from "@/domain/status";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { browserRequests } from "@/lib/api/requests/browser";
import type { Schemas } from "@/lib/api/types";
import { CommandPalette, type CommandItem } from "@/ui/components/CommandPalette";

import { pick } from "../catalog/localize";
import { articleHref, productHref, stockProductHref } from "../catalog/paths";
import { matchFaqs, mightBeOrderCode, orderCodeOf } from "./match";
import { clearRecent, readRecent, rememberSearch } from "./recent";

type Order = { orderId: string; orderCode: string; status: string };

interface Results {
  q: string;
  hits: Schemas["StoreSearchHitDto"][];
  faqs: Schemas["StoreFaqGroupDto"][];
  order: Order | null;
}

const DEBOUNCE_MS = 250;

/**
 * The header's instant search (design-system.md §4: instant results grouped by type, recent
 * searches, keyboard navigation) — `CommandPalette` from `src/ui` fed from the BFF.
 *
 * Loaded only when first opened (`HeaderSearch`), so it costs the storefront's pages nothing
 * until someone searches. A new keystroke cancels the request in flight; an order code is only
 * looked up for a query shaped like one, and a guest's lookup simply finds nothing.
 */
export default function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("catalog");
  const tStatus = useTranslations("status");
  const locale = useLocale();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  // Mounted on the first open and client-only (`ssr: false`), so storage can be read here.
  const [recent, setRecent] = useState<string[]>(() => readRecent());
  const faqs = useRef<Promise<Schemas["StoreFaqGroupDto"][]> | null>(null);

  const term = q.trim();
  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      faqs.current ??= browserApi()
        .GET("/v1/store/catalog/faqs")
        .then((response) => response.data ?? [])
        .catch(() => []);
      const [search, faqGroups, order] = await Promise.all([
        browserApi()
          .GET("/v1/store/catalog/search", { params: { query: { q: term } }, signal: controller.signal })
          .then((response) => response.data?.hits ?? [])
          .catch(() => []),
        faqs.current,
        mightBeOrderCode(term)
          ? browserRequests()
              .call("GET /v1/store/orders/by-code/{orderCode}", {
                path: { orderCode: orderCodeOf(term) },
                signal: controller.signal,
              })
              .catch(() => null)
          : Promise.resolve(null),
      ]);
      if (controller.signal.aborted) return;
      setResults({ q: term, hits: search, faqs: faqGroups, order });
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [term]);

  const go = (href: string, remember = term) => {
    setRecent(rememberSearch(remember));
    onOpenChange(false);
    router.push(href);
  };

  const items = useMemo<CommandItem[]>(() => {
    if (term.length < 2 || !results || results.q !== term) return [];
    const list: CommandItem[] = [];
    if (results.order) {
      const order = results.order;
      list.push({
        id: `order-${order.orderId}`,
        label: order.orderCode,
        hint: tStatus(statusMeta(ORDER_STATUS, order.status).labelKey),
        group: t("search.groups.order"),
        icon: "package",
        onSelect: () => go(`/account/orders/${order.orderId}`),
      });
    }
    for (const kind of ["catalog_product", "stock_product", "article"] as const) {
      for (const hit of results.hits.filter((entry) => entry.kind === kind).slice(0, 5)) {
        const href =
          kind === "article"
            ? articleHref(hit.key)
            : kind === "stock_product"
              ? stockProductHref(hit.key)
              : productHref(hit.key);
        list.push({
          id: `${kind}-${hit.key}`,
          label: pick(locale, hit.titleTh, hit.titleEn),
          group: t(`search.groups.${kind}`),
          icon: kind === "article" ? "article" : "box",
          onSelect: () => go(href),
        });
      }
    }
    matchFaqs(results.faqs, term, locale, 3).forEach((faq, index) =>
      list.push({
        id: `faq-${index}`,
        label: faq.question,
        group: t("search.groups.faq"),
        icon: "help",
        onSelect: () => go(faq.href),
      }),
    );
    list.push({
      id: "all",
      label: t("search.seeAll"),
      icon: "search",
      onSelect: () => go(`/search?q=${encodeURIComponent(term)}`),
    });
    return list;
    // `go` closes over the router and the term, both covered here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, term, locale]);

  const footer =
    term.length === 0 && recent.length > 0 ? (
      <div className="flex flex-col gap-2 p-3">
        <p className="text-muted text-xs font-medium">{t("search.recent")}</p>
        <ul className="flex flex-wrap gap-2">
          {recent.map((entry) => (
            <li key={entry}>
              <button
                type="button"
                onClick={() => setQ(entry)}
                className="border-border hover:bg-bg-subtle focus-visible:ring-focus-ring rounded-full border px-3 py-1 text-sm outline-none focus-visible:ring-2"
              >
                {entry}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            clearRecent();
            setRecent([]);
          }}
          className="text-muted self-start text-xs underline underline-offset-2"
        >
          {t("search.clearRecent")}
        </button>
      </div>
    ) : term.length === 1 ? (
      <p className="text-muted p-3 text-sm">{t("search.tooShort")}</p>
    ) : undefined;

  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      title={t("search.title")}
      placeholder={t("search.placeholder")}
      loadingLabel={t("search.loading")}
      emptyLabel={term.length >= 2 ? t("search.empty") : ""}
      value={q}
      onValueChange={setQ}
      items={items}
      loading={loading && term.length >= 2}
      footer={footer}
    />
  );
}
