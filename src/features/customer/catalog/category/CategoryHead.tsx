import { getLocale, getTranslations } from "next-intl/server";

import type { CatalogueCategory } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { orderCategories } from "@/features/customer/catalog/ordering";
import { categoryHref } from "@/features/customer/catalog/paths";
import { HubVatSwitch } from "@/features/customer/products/HubVatSwitch";
import { displayPrice } from "@/features/shared/format/price";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { cn } from "@/ui/lib/cn";

import type { CategoryFacts } from "./facts";

function Fact({
  label,
  children,
  tone,
  figure,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  tone?: string;
  /** One of the two VAT figures (`data-vat-figure`, base.css): the page's switch shows one. */
  figure?: "incl" | "excl";
}) {
  return (
    <div role="listitem" data-vat-figure={figure}>
      <p className="m-0 flex flex-col leading-tight">
        <span className="text-muted text-[0.78125rem]">{label}</span>
        <span className={cn("text-[1.0625rem] font-semibold tabular-nums md:text-xl", tone)}>{children}</span>
      </p>
    </div>
  );
}

/**
 * The category head (category Phase 1 items 1–2, prototype `.head`): breadcrumb "หน้าแรก / สินค้าและราคา /
 * {category}", the H1, the approved intro (else a line from how the category is bought), the VAT switch (only when
 * the API sent both figures of every price), the facts from the API (instant: เริ่มต้น · ขั้นต่ำ · ระยะผลิต · จำนวน ·
 * วิธีซื้อ; quote-only: ขั้นต่ำ · ใบเสนอราคาภายในวันทำการ · จำนวน — a fact without data is left out), and every
 * category as one row of chips with this one current — no counts (the old "1 · ประเภท" counted product types).
 */
export async function CategoryHead({
  category,
  tree,
  facts,
  intro,
  vatSwitch,
}: {
  category: CatalogueCategory;
  tree: readonly CatalogueCategory[];
  facts: CategoryFacts;
  intro: string | null;
  vatSwitch: boolean;
}) {
  const [t, tProducts, tCatalog, locale, format] = await Promise.all([
    getTranslations("catalog.categoryPage"),
    getTranslations("products"),
    getTranslations("catalog"),
    getLocale(),
    getFormat(),
  ]);
  const name = pick(locale, category.nameTh, category.nameEn);
  const labels = { incl: tCatalog("price.vatIncluded"), excl: tCatalog("price.vatExcluded") };
  const start = facts.start
    ? {
        incl: displayPrice({ incl: facts.start.incl }, "incl", format.thb, labels),
        excl: facts.start.excl ? displayPrice({ excl: facts.start.excl }, "excl", format.thb, labels) : null,
      }
    : null;
  const quoteOnly = facts.mode === "quote";
  const mode = facts.mode;
  const lede = intro ?? (mode ? t(`lede.${mode}`) : null);

  return (
    <div>
      <Breadcrumbs
        label={tCatalog("breadcrumbs.label")}
        items={[
          { label: tProducts("head.home"), href: "/" },
          { label: tProducts("head.breadcrumb"), href: "/products" },
          { label: name },
        ]}
        className="mb-3"
      />
      <header className="grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <h1 className="text-[1.875rem] leading-[1.15] font-semibold tracking-tight text-balance md:text-[2.625rem]">
            {name}
          </h1>
          {lede ? (
            <p id="category-answer" className="text-muted mt-2.5 max-w-[60ch] text-pretty">
              {lede}
            </p>
          ) : null}
        </div>
        {vatSwitch ? (
          <div className="lg:justify-self-end">
            <HubVatSwitch
              label={tProducts("head.vatLabel")}
              incl={tProducts("head.vatIncl")}
              excl={tProducts("head.vatExcl")}
            />
          </div>
        ) : start ? (
          <p className="text-muted text-[0.8125rem] lg:justify-self-end">{tProducts("head.vatIncludedNote")}</p>
        ) : null}
      </header>

      {facts.count > 0 ? (
        <div role="list" aria-label={t("facts.label")} className="mt-5 flex flex-wrap gap-x-7 gap-y-3">
          {start?.incl
            ? [start.incl, start.excl].flatMap((price) =>
                price ? (
                  <Fact
                    key={price.basis}
                    label={t("facts.start", { vat: price.vatLabel })}
                    tone="text-primary"
                    // Both figures only when the API sent both (VatFigure's rule); the switch hides one.
                    figure={start.excl ? price.basis : undefined}
                  >
                    {t("facts.perUnit", { price: price.amount })}
                  </Fact>
                ) : (
                  []
                ),
              )
            : null}
          {facts.moq ? (
            <Fact label={t("facts.moq")}>
              {facts.moq.min === facts.moq.max
                ? t("facts.moqOne", { min: facts.moq.min })
                : t("facts.moqRange", { min: facts.moq.min, max: facts.moq.max })}
            </Fact>
          ) : null}
          {quoteOnly ? <Fact label={t("facts.quote")}>{t("facts.quoteValue")}</Fact> : null}
          {facts.lead && !quoteOnly ? (
            <Fact label={t("facts.lead")}>
              {facts.lead.min === facts.lead.max
                ? t("facts.leadOne", { min: facts.lead.min })
                : t("facts.leadRange", { min: facts.lead.min, max: facts.lead.max })}
            </Fact>
          ) : null}
          <Fact label={t("facts.count")}>{t("facts.countValue", { count: facts.count })}</Fact>
          {mode && !quoteOnly ? (
            <Fact label={t("facts.mode")} tone={mode === "instant" ? "text-instant" : undefined}>
              {t(`facts.modes.${mode}`)}
            </Fact>
          ) : null}
        </div>
      ) : null}

      <nav aria-label={t("siblings")} className="relative mt-6">
        <ul className="-mx-5 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-5 pb-0.5 md:-mx-8 md:px-8 xl:mx-0 xl:px-0 [&::-webkit-scrollbar]:hidden">
          <li className="text-muted shrink-0 self-center pe-1 text-[0.78125rem]" aria-hidden="true">
            {t("siblings")}
          </li>
          {orderCategories(tree).map((sibling) => {
            const current = sibling.code === category.code;
            return (
              <li key={sibling.code} className="shrink-0">
                <Link
                  href={categoryHref(sibling.code)}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "rounded-control focus-visible:ring-focus-ring inline-flex h-9 items-center border px-3.5 text-[0.84375rem] whitespace-nowrap outline-none focus-visible:ring-2",
                    current
                      ? "border-fg bg-fg text-bg font-medium"
                      : "border-border-strong bg-surface text-muted hover:text-fg",
                  )}
                >
                  {pick(locale, sibling.nameTh, sibling.nameEn)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
