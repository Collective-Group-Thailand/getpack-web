import { getLocale, getTranslations } from "next-intl/server";

import {
  type CatalogueCategory,
  type FaqGroup,
  type StockProduct,
  type StyleCard,
  type SupportChannels,
} from "@/features/customer/catalog/api.server";
import { storeImageSrc } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import { categoryHref, stockProductHref } from "@/features/customer/catalog/paths";
import { compareDecimal } from "@/features/customer/studio/decimal";
import { facetLabel, type StylesT } from "@/features/customer/styles/labels";
import { STYLES_HREF } from "@/features/customer/styles/paths";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { ProductThumb, productFamilyOf } from "@/ui/components/ProductIllustration";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import type { CustomerCase, HomePhoto } from "./content.server";
import { HOME_WRAP, Photo, TemplateCard, UNDERLINE } from "./parts";
import { styleDieline } from "./style-dielines.server";
import { NewsletterForm } from "./NewsletterForm";
import { StockShelf, type ShelfItem } from "./StockShelf";
import { StudioHeroPanel } from "./StudioHeroPanel";
import type { StudioHero } from "./studio-hero.server";

/**
 * The home page's sections, to the V4 "Main" board (design language v3): one wrap of 1320 px with
 * 48 px gutters, hairlines and whitespace instead of boxes, no label over any heading. White
 * panels only where the board shows a screen — the Studio panel and the three UI samples.
 * Every figure is the API's; a block with nothing real to show is left out.
 */
/** 104 px between sections, 80 px up to 1054 px wide (product owner, 2026-10-09). */
const SECTION_GAP = "pt-20 min-[1055px]:pt-26";
const SECTION = cn(HOME_WRAP, SECTION_GAP);
const H2 = "text-[1.875rem] leading-[1.1] md:text-[2.5rem]";
const br = { br: () => <br /> };

/* ----------------------------------------------------------------------------------------- 1 */

export interface HeroFacts {
  templates: number | null;
  /** Every variant of the style library (D-410), which the hero states over the template count. */
  library?: number | null;
  moq: number | null;
}

export async function HomeHero({
  hero,
  photo,
  facts,
}: {
  hero: StudioHero;
  photo: HomePhoto | null;
  facts: HeroFacts;
}) {
  const t = await getTranslations("home.hero");
  const b = { b: (chunks: React.ReactNode) => <b className="font-semibold">{chunks}</b> };
  return (
    <section aria-labelledby="home-title" className={cn(HOME_WRAP, "pt-10 md:pt-16")}>
      <div className="grid items-center gap-10 lg:grid-cols-[4.6fr_7.4fr] lg:gap-12">
        <div>
          <h1 id="home-title" className="text-[2.125rem] leading-[1.1] md:text-5xl lg:text-[2.75rem] xl:text-[3.5rem]">
            {t.rich("title", br)}
          </h1>
          <p className="text-muted mt-5 max-w-[26em] text-[1.0625rem] leading-relaxed md:text-lg">{t("lead")}</p>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Button asChild size="lg">
              <Link href="/studio">{t("start")}</Link>
            </Button>
            <Link href="/studio/upload" className={cn("text-muted hover:text-fg", UNDERLINE)}>
              {t("upload")}
            </Link>
          </div>
          <p className="text-muted mt-4 text-[13px]">
            <span className="hidden lg:inline">{t("caption")}</span>
            <span className="lg:hidden">{t("captionMobile")}</span>
          </p>
          <div
            className={cn(
              "border-border mt-10 grid items-end gap-5 border-t pt-6",
              "grid-cols-[7rem_1fr] sm:grid-cols-[10.5rem_1fr]",
            )}
          >
            {/* The photo cell holds the grid; without a photo it stays an empty sage well. */}
            {photo ? (
              <figure className="bg-sage-subtle aspect-[4/5] overflow-hidden">
                <Photo photo={photo} />
              </figure>
            ) : (
              <div aria-hidden="true" className="bg-sage-subtle aspect-[4/5]" />
            )}
            <div>
              {photo?.caption ? <p className="text-muted mb-4 max-w-[16em] text-[13px]">{photo.caption}</p> : null}
              <ul aria-label={t("facts.label")} className="grid gap-2.5 text-[0.90625rem]">
                {facts.library ? (
                  <li>
                    <Link href="/styles" className={UNDERLINE}>
                      {t.rich("facts.library", { ...b, count: facts.library })}
                    </Link>
                  </li>
                ) : facts.templates !== null ? (
                  <li>{t.rich("facts.templates", { ...b, count: facts.templates })}</li>
                ) : null}
                <li>{t.rich("facts.proof", b)}</li>
                {facts.moq !== null ? <li>{t.rich("facts.moq", { ...b, count: facts.moq })}</li> : null}
              </ul>
            </div>
          </div>
        </div>
        <StudioHeroPanel shapes={hero.shapes} initial={hero.initial} />
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------------------- 2 */

export async function TrustRow() {
  const t = await getTranslations("home.trust");
  const items = ["dieline", "price", "proof", "delivery"] as const;
  return (
    <section aria-label={t("label")} className={cn(HOME_WRAP, "pt-14")}>
      <ul className="border-fg grid gap-6 border-t pt-4 text-[0.90625rem] sm:grid-cols-2 lg:grid-cols-4">
        {items.map((key) => (
          <li key={key}>
            <b className="block font-semibold">{t(`${key}.title`)}</b>
            <span className="text-muted">{t(`${key}.body`)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ----------------------------------------------------------------------------------------- 3 */

/** Five photos of real work, captions under them (never over), describing the object only. */
export async function PhotoMosaic({ photos }: { photos: HomePhoto[] }) {
  const t = await getTranslations("home.mosaic");
  return (
    <section aria-label={t("label")} className="pt-18">
      <ul className="mx-auto grid max-w-[82.5rem] grid-cols-2 gap-x-3 gap-y-1 px-5 md:px-8 lg:grid-cols-[1.5fr_1fr_1fr] lg:grid-rows-[330px_330px] lg:gap-x-4 xl:px-12">
        {photos.map((photo, index) => (
          <li
            key={photo.src}
            className={cn("flex min-h-0 flex-col", index === 0 && "col-span-2 lg:col-span-1 lg:row-span-2")}
          >
            <figure className="flex h-full min-h-0 flex-col">
              <div
                className={cn(
                  "bg-sage-subtle min-h-0 flex-1 overflow-hidden",
                  index === 0 ? "aspect-[4/3] lg:aspect-auto" : "aspect-[4/3] lg:aspect-auto",
                )}
              >
                <Photo photo={photo} />
              </div>
              {photo.caption ? (
                <figcaption className="text-muted pt-2.5 pb-3 text-[13px]">{photo.caption}</figcaption>
              ) : null}
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ----------------------------------------------------------------------------------------- 4 */

export async function TemplateGallery({
  styles,
  total,
  categories,
  photos,
  locale,
  library = null,
}: {
  styles: StyleCard[];
  total: number;
  categories: number;
  /** The library's headline counts (D-410). */
  library?: { variants: number; styles: number } | null;
  photos: Map<string, HomePhoto>;
  locale: string;
}) {
  const [t, tStyles] = await Promise.all([getTranslations("home.templates"), getTranslations("styles")]);
  const words = tStyles as unknown as StylesT;
  if (styles.length === 0) return null;
  const [first, ...rest] = styles;

  const card = (style: StyleCard, big = false) => (
    <TemplateCard
      key={style.code}
      style={style}
      locale={locale}
      big={big}
      photo={photos.get(style.code) ?? null}
      dieline={{ card: styleDieline(style.code, big ? "feature" : "card"), thumb: styleDieline(style.code, "thumb") }}
      meta={`${facetLabel(words, "category", style.category)} · ${facetLabel(words, "materialClass", style.materialClass)}`}
      action={t("start")}
    />
  );

  return (
    <section aria-labelledby="home-templates" className={SECTION}>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <h2 id="home-templates" className={H2}>
          {t("title")}
        </h2>
        <Link href={STYLES_HREF} className={cn("text-[0.90625rem]", UNDERLINE)}>
          {total > 0 ? t("all", { count: total }) : t("allShort")}
        </Link>
      </div>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {card(first!, true)}
        <li className="pe-6 pt-2">
          <p className="max-w-[18em] text-[1.0625rem] leading-relaxed">{t("body")}</p>
          {library ? (
            <>
              <p className="text-muted mt-3.5 text-[13px]">
                {t("library", { count: library.variants, styles: library.styles, categories })}
              </p>
              <Link href="/styles" className={cn("mt-2 inline-block text-[0.90625rem]", UNDERLINE)}>
                {t("libraryLink", { count: library.variants })}
              </Link>
            </>
          ) : total > 0 ? (
            <p className="text-muted mt-3.5 text-[13px]">{t("count", { count: total, categories })}</p>
          ) : null}
        </li>
        {rest.map((style) => card(style))}
        {/* Project A: a pale brand tint carries the offer; the green is the button, not the tile. */}
        <li className="bg-primary-subtle text-fg flex min-h-64 flex-col p-6.5">
          <h3 className="text-2xl leading-tight">{t.rich("custom.title", br)}</h3>
          <p className="text-muted mt-2.5 text-sm leading-relaxed">{t("custom.body")}</p>
          <Button asChild size="md" className="mt-auto self-start">
            <Link href="/account/structural-requests">{t("custom.action")}</Link>
          </Button>
        </li>
      </ul>
    </section>
  );
}

/* ----------------------------------------------------------------------------------------- 5 */

export async function ScreenToFactory({ sample, packing }: { sample: HomePhoto | null; packing: HomePhoto | null }) {
  const t = await getTranslations("home.process");
  const frames = [
    {
      key: "studio",
      picture: (
        <span className="pk-line-grid bg-surface grid size-full place-items-center">
          <svg viewBox="0 0 260 170" className="w-[78%]" role="img" aria-label={t("dielineLabel")}>
            <g fill="var(--color-surface)" stroke="var(--color-print-cut)" strokeWidth={1}>
              <rect x="20" y="45" width="40" height="80" />
              <rect x="60" y="45" width="60" height="80" />
              <rect x="120" y="45" width="40" height="80" />
              <rect x="160" y="45" width="60" height="80" />
              <rect x="220" y="45" width="20" height="80" />
              <path d="M60 45V21q30-8 60 0v24M60 125v24q30 8 60 0v-24M160 45V21q30-8 60 0v24M160 125v24q30 8 60 0v-24" />
            </g>
            <path
              d="M60 45v80M120 45v80M160 45v80M220 45v80M60 45h160M60 125h160"
              fill="none"
              stroke="var(--color-print-fold)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <rect
              x="74"
              y="72"
              width="32"
              height="20"
              rx="1"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth={1}
            />
          </svg>
        </span>
      ),
    },
    {
      key: "proof",
      picture: (
        <span className="bg-bg grid size-full place-items-center">
          <svg viewBox="-150 -120 300 240" className="w-[70%]" role="img" aria-label={t("boxLabel")}>
            <ellipse cx="0" cy="62" rx="110" ry="30" fill="rgb(60 40 20 / 0.14)" />
            <path d="M-103.9 10 L0 70 L0 0 L-103.9 -60 Z" fill="#b8956a" />
            <path d="M0 70 L103.9 10 L103.9 -60 L0 0 Z" fill="#c9a676" />
            <path d="M-103.9 -60 L0 0 L103.9 -60 L0 -120 Z" fill="#dfc39a" />
            <path d="M-51.95 -90 L51.95 -30" fill="none" stroke="rgb(70 45 20 / 0.5)" strokeWidth={1.4} />
            <path d="M-82 -20 L-30 10 L-30 36 L-82 6 Z" fill="none" stroke="#0f5f4e" strokeWidth={1.2} />
            <path d="M-74 -8 L-40 12" fill="none" stroke="#0f5f4e" strokeWidth={2.4} />
            <path d="M-74 2 L-52 15" fill="none" stroke="#0f5f4e" strokeWidth={1.2} />
          </svg>
        </span>
      ),
    },
    { key: "sample", picture: sample ? <Photo photo={sample} /> : <ProcessFallback family="tuck" /> },
    { key: "delivered", picture: packing ? <Photo photo={packing} /> : <ProcessFallback family="shipping" /> },
  ] as const;

  return (
    <section aria-labelledby="home-process" className={SECTION}>
      <div className="mb-8 grid items-end gap-4 lg:grid-cols-2 lg:gap-12">
        <h2 id="home-process" className={H2}>
          {t.rich("title", br)}
        </h2>
        <p className="text-muted max-w-[30em]">{t("lead")}</p>
      </div>
      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {frames.map((frame) => (
          <li key={frame.key} className="border-border bg-surface rounded-card overflow-hidden border">
            <div className="bg-sage-subtle aspect-[4/3] overflow-hidden">{frame.picture}</div>
            <div className="border-border border-t px-4.5 pt-4 pb-4.5">
              <p className="text-primary text-[13px] font-semibold">{t(`${frame.key}.day`)}</p>
              <h3 className="mt-1.5 text-base">{t(`${frame.key}.title`)}</h3>
              <p className="text-muted mt-1 text-[0.84375rem]">{t(`${frame.key}.body`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** A frame without its photo: the product's own line drawing on the sage well — never a stock picture. */
function ProcessFallback({ family }: { family: "tuck" | "shipping" }) {
  return (
    <span className="grid size-full place-items-center">
      <ProductThumb family={family} className="size-28 bg-transparent [&_svg]:max-w-24" />
    </span>
  );
}

/* ----------------------------------------------------------------------------------------- 6 */

/** Customer stories — only with at least three approved in the CMS (`content.server.ts`). */
export async function CustomerCases({ cases }: { cases: CustomerCase[] }) {
  const [t, format] = await Promise.all([getTranslations("home.cases"), getFormat()]);
  return (
    <section aria-labelledby="home-cases" className={SECTION}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
        <h2 id="home-cases" className={H2}>
          {t("title")}
        </h2>
        <Link href="/reviews" className={cn("text-[0.90625rem]", UNDERLINE)}>
          {t("all")}
        </Link>
      </div>
      <ul>
        {cases.map((entry) => (
          <li
            key={`${entry.brand}-${entry.item}`}
            className="border-border grid items-center gap-6 border-t py-6 sm:grid-cols-[12.5rem_1fr]"
          >
            <figure className="bg-sage-subtle aspect-[4/3] overflow-hidden">
              <Photo photo={entry.image} />
            </figure>
            <figure>
              <blockquote className="text-[1.0625rem] leading-normal">
                <q>{entry.quote}</q>
              </blockquote>
              <figcaption className="text-muted mt-2.5 flex flex-wrap gap-x-4.5 gap-y-1 text-[0.84375rem]">
                <b className="text-fg font-semibold">{[entry.brand, entry.province].filter(Boolean).join(" · ")}</b>
                <span>{entry.item}</span>
                {entry.quantity !== null ? (
                  <span>{t("quantity", { count: format.number(entry.quantity) })}</span>
                ) : null}
                {entry.days !== null ? <span>{t("days", { count: entry.days })}</span> : null}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ----------------------------------------------------------------------------------------- 7 */

export async function StudioCapabilities() {
  const [t, format] = await Promise.all([getTranslations("home.capabilities"), getFormat()]);
  const sampleCard = "border-border bg-surface rounded-card flex flex-col gap-3.5 border p-6";
  const sampleTag = <p className="text-muted text-xs">{t("sample")}</p>;
  const warn = (tone: "warning" | "ok", text: string) => (
    <div
      className={cn(
        "rounded-control flex items-start gap-2.5 px-3 py-2.5 text-[13px] leading-snug",
        tone === "warning" ? "bg-warning-subtle text-warning-subtle-fg" : "bg-sage-subtle text-fg",
      )}
    >
      <Icon name={tone === "warning" ? "warning" : "check"} size={18} aria-hidden="true" className="mt-px shrink-0" />
      <span>{text}</span>
    </div>
  );

  return (
    <section aria-labelledby="home-capabilities" className={SECTION}>
      <div className="mb-9 grid items-end gap-4 lg:grid-cols-2 lg:gap-12">
        <h2 id="home-capabilities" className={H2}>
          {t.rich("title", br)}
        </h2>
        <p className="text-muted max-w-[30em]">{t("lead")}</p>
      </div>
      <ul className="border-border grid gap-5 border-t pt-6 md:grid-cols-3">
        <li className={sampleCard}>
          {sampleTag}
          {warn("warning", t("checks.lowRes"))}
          {warn("warning", t("checks.fold"))}
          {warn("ok", t("checks.colour"))}
          <div className="mt-auto pt-2">
            <h3 className="text-xl">{t("checks.title")}</h3>
            <p className="text-muted mt-1.5 text-sm">{t("checks.body")}</p>
          </div>
        </li>
        <li className={sampleCard}>
          {sampleTag}
          <div className="border-border rounded-control overflow-hidden border text-[13px]">
            <div className="grid grid-cols-3 text-center">
              {(
                [
                  [300, "9.40"],
                  [500, "7.83"],
                  [1000, "6.10"],
                ] as const
              ).map(([pieces, price], index) => (
                <div
                  key={pieces}
                  className={cn(
                    "border-border px-1.5 py-2.5",
                    index < 2 && "border-e",
                    index === 1 && "bg-sage-subtle",
                  )}
                >
                  <div className="text-muted text-xs">{t("cost.pieces", { count: format.number(pieces) })}</div>
                  <b className="font-semibold">{format.thb(price)}</b>
                </div>
              ))}
            </div>
            <div className="border-border flex justify-between border-t px-3 py-2.5">
              <span className="text-muted">{t("cost.board")}</span>
              <b className="text-primary font-semibold">+{format.thb("0.60")}</b>
            </div>
            <div className="border-border flex justify-between border-t px-3 py-2.5">
              <span className="text-muted">{t("cost.foil")}</span>
              <b className="text-primary font-semibold">+{format.thb("1.90")}</b>
            </div>
          </div>
          <div className="mt-auto pt-2">
            <h3 className="text-xl">{t("cost.title")}</h3>
            <p className="text-muted mt-1.5 text-sm">{t("cost.body")}</p>
          </div>
        </li>
        <li className={sampleCard}>
          {sampleTag}
          <div className="border-border rounded-control grid gap-2.5 border px-3.5 py-3 text-[13px]">
            {(
              [
                ["owner", "bg-sage text-fg-inverse"],
                ["designer", "bg-sage-subtle text-fg"],
              ] as const
            ).map(([who, tone]) => (
              <div key={who} className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-6.5 flex-none place-items-center rounded-full text-[11px] font-semibold",
                    tone,
                  )}
                >
                  {t(`team.${who}Name`).slice(0, who === "owner" ? 2 : 3)}
                </span>
                <div>
                  <b className="font-semibold">{t(`team.${who}Name`)}</b>
                  <div className="text-muted">{t(`team.${who}Says`)}</div>
                </div>
              </div>
            ))}
            <div className="border-border flex gap-2 border-t pt-2">
              {["v1", "v2"].map((version) => (
                <span
                  key={version}
                  className="border-border rounded-control text-muted inline-flex h-6.5 items-center border px-2 text-xs"
                >
                  {version}
                </span>
              ))}
              <span className="border-fg rounded-control inline-flex h-6.5 items-center border px-2 text-xs font-semibold">
                {t("team.latest")}
              </span>
            </div>
          </div>
          <div className="mt-auto pt-2">
            <h3 className="text-xl">{t("team.title")}</h3>
            <p className="text-muted mt-1.5 text-sm">{t("team.body")}</p>
          </div>
        </li>
      </ul>
    </section>
  );
}

/* ----------------------------------------------------------------------------------------- 8 */

export async function QualityBand({ photo, claimDays }: { photo: HomePhoto | null; claimDays: number | null }) {
  const t = await getTranslations("home.quality");
  const facts = claimDays !== null ? t("factsClaim", { days: claimDays }) : t("factsNone");
  const shortcut =
    "border-border bg-surface text-fg rounded-card block border p-4.5 outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-focus-ring";
  // Project A: a light band (the pale brand tint) in light mode, never a full-width dark block.
  return (
    <section aria-labelledby="home-quality" className="bg-primary-subtle text-fg mt-20 min-[1055px]:mt-26">
      {/* Photo | content on large screens, always: without a photo the left cell is an empty panel.
          Content takes 56% so the title keeps to two lines from 1024px up (its second line is ~557px
          at 36px, ~495px at 32px). */}
      <div className="grid lg:grid-cols-[44fr_56fr]">
        {photo ? (
          <figure className="relative min-h-72 overflow-hidden lg:min-h-[520px]">
            <Photo photo={photo} className="absolute inset-0" />
          </figure>
        ) : (
          <div aria-hidden="true" className="bg-sage-subtle hidden lg:block lg:min-h-[520px]" />
        )}
        {/* The title keeps to two lines — its one break is the copy's: 32px with tighter gutters up to
            1279px, 36px from 1280px. */}
        <div className="w-full max-w-[45rem] px-5 py-14 md:px-8 lg:py-20 lg:ps-10 lg:pe-8 xl:ps-18 xl:pe-12">
          <h2
            id="home-quality"
            className="text-fg max-w-[18em] text-start text-[1.75rem] leading-[1.15] md:text-[2rem] xl:text-[2.25rem]"
          >
            {t.rich("title", br)}
          </h2>
          <p className="text-muted mt-4.5 max-w-[30em]">{t("body")}</p>
          <ul className="mt-8 grid max-w-[45rem] gap-4 sm:grid-cols-2">
            {(
              [
                ["upload", "/studio/upload"],
                ["business", "/business"],
              ] as const
            ).map(([key, href]) => (
              <li key={key}>
                <Link href={href} className={shortcut}>
                  <b className="block text-base font-semibold">{t(`${key}.title`)}</b>
                  <span className="text-muted mt-1 block text-[0.84375rem]">{t(`${key}.body`)}</span>
                  <span className={cn("text-primary mt-3 inline-flex items-center gap-1 text-[0.84375rem]", UNDERLINE)}>
                    {t(`${key}.go`)}
                    <Icon name="arrow-right" size={14} aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="border-border text-muted mt-9 max-w-[45rem] border-t pt-6 text-[0.9375rem]">{facts}</p>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------------------- 9 */

/** Product types that are not a packaging range (getpack-api `prisma/seed/data/catalog.ts`). */
const NOT_A_RANGE = new Set(["standard_product", "service"]);

/** A category the home page lists: one with at least one packaging type in it. */
export const isPackagingCategory = (category: CatalogueCategory): boolean =>
  category.types.some((type) => !NOT_A_RANGE.has(type.code));

/**
 * The four categories the row leads with, in the "Main" board's order: the ranges a small brand buys
 * first. Ones the catalogue does not list are skipped and the next categories fill the row.
 */
const HOME_CATEGORY_CODES = ["folding_carton", "corrugated", "paper_bag", "label_sticker"];

export async function ProductRows({
  categories,
  photos,
  locale,
}: {
  categories: CatalogueCategory[];
  /** CMS photos by category code (`home-photos.categories`); a category without one keeps its drawing. */
  photos: Map<string, HomePhoto>;
  locale: string;
}) {
  const [t, format] = await Promise.all([getTranslations("home.products"), getFormat()]);
  const curated = HOME_CATEGORY_CODES.flatMap((code) => categories.filter((category) => category.code === code));
  const shown = [...curated, ...categories.filter((category) => !curated.includes(category))].slice(0, 4);
  if (shown.length === 0) return null;
  return (
    <section aria-labelledby="home-products" className={SECTION}>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <h2 id="home-products" className="text-[1.75rem] leading-[1.1] md:text-[2.125rem]">
          {t("title")}
        </h2>
        <Link href="/products" className={cn("text-[0.90625rem]", UNDERLINE)}>
          {t("all", { count: categories.length })}
        </Link>
      </div>
      <ul className="grid gap-x-5 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map((category) => {
          // "From": the lowest starting price any of its types states — compared, never computed.
          const price = category.types
            .map((type) => type.startingPricePerPiece)
            .filter((value): value is string => value !== null)
            .sort(compareDecimal)[0];
          const moqs = category.types.map((type) => type.moq).filter((value): value is number => value !== null);
          const moq = moqs.length ? Math.min(...moqs) : null;
          const line = price
            ? [t("from", { price: format.thb(price) }), moq !== null ? t("moq", { count: format.number(moq) }) : null]
                .filter(Boolean)
                .join(" · ")
            : t("rfq");
          return (
            <li key={category.code}>
              <Link
                href={categoryHref(category.code)}
                className="border-border hover:text-primary grid grid-cols-[4.5rem_1fr] items-center gap-3.5 border-t py-4"
              >
                {photos.get(category.code) ? (
                  <figure className="bg-sage-subtle size-18 overflow-hidden">
                    <Photo photo={{ ...photos.get(category.code)!, alt: "" }} />
                  </figure>
                ) : (
                  <ProductThumb
                    family={productFamilyOf(category.code)}
                    className="size-18 rounded-none [&_svg]:max-w-14"
                  />
                )}
                <span>
                  <b className="block text-[0.9375rem] font-semibold">
                    {pick(locale, category.nameTh, category.nameEn)}
                  </b>
                  <span className="text-muted text-[13px]">{line}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------------------------------------------------------------------------------------- 10 */

export async function HomeFaq({ groups, locale, hours }: { groups: FaqGroup[]; locale: string; hours: string | null }) {
  const t = await getTranslations("home.faq");
  // General questions first (no category), then the rest, four in all.
  const faqs = [...groups]
    .sort((a, b) => Number(a.categoryCode !== null) - Number(b.categoryCode !== null))
    .flatMap((group) => group.faqs)
    .slice(0, 4);
  if (faqs.length === 0) return null;
  return (
    <section aria-labelledby="home-faq" className={SECTION}>
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <div>
          <h2 id="home-faq" className="text-[1.75rem] leading-[1.1] md:text-[2.125rem]">
            {t.rich("title", br)}
          </h2>
          <p className="text-muted mt-3.5 max-w-[22em]">{hours ? t("leadHours", { hours }) : t("lead")}</p>
          <Link href="/faq" className={cn("mt-4 inline-block text-[0.90625rem]", UNDERLINE)}>
            {t("all")}
          </Link>
        </div>
        <dl>
          {faqs.map((faq, index) => (
            <div
              key={faq.questionTh}
              className={cn(
                "border-border py-5.5",
                index === 0 ? "pt-0" : "border-t",
                index === faqs.length - 1 && "border-b",
              )}
            >
              <dt className="text-[1.0625rem] font-semibold">{pick(locale, faq.questionTh, faq.questionEn)}</dt>
              <dd className="text-muted mt-2 max-w-[34em] text-[0.90625rem]">
                {pick(locale, faq.answerTh, faq.answerEn)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export async function HomeContact({ channels }: { channels: SupportChannels | null }) {
  const [t, tNews] = await Promise.all([getTranslations("home.contact"), getTranslations("home.newsletter")]);
  return (
    <section aria-labelledby="home-contact" className={SECTION}>
      <div className="border-fg grid items-start gap-10 border-t pt-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
        <div>
          <h2 id="home-contact" className="text-[1.75rem] leading-[1.1] md:text-[2.125rem]">
            {t.rich("title", br)}
          </h2>
          <p className="text-muted mt-3.5 max-w-[26em]">
            {channels?.hours ? t("leadHours", { hours: channels.hours }) : t("lead")}
          </p>
          <div className="mt-5.5 flex flex-wrap items-center gap-x-5 gap-y-3">
            {channels?.lineOaId ? (
              <Button asChild size="lg" iconStart="chat">
                <a href={`https://line.me/R/ti/p/${encodeURIComponent(channels.lineOaId)}`} rel="noopener">
                  {t("line")}
                </a>
              </Button>
            ) : (
              <Button asChild size="lg" iconStart="chat">
                <Link href="/help/chat">{t("chat")}</Link>
              </Button>
            )}
            {channels?.phone ? (
              <a href={`tel:${channels.phone.replace(/[^\d+]/g, "")}`} className={cn("text-[0.90625rem]", UNDERLINE)}>
                {t("phone", { phone: channels.phone })}
              </a>
            ) : null}
          </div>
        </div>
        <div>
          <h3 className="text-[1.0625rem]">{tNews("heading")}</h3>
          <p className="text-muted mt-1.5 text-[13px]">{tNews("body")}</p>
          <NewsletterForm />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------------------- stock */

/** How many stock types the shelf offers as chips (the most stocked first). */
const SHELF_TYPES = 6;

/**
 * "สินค้าพร้อมส่ง สั่งได้ทันที" (product owner, 2026-10-17): the stock range on the home page, so a
 * customer who needs mailers or bottles this week orders them in one tap. A varied first row —
 * the items are taken in turn from each stock type, not eight of one — chips by type (each with
 * its whole range), the price at the minimum on every card and "ใส่ตะกร้า" at that minimum
 * (`StockShelf`). Out-of-stock items are left off: the shelf is what can be bought now.
 */
export async function StockShelfSection({
  items,
  total,
  signedIn,
  instant,
}: {
  items: StockProduct[];
  total: number;
  signedIn: boolean;
  /** `standard_product` prices instantly; otherwise the cards ask for a price. */
  instant: boolean;
}) {
  const [t, tCatalog, format, locale] = await Promise.all([
    getTranslations("home.stock"),
    getTranslations("catalog.stock"),
    getFormat(),
    getLocale(),
  ]);
  const typeOf = (product: StockProduct) =>
    product.attributes.find((attribute) => attribute.attribute === "type") ?? null;
  const available = items.filter((product) => product.inStock && typeOf(product));
  if (available.length === 0) return null;

  // Round-robin across types, the most stocked first, so the first eight cards are not all one kind.
  const byType = new Map<string, StockProduct[]>();
  for (const product of available) {
    const name = pick(locale, typeOf(product)!.nameTh, typeOf(product)!.nameEn);
    byType.set(name, [...(byType.get(name) ?? []), product]);
  }
  const queues = [...byType.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, list]) => ({ name, list: [...list] }));
  const ordered: { product: StockProduct; type: string }[] = [];
  while (queues.some((queue) => queue.list.length > 0)) {
    for (const queue of queues) {
      const next = queue.list.shift();
      if (next) ordered.push({ product: next, type: queue.name });
    }
  }
  const shelfItems: ShelfItem[] = ordered.map(({ product, type }) => {
    const unit = tCatalog(`units.${product.unit}`);
    return {
      id: product.id,
      sku: product.sku,
      href: stockProductHref(product.sku),
      name: pick(locale, product.nameTh, product.nameEn),
      type,
      image: storeImageSrc(product.imageUrls[0], "thumb"),
      unit,
      minimum: tCatalog("minOrder", { quantity: format.number(product.minOrderQty), unit }),
      minOrderQty: product.minOrderQty,
      addLabel: t("add", { quantity: format.number(product.minOrderQty), unit }),
    };
  });
  const types = queues
    .slice(0, SHELF_TYPES)
    .map((queue) => ({ name: queue.name, count: byType.get(queue.name)!.length }));

  return (
    <section aria-labelledby="home-stock" className={SECTION}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2 id="home-stock" className={H2}>
            {t(instant ? "title" : "titleQuote")}
          </h2>
          <p className="text-muted mt-3 text-[1.0625rem] leading-relaxed">{t(instant ? "body" : "bodyQuote")}</p>
        </div>
        <Link href="/products#catalogue-stock" className={cn("text-[0.90625rem]", UNDERLINE)}>
          {t("all", { count: format.number(total) })}
        </Link>
      </div>
      <StockShelf items={shelfItems} types={types} signedIn={signedIn} instant={instant} />
    </section>
  );
}
