import { getTranslations } from "next-intl/server";

import type { CatalogueCategory } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { compareDecimal } from "@/features/customer/catalog/ordering";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { kraftOf, ProductIllustration, productFamilyOf } from "@/ui/components/ProductIllustration";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { BagTileArt, CorrugatedTileArt, FoldingTileArt, LabelTileArt } from "./TileArt";

/** The home page column and the rhythm between its sections (the "Main" board: 1180 + 40 px gutters). */
export const HOME_WRAP = "mx-auto w-full max-w-content px-5 md:px-8";

/** "เรียนรู้ก่อนสั่ง →": the board's underlined text link with its arrow. */
export function ArrowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-fg group inline-flex items-center gap-2 border-b-[1.5px] border-current pb-0.5 text-[15px] font-semibold"
    >
      {children}
      <Icon
        name="arrow-right"
        size={16}
        aria-hidden="true"
        className="duration-fast transition-transform motion-safe:group-hover:translate-x-1"
      />
    </Link>
  );
}

/**
 * The category ticker under the hero: the catalogue's own category names, twice over so the loop
 * is seamless, sliding left over 40 s. Still under `prefers-reduced-motion`; hidden from assistive
 * tech (the categories are listed, as links, a section below).
 */
export function CategoryTicker({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <div aria-hidden="true" className="border-border bg-surface overflow-hidden border-y py-4">
      <div className="pk-ticker serif text-muted flex w-max gap-12 text-[22px] font-medium whitespace-nowrap">
        {[...names, ...names].map((name, index) => (
          <span key={index} className="flex items-center gap-12">
            <span className="text-sm text-[var(--color-accent)]">✦</span>
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** "How it works": the heading sticky on the left, four numbered steps on the right, ruled. */
export async function HowItWorks() {
  const t = await getTranslations("home.how");
  const steps = ["design", "price", "proof", "track"] as const;
  return (
    <section aria-labelledby="home-how" className={cn(HOME_WRAP, "pt-20 md:pt-28")}>
      <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <div className="lg:sticky lg:top-28">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h2 id="home-how" className="mt-3.5 text-4xl leading-[1.12] whitespace-pre-line md:text-5xl">
            {t("heading")}
          </h2>
          <p className="text-muted mt-4 max-w-[36em] text-[17px] leading-relaxed">{t("sub")}</p>
          <div className="mt-6">
            <ArrowLink href="/learn">{t("more")}</ArrowLink>
          </div>
        </div>
        <ol className="border-border border-b">
          {steps.map((step, index) => (
            <li
              key={step}
              className="border-border grid items-start gap-3 border-t py-7 sm:grid-cols-[90px_1fr_1.1fr] sm:gap-7"
            >
              <span
                aria-hidden="true"
                className="serif text-[44px] leading-none font-medium text-[var(--kraft-ink)] italic"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="serif text-[1.5rem] leading-tight">{t(`${step}.title`)}</h3>
              <p className="text-muted text-[15.5px] leading-relaxed">{t(`${step}.body`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const TILE_ART: Partial<Record<ReturnType<typeof productFamilyOf>, () => React.ReactNode>> = {
  tuck: FoldingTileArt,
  rigid: FoldingTileArt,
  shipping: CorrugatedTileArt,
  bag: BagTileArt,
  label: LabelTileArt,
};

/**
 * The product categories as editorial tiles (the "Main" board): one tall tile and four beside it,
 * each a drawing on a kraft wash with its caption over it and a round arrow that turns on hover;
 * the last place, when the catalogue quotes anything by hand, is the dark "special work" tile.
 * Names, the types under them and "from ฿x" are the catalogue's (D-307); categories priced
 * instantly lead (`ordering.ts`).
 */
export async function CategoryTiles({
  categories,
  locale,
  total,
  rfqHref,
}: {
  categories: CatalogueCategory[];
  locale: string;
  total: number;
  rfqHref: string | null;
}) {
  const [t, tCatalog, format] = await Promise.all([
    getTranslations("home.tiles"),
    getTranslations("catalog"),
    getFormat(),
  ]);
  const shown = categories.slice(0, rfqHref ? 4 : 5);
  if (shown.length === 0) return null;

  const tile = (category: CatalogueCategory, index: number) => {
    const name = pick(locale, category.nameTh, category.nameEn);
    const family = productFamilyOf(category.code);
    const Art = TILE_ART[family];
    const prices = category.types
      .map((type) => type.startingPricePerPiece)
      .filter((price): price is string => price !== null)
      .sort(compareDecimal);
    const instant = category.types.some((type) => type.availability !== "rfq");
    const sub = [
      ...category.types.slice(0, 3).map((type) => pick(locale, type.nameTh, type.nameEn)),
      prices[0] ? t("from", { price: format.thb(prices[0]) }) : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <li key={category.code} className={cn(index === 0 && "sm:row-span-2", "min-h-[260px]")}>
        <Link
          href={`/products/${encodeURIComponent(category.code)}`}
          className="group focus-visible:ring-focus-ring relative isolate block h-full overflow-hidden rounded-3xl outline-none focus-visible:ring-2"
        >
          <div
            className={cn(
              kraftOf(category.code),
              "grain duration-slow absolute inset-0 transition-transform motion-safe:group-hover:scale-[1.04]",
            )}
          >
            {Art ? (
              <Art />
            ) : (
              <div className="flex h-full items-center justify-center pb-16 text-[#3d3326]">
                <ProductIllustration family={family} className="max-w-36" />
              </div>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/10 to-transparent px-6 py-5.5">
            <div className="min-w-0">
              <span className="bg-surface/90 text-primary-subtle-fg inline-flex rounded-full px-2.5 py-1 text-xs font-semibold">
                {instant ? tCatalog("card.availability.instant") : tCatalog("card.availability.rfq")}
              </span>
              <h3 className="serif mt-2 text-[22px] leading-tight text-[#1e1b18]">{name}</h3>
              {sub ? <p className="mt-0.5 line-clamp-1 text-[13px] text-[#4a3f33]">{sub}</p> : null}
            </div>
            <span className="grid size-11 flex-none place-items-center rounded-full bg-white text-[#1e1b18] transition-transform duration-200 motion-safe:group-hover:-rotate-45">
              <Icon name="arrow-right" size={18} aria-hidden="true" />
            </span>
          </div>
        </Link>
      </li>
    );
  };

  return (
    <section aria-labelledby="home-tiles" className={cn(HOME_WRAP, "pt-24 md:pt-30")}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h2 id="home-tiles" className="mt-3.5 text-4xl leading-[1.12] md:text-5xl">
            {t("heading")}
          </h2>
        </div>
        <ArrowLink href="/products">{t("all", { count: total })}</ArrowLink>
      </div>
      <ul className="grid gap-4.5 sm:grid-cols-2 sm:grid-rows-[300px_300px] lg:grid-cols-[1.5fr_1fr_1fr]">
        {shown.map(tile)}
        {rfqHref ? (
          <li className="min-h-[260px]">
            <div className="grain relative flex h-full flex-col justify-between overflow-hidden rounded-3xl bg-[#1e1b18] p-6 text-white">
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(70%_70%_at_90%_10%,rgba(13,122,102,.6),transparent_70%)]"
              />
              <div className="relative">
                <p className="eyebrow text-white/70">{t("rfqEyebrow")}</p>
                <h3 className="serif mt-2.5 text-[22px] leading-tight">{t("rfqTitle")}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/75">{t("rfqBody")}</p>
              </div>
              <Link
                href={rfqHref}
                className="relative inline-flex h-11 items-center self-start rounded-full bg-white px-5 text-sm font-semibold text-[#1e1b18]"
              >
                {t("rfqAction")}
              </Link>
            </div>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

/** "Why Packio": one statement, a paragraph, and three proof points under a rule. */
export async function WhyPackio({ claimWindowDays }: { claimWindowDays: number | null }) {
  const t = await getTranslations("home.why");
  const points = [
    claimWindowDays !== null
      ? { big: t("claim.big", { days: claimWindowDays }), title: t("claim.title"), body: t("claim.body") }
      : null,
    { big: t("qc.big"), title: t("qc.title"), body: t("qc.body") },
    { big: t("tax.big"), title: t("tax.title"), body: t("tax.body") },
  ].filter((point): point is { big: string; title: string; body: string } => point !== null);
  return (
    <section aria-labelledby="home-why" className={cn(HOME_WRAP, "pt-24 md:pt-30")}>
      <div className="grid items-end gap-10 lg:grid-cols-[1.4fr_1fr]">
        <h2 id="home-why" className="text-4xl leading-[1.12] md:text-5xl">
          {t.rich("statement", { em: (chunks) => <em>{chunks}</em>, br: () => <br /> })}
        </h2>
        <p className="text-muted text-[17px] leading-relaxed">{t("sub")}</p>
      </div>
      <ul className="border-fg mt-12 grid border-t sm:grid-cols-3">
        {points.map((point, index) => (
          <li
            key={point.title}
            className={cn(
              "border-border py-7 sm:px-7",
              index > 0 && "border-t sm:border-s sm:border-t-0",
              index === 0 && "sm:ps-0",
            )}
          >
            <p className="serif text-primary text-5xl leading-none md:text-6xl">{point.big}</p>
            <h3 className="serif mt-4 text-xl">{point.title}</h3>
            <p className="text-muted mt-1.5 text-[15px] leading-relaxed">{point.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
