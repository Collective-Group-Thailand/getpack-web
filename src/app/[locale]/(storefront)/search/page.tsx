import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { listFaqs, searchCatalogue, type SearchResult } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { articleHref, productHref, stockProductHref } from "@/features/customer/catalog/paths";
import { findOwnOrder } from "@/features/customer/search/lookup.server";
import { faqHitsOf } from "@/features/customer/search/match";
import { ORDER_STATUS, statusMeta } from "@/domain/status";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Input } from "@/ui/components/Input";
import { Icon, type IconName } from "@/ui/icons";

type SearchParams = Promise<{ q?: string | string[] }>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("catalog");
  // Results pages are views of other pages; the pages themselves are what to index.
  return { title: t("search.title"), description: t("search.metaDescription"), robots: { index: false, follow: true } };
}

type Hit = { key: string; label: string; href: string; icon: IconName; hint?: string };

/**
 * Global search (F3 3.1): products, stock products, articles and FAQs from the catalogue search
 * (the FAQ's answer from the FAQ list), and — for a signed-in customer typing an order code — their
 * order. A plain GET page, so it works without JavaScript and is the target of the header's
 * instant search.
 */
export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const q = one((await searchParams).q).slice(0, 100);
  const [t, tStatus, currentLocale] = await Promise.all([
    getTranslations("catalog"),
    getTranslations("status"),
    getLocale(),
  ]);

  const searching = q.length >= 2;
  const [result, faqs, order] = searching
    ? await Promise.all([
        searchCatalogue(q).catch((): SearchResult => ({ q, hits: [] })),
        listFaqs().catch(() => []),
        findOwnOrder(q),
      ])
    : [null, [], null];

  const hitsOf = (kind: "catalog_product" | "stock_product" | "article"): Hit[] =>
    (result?.hits ?? [])
      .filter((hit) => hit.kind === kind)
      .map((hit) => ({
        key: `${kind}-${hit.key}`,
        label: pick(currentLocale, hit.titleTh, hit.titleEn),
        href:
          kind === "article"
            ? articleHref(hit.key)
            : kind === "stock_product"
              ? stockProductHref(hit.key)
              : productHref(hit.key),
        icon: (kind === "article" ? "article" : "box") as IconName,
      }));

  const orderHits: Hit[] = order
    ? [
        {
          key: order.id,
          label: order.orderCode,
          href: `/account/orders/${order.id}`,
          icon: "package",
          hint: tStatus(statusMeta(ORDER_STATUS, order.status).labelKey),
        },
      ]
    : [];

  const groups: { key: string; title: string; hits: Hit[] }[] = [
    {
      key: "order",
      title: t("search.groups.order"),
      hits: orderHits,
    },
    { key: "catalog_product", title: t("search.groups.catalog_product"), hits: hitsOf("catalog_product") },
    { key: "stock_product", title: t("search.groups.stock_product"), hits: hitsOf("stock_product") },
    { key: "article", title: t("search.groups.article"), hits: hitsOf("article") },
    {
      key: "faq",
      title: t("search.groups.faq"),
      hits: faqHitsOf(result?.hits ?? [], faqs, currentLocale).map((faq): Hit => ({
        key: `faq-${faq.key}`,
        label: faq.question,
        href: faq.href,
        icon: "help",
        ...(faq.answer ? { hint: faq.answer } : {}),
      })),
    },
  ].filter((group) => group.hits.length > 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <h1 className="text-3xl font-bold md:text-4xl">
        {searching ? t("search.resultsFor", { q }) : t("search.heading")}
      </h1>

      <form
        action={getPathname({ href: "/search", locale: currentLocale as Locale })}
        method="get"
        role="search"
        className="mt-6 flex gap-2"
      >
        <label htmlFor="search-q" className="sr-only">
          {t("search.label")}
        </label>
        <Input
          id="search-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t("search.placeholder")}
          minLength={2}
          maxLength={100}
          className="min-w-0 flex-1"
        />
        <Button type="submit">{t("search.submit")}</Button>
      </form>

      {searching && groups.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon="search"
          title={t("search.none", { q })}
          description={t("search.noneBody")}
          action={
            <Button asChild variant="secondary">
              <Link href="/products">{t("list.allCategories")}</Link>
            </Button>
          }
        />
      ) : null}
      {!searching && q.length > 0 ? <p className="text-muted mt-4 text-sm">{t("search.tooShort")}</p> : null}

      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`search-${group.key}`} className="mt-10">
          <h2 id={`search-${group.key}`} className="text-muted text-sm font-medium">
            {group.title}
          </h2>
          <ul className="bg-surface divide-border border-border mt-3 divide-y rounded-xl border">
            {group.hits.map((hit) => (
              <li key={hit.key}>
                <Link
                  href={hit.href}
                  className="hover:bg-bg-subtle focus-visible:ring-focus-ring flex items-start gap-3 px-4 py-3 outline-none focus-visible:ring-2"
                >
                  <Icon name={hit.icon} size={18} className="text-muted mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block font-medium">{hit.label}</span>
                    {hit.hint ? <span className="text-muted line-clamp-2 block text-sm">{hit.hint}</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
