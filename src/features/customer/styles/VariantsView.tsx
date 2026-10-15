import { getTranslations } from "next-intl/server";

import { listStyleVariants } from "@/features/customer/catalog/api.server";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Input } from "@/ui/components/Input";
import { cn } from "@/ui/lib/cn";

import { axisLabel, facetLabel, valueLabel, type StylesT } from "./labels";
import { STYLES_HREF } from "./paths";
import { VariantCardFace, variantWords } from "./VariantCardFace";
import {
  isVariantsFiltered,
  toVariantQuery,
  VARIANT_GROUPS,
  VARIANT_SORTS,
  VARIANTS_VIEW,
  variantsHref,
  type VariantParams,
} from "./variant-query";
import { VariantResults } from "./VariantResults";

const PER_PAGE = 24;
const CATEGORIES = ["folding_carton", "corrugated", "rigid", "flexible", "label", "tag_sleeve", "insert"];

/**
 * Every variant of the library as a card (D-410), Kumopack-style: filtered by top, bottom, window,
 * hang tab, other features and material — one axis's values are alternatives, different axes all
 * apply, and each value's count leaves its own axis out — and paged by the API's cursor. Each card
 * opens its style with the variant chosen; the view itself is not a page to index.
 */
export async function VariantsView({ params, locale }: { params: VariantParams; locale: string }) {
  const [t, list] = await Promise.all([getTranslations("styles"), listStyleVariants(toVariantQuery(params, PER_PAGE))]);
  const words = t as unknown as StylesT;
  const counts = new Map(list.facets.option.map((f) => [f.value, f.count]));
  const action = getPathname({ href: STYLES_HREF, locale: locale as Locale });
  const sort = params.sort ?? "popular";
  const filtered = isVariantsFiltered(params);
  const categoryCount = new Map(list.facets.category.map((f) => [f.value, f.count]));

  const valueOf = (axis: string, value: string) =>
    value === "none" && !words.has(`values.${axis}.none`) ? t("detail.noneSelected") : valueLabel(words, axis, value);

  return (
    <>
      <nav aria-label={t("list.categories")} className="-mx-4 mt-6 overflow-x-auto px-4">
        <ul className="flex gap-1">
          {[undefined, ...CATEGORIES].map((category) => {
            const current = params.category === category;
            const count = category ? categoryCount.get(category) : undefined;
            if (category && !count && !current) return null;
            return (
              <li key={category ?? "all"}>
                <Link
                  href={variantsHref(params, { category })}
                  aria-current={current ? "page" : undefined}
                  rel="nofollow"
                  className={cn(
                    "focus-visible:ring-focus-ring rounded-control block px-3 py-1.5 text-sm whitespace-nowrap outline-none focus-visible:ring-2",
                    current ? "bg-primary text-primary-fg" : "hover:bg-bg-subtle",
                  )}
                >
                  {category ? facetLabel(words, "category", category) : t("list.allCategories")}
                  {count !== undefined ? (
                    <span className="ms-1 tabular-nums opacity-80">{t("list.count", { count })}</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6 grid gap-8 md:grid-cols-[15rem_1fr]">
        <aside className="flex min-w-0 flex-col gap-6" aria-label={t("list.filters")}>
          {/* On a phone the filters fold away behind one toggle, so the cards come first (CSS only). */}
          <input id="variant-filters" type="checkbox" className="peer sr-only" />
          <label
            htmlFor="variant-filters"
            className="border-border rounded-control flex items-center justify-between border px-3 py-2 text-sm font-medium peer-focus-visible:ring-2 md:hidden"
          >
            {t("list.filters")}
            {params.option.length ? (
              <span className="text-primary tabular-nums">{t("list.count", { count: params.option.length })}</span>
            ) : null}
          </label>
          <div className="hidden min-w-0 flex-col gap-6 peer-checked:flex md:flex">
            <form action={action} role="search" className="flex gap-2">
              <input type="hidden" name="view" value={VARIANTS_VIEW} />
              {params.option.map((o) => (
                <input key={o} type="hidden" name="option" value={o} />
              ))}
              {params.category ? <input type="hidden" name="category" value={params.category} /> : null}
              {params.materialClass ? <input type="hidden" name="materialClass" value={params.materialClass} /> : null}
              <label className="sr-only" htmlFor="variants-q">
                {t("list.searchLabel")}
              </label>
              <Input
                id="variants-q"
                name="q"
                type="search"
                defaultValue={params.q}
                placeholder={t("list.searchPlaceholder")}
              />
              <Button type="submit" variant="secondary">
                {t("list.searchSubmit")}
              </Button>
            </form>

            {VARIANT_GROUPS.map((group) => {
              const values = list.facets.option.filter(
                (f) =>
                  group.axes.includes(f.value.split(":")[0]!) &&
                  (f.count > 0 || params.option.includes(f.value)) &&
                  // "No window" and "no hang tab" are choices; "no top" on a pouch is not.
                  (group.none || !f.value.endsWith(":none")),
              );
              // A group whose only value is "none" says nothing about the matches.
              if (values.every((f) => f.value.endsWith(":none"))) return null;
              return (
                <section key={group.id} aria-labelledby={`vfacet-${group.id}`}>
                  <h2 id={`vfacet-${group.id}`} className="mb-2 text-sm font-medium">
                    {t(`list.${group.id}`)}
                  </h2>
                  <ul className="flex flex-col gap-0.5">
                    {values.map(({ value }) => {
                      const [axis = "", option = ""] = value.split(":");
                      const on = params.option.includes(value);
                      return (
                        <li key={value}>
                          <Link
                            href={variantsHref(params, { toggle: value })}
                            aria-current={on ? "true" : undefined}
                            rel="nofollow"
                            className={cn(
                              "focus-visible:ring-focus-ring flex justify-between gap-2 rounded-md px-2 py-1 text-sm outline-none focus-visible:ring-2",
                              on ? "bg-primary-subtle text-primary-subtle-fg font-medium" : "hover:bg-bg-subtle",
                            )}
                          >
                            <span>
                              {group.axes.length > 1 ? `${axisLabel(words, axis)}: ` : ""}
                              {valueOf(axis, option)}
                            </span>
                            <span className="text-muted tabular-nums">{counts.get(value) ?? 0}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}

            {list.facets.materialClass.length > 1 || params.materialClass ? (
              <section aria-labelledby="vfacet-material">
                <h2 id="vfacet-material" className="mb-2 text-sm font-medium">
                  {t("list.filterMaterial")}
                </h2>
                <ul className="flex flex-col gap-0.5">
                  {list.facets.materialClass.map(({ value, count }) => {
                    const on = params.materialClass === value;
                    return (
                      <li key={value}>
                        <Link
                          href={variantsHref(params, { materialClass: on ? undefined : value })}
                          aria-current={on ? "true" : undefined}
                          rel="nofollow"
                          className={cn(
                            "focus-visible:ring-focus-ring flex justify-between gap-2 rounded-md px-2 py-1 text-sm outline-none focus-visible:ring-2",
                            on ? "bg-primary-subtle text-primary-subtle-fg font-medium" : "hover:bg-bg-subtle",
                          )}
                        >
                          <span>{facetLabel(words, "materialClass", value)}</span>
                          <span className="text-muted tabular-nums">{count}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted text-sm" aria-live="polite">
              {t("list.variantResults", { count: list.meta.total })}
              {filtered ? (
                <>
                  {" "}
                  <Link
                    href={variantsHref({ option: [] })}
                    rel="nofollow"
                    className="text-primary underline underline-offset-2"
                  >
                    {t("list.clear")}
                  </Link>
                </>
              ) : null}
            </p>
            <nav aria-label={t("list.sort")} className="flex flex-wrap items-center gap-1 text-sm">
              <span className="text-muted me-1">{t("list.sort")}</span>
              {VARIANT_SORTS.map((s) => (
                <Link
                  key={s}
                  href={variantsHref(params, { sort: s === "popular" ? undefined : s })}
                  aria-current={s === sort ? "true" : undefined}
                  rel="nofollow"
                  className={cn(
                    "focus-visible:ring-focus-ring rounded-control px-2.5 py-1 outline-none focus-visible:ring-2",
                    s === sort ? "bg-primary-subtle text-primary-subtle-fg font-medium" : "hover:bg-bg-subtle",
                  )}
                >
                  {t(`sorts.${s}`)}
                </Link>
              ))}
            </nav>
          </div>

          {list.data.length === 0 ? (
            <EmptyState
              icon="search"
              title={t("list.emptyTitle")}
              description={t("list.emptyBody")}
              action={
                <Button asChild variant="secondary">
                  <Link href={variantsHref({ option: [] })}>{t("list.clear")}</Link>
                </Button>
              }
            />
          ) : (
            <VariantResults
              key={variantsHref(params)}
              initial={list.data.map((card, index) => ({
                code: card.code,
                node: <VariantCardFace card={card} words={variantWords(card, locale, words)} priority={index < 2} />,
              }))}
              nextCursor={list.meta.nextCursor}
              query={toVariantQuery(params, PER_PAGE)}
              total={list.meta.total}
            />
          )}
        </div>
      </div>
    </>
  );
}
