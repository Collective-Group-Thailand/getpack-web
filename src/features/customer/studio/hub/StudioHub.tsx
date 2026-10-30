import { getTranslations } from "next-intl/server";

import { DesignThumb } from "@/features/customer/account/DesignThumb";
import type { StyleCard } from "@/features/customer/catalog/api.server";
import { storeImageSrc } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import type { MyDesign } from "@/features/customer/designer/api.server";
import { HOME_WRAP } from "@/features/customer/home/parts";
import type { HeroShape, StudioHero } from "@/features/customer/home/studio-hero.server";
import { styleDieline } from "@/features/customer/home/style-dielines.server";
import { facetLabel, type StylesT } from "@/features/customer/styles/labels";
import { STYLES_HREF } from "@/features/customer/styles/paths";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { sampleHref } from "../paths";
import { HeroMiniEditor } from "./HeroMiniEditor";
import { DraftLink, DuplicateDesign, FileDrop, OpenStyleButton, PathLink, SampleLink } from "./HubActions";
import { ProductFinder } from "./ProductFinder";

const FEATURES: { key: string; icon: IconName }[] = [
  { key: "dieline", icon: "box" },
  { key: "images", icon: "image" },
  { key: "fonts", icon: "text" },
  { key: "price", icon: "zap" },
  { key: "ai", icon: "download" },
  { key: "team", icon: "chat" },
];
const PROOFS = ["free", "fonts", "ai"] as const;
const SECTION = "scroll-mt-24 pt-14 md:pt-16";

export interface StudioHubProps {
  locale: string;
  signedIn: boolean;
  hero: StudioHero;
  /** The style library's size (`meta.libraryStyles`, the number /styles and the home page show), null when unknown. */
  libraryStyles: number | null;
  /** Up to four styles whose real pictures illustrate "เลือกแบบกล่อง". */
  pictured: StyleCard[];
  /** "แบบที่คนเริ่มบ่อย" (D-455); empty → the section is hidden. */
  featured: StyleCard[];
  designs: MyDesign[];
  designTotal: number;
  /** Whether the customer has orders to reorder from ("สั่งซ้ำ" shows only then). */
  hasOrders: boolean;
  /** `?product=` carried from an old link: the finder opens its suggestions on that product. */
  productSlug: string | null;
}

/**
 * `/studio` — getpack Studio's one front door (studio redesign Phase 1): a dark stage band with a working mini editor,
 * the ways in as a bento (choose a box · I have the product → the inline finder · I have a file → the upload flow ·
 * reorder only with orders), the finder, what the studio does, the styles admins feature (D-455) and the
 * customer's latest designs. `/studio/new` with nothing to draw lands here (C7, `hub-redirect.ts`).
 */
export async function StudioHub(props: StudioHubProps) {
  const { locale, signedIn, hero, libraryStyles, pictured, featured, designs, designTotal, hasOrders } = props;
  const [t, tStyles, format] = await Promise.all([
    getTranslations("studio.home"),
    getTranslations("styles"),
    getFormat(),
  ]);
  const words = tStyles as unknown as StylesT;
  const shape: HeroShape | null =
    hero.shapes.find((entry) => entry.id === hero.initial?.selection.shape) ?? hero.shapes[0] ?? null;
  const sample = sampleHref(props.productSlug);
  const reorderHref = signedIn ? "/account/orders" : `/sign-in?returnTo=${encodeURIComponent("/account/orders")}`;
  const card =
    "group bg-surface border-border rounded-panel duration-base ease-standard relative flex flex-col gap-2.5 overflow-hidden border p-6 transition-[border-color,translate] hover:border-primary motion-safe:hover:-translate-y-0.5";
  const go = "text-primary mt-auto inline-flex items-center gap-1.5 text-[14.5px] font-semibold";
  const num = "text-muted text-xs font-medium tracking-[0.06em] tabular-nums";
  const statusOf = (design: MyDesign) =>
    design.orders[0]
      ? t("status.ordered", { code: design.orders[0].orderCode })
      : design.lengthMm === null || design.widthMm === null
        ? t("status.size")
        : t("status.ready");

  return (
    <>
      {/* The stage band (Project A): light in the light theme like the rest of the storefront — the page's own
          surface with a hairline under it, the mini editor as the one picture; dark mode follows the tokens. */}
      <section aria-labelledby="studio-hero" className="bg-surface border-border text-fg border-b">
        <div
          className={cn(
            HOME_WRAP,
            "grid items-center gap-8 py-10 md:py-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12",
          )}
        >
          <div>
            <h1
              id="studio-hero"
              className="text-[2.25rem] leading-[1.08] font-bold tracking-[-0.03em] text-balance md:text-[3.25rem] xl:text-[3.75rem]"
            >
              {t("hero.titleStart")} <em className="text-primary not-italic">{t("hero.titleEm")}</em>{" "}
              {t("hero.titleEnd")}
            </h1>
            <p className="text-muted mt-4 max-w-[46ch] text-[16.5px]">
              <span className="hidden lg:inline">{t("hero.lede")}</span>
              <span className="lg:hidden">{t("hero.ledeNarrow")}</span>
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Button asChild size="lg">
                <a href="#paths">{t("hero.start")}</a>
              </Button>
              <SampleLink href={sample} look={{ size: "lg", variant: "secondary" }}>
                <Icon name="sparkles" size={18} aria-hidden="true" />
                {t("hero.sample")}
              </SampleLink>
            </div>
            <ul className="text-muted mt-5 flex flex-wrap gap-x-4.5 gap-y-2 text-[13px]">
              {PROOFS.map((proof) => (
                <li key={proof} className="inline-flex items-center gap-1.5">
                  <Icon name="check" size={16} aria-hidden="true" className="text-primary" />
                  {t(`hero.proofs.${proof}`)}
                </li>
              ))}
            </ul>
          </div>
          <HeroMiniEditor shape={shape} initial={hero.initial} />
        </div>
      </section>

      <div className={cn(HOME_WRAP, "pb-16 md:pb-20")}>
        <section id="paths" aria-labelledby="studio-paths" className={SECTION}>
          <div className="mb-5">
            <h2 id="studio-paths" className="text-[1.625rem] leading-tight font-semibold">
              {t("paths.title")}
            </h2>
            <p className="text-muted mt-1.5 text-[14.5px]">{t("paths.lead")}</p>
          </div>
          <div className="grid gap-3.5 lg:grid-cols-6 lg:grid-rows-[minmax(150px,auto)_minmax(150px,auto)]">
            <PathLink
              path="box"
              href={STYLES_HREF}
              className={cn(card, "bg-primary-subtle lg:col-span-4 lg:row-span-2")}
            >
              <span className={num}>{t("paths.box.num")}</span>
              <b className="text-[1.375rem] leading-tight font-semibold">{t("paths.box.title")}</b>
              <p className="text-muted max-w-[40ch] text-[14.5px]">
                {libraryStyles
                  ? t("paths.box.body", { count: format.number(libraryStyles) })
                  : t("paths.box.bodyNoCount")}
              </p>
              {pictured.length > 0 ? (
                <span aria-hidden="true" className="my-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {pictured.map((style) => (
                    <StylePicture key={style.code} style={style} className="aspect-square" />
                  ))}
                </span>
              ) : null}
              <span className={go}>
                {t("paths.box.go")}
                <Icon name="arrow-right" size={15} aria-hidden="true" />
              </span>
            </PathLink>
            <PathLink path="product" href="#finder" className={cn(card, "lg:col-span-2")}>
              <span className={num}>{t("paths.product.num")}</span>
              <b className="text-[1.375rem] leading-tight font-semibold">{t("paths.product.title")}</b>
              <p className="text-muted text-[14.5px]">{t("paths.product.body")}</p>
              <span className={go}>
                {t("paths.product.go")}
                <Icon name="arrow-right" size={15} aria-hidden="true" />
              </span>
            </PathLink>
            <div className={cn(card, "lg:col-span-2")}>
              <span className={num}>{t("paths.file.num")}</span>
              <PathLink
                path="file"
                href="/studio/upload"
                className="text-[1.375rem] leading-tight font-semibold hover:underline"
              >
                {t("paths.file.title")}
              </PathLink>
              <p className="text-muted text-[14.5px]">{t("paths.file.body")}</p>
              <FileDrop label={t("paths.file.drop")} />
            </div>
            {hasOrders ? (
              <PathLink path="reorder" href={reorderHref} className={cn(card, "lg:col-span-6")}>
                <span className={num}>{t("paths.reorder.num")}</span>
                <b className="text-[1.375rem] leading-tight font-semibold">{t("paths.reorder.title")}</b>
                <p className="text-muted text-[14.5px]">{t("paths.reorder.body")}</p>
                <span className={go}>
                  {t("paths.reorder.go")}
                  <Icon name="arrow-right" size={15} aria-hidden="true" />
                </span>
              </PathLink>
            ) : null}
          </div>
        </section>

        <div className={SECTION}>
          <ProductFinder productSlug={props.productSlug} />
        </div>

        <section aria-labelledby="studio-features" className={SECTION}>
          <h2 id="studio-features" className="mb-5 text-[1.625rem] leading-tight font-semibold">
            {t("features.title")}
          </h2>
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <li key={feature.key} className="border-border bg-surface rounded-card flex gap-3.5 border p-4.5">
                <span className="bg-bg-subtle text-muted rounded-control grid size-9.5 shrink-0 place-items-center">
                  <Icon name={feature.icon} size={20} aria-hidden="true" />
                </span>
                <span>
                  <b className="block text-[15.5px] font-semibold">{t(`features.${feature.key}.title`)}</b>
                  <small className="text-muted text-[13.5px]">{t(`features.${feature.key}.body`)}</small>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {featured.length > 0 ? (
          <section aria-labelledby="studio-popular" className={SECTION}>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="studio-popular" className="text-[1.625rem] leading-tight font-semibold">
                  {t("popular")}
                </h2>
                <p className="text-muted mt-1.5 text-[14.5px]">{t("popularLead")}</p>
              </div>
              <Button asChild variant="secondary">
                <Link href={STYLES_HREF}>{t("allTemplates")}</Link>
              </Button>
            </div>
            <ul className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
              {featured.map((style) => {
                const name = pick(locale, style.nameTh, style.nameEn);
                return (
                  <li
                    key={style.code}
                    className="border-border bg-surface rounded-card relative flex flex-col overflow-hidden border"
                  >
                    <StylePicture style={style} className="aspect-[4/3] rounded-none border-0" />
                    <div className="flex flex-col gap-0.5 px-3.5 pt-3 pb-3.5">
                      <b className="text-[14.5px] leading-snug font-semibold">{name}</b>
                      <small className="text-muted text-xs">
                        {[
                          facetLabel(words, "category", style.category),
                          facetLabel(words, "materialClass", style.materialClass),
                        ].join(" · ")}
                      </small>
                      <OpenStyleButton
                        code={style.code}
                        name={name}
                        productSlug={style.startingPrice?.catalogProductSlug ?? null}
                        label={t("openInStudio")}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="studio-recent" className={SECTION}>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <h2 id="studio-recent" className="text-[1.625rem] leading-tight font-semibold">
              {t("recent")}
            </h2>
            {designTotal > designs.length ? (
              <Link href="/account/designs" className="border-b border-current pb-px text-sm font-medium">
                {t("recentAll", { count: designTotal })}
              </Link>
            ) : null}
          </div>
          {signedIn && designs.length > 0 ? (
            <ul className="border-border bg-surface rounded-card divide-border divide-y border">
              {designs.map((design) => (
                <li
                  key={design.id}
                  className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3.5 p-3.5 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto]"
                >
                  <span className="border-border bg-bg-subtle rounded-thumb grid h-14 w-18 place-items-center overflow-hidden border">
                    <DesignThumb fileId={design.thumbnailFileId} empty="" />
                  </span>
                  <span className="min-w-0">
                    <b className="block truncate text-[15px] font-semibold">{design.title}</b>
                    <small className="text-muted mt-0.5 block text-[12.5px]">
                      {[
                        t("edited", { when: format.relative(design.updatedAt) }),
                        design.versionNo !== null ? t("version", { n: design.versionNo }) : null,
                        statusOf(design),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                  <span className="col-span-2 flex gap-2 sm:col-span-1">
                    <DraftLink href={`/studio/${design.id}`} look={{ size: "sm", variant: "secondary" }}>
                      {t("open")}
                    </DraftLink>
                    <DuplicateDesign id={design.id} name={design.title} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="border-border-strong bg-surface rounded-card grid gap-4 border border-dashed px-5.5 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <b className="block text-base font-semibold">{t("recentNoneTitle")}</b>
                <small className="text-muted text-sm">
                  {signedIn
                    ? t("recentNone")
                    : t.rich("recentGuest", {
                        signIn: (chunks) => (
                          <Link
                            href={`/sign-in?returnTo=${encodeURIComponent("/studio")}`}
                            className="text-fg border-b border-current font-medium"
                          >
                            {chunks}
                          </Link>
                        ),
                      })}
                </small>
              </div>
              <SampleLink href={sample} look={{ variant: "secondary" }}>
                {t("trySample")}
              </SampleLink>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

/**
 * A style's real picture: its library photo, else its rendered 3D thumbnail, else its flat dieline drawn by the
 * engine — never an illustration made for the page.
 */
function StylePicture({ style, className }: { style: StyleCard; className?: string }) {
  const photo = storeImageSrc(style.photo?.url, "thumb");
  const src = photo ?? style.thumbnailUrl ?? styleDieline(style.code, "card")?.src ?? null;
  return (
    <span className={cn("border-border bg-bg rounded-card block overflow-hidden border", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- an API image or an inline SVG data URI
        <img
          src={src}
          alt=""
          width={240}
          height={180}
          loading="lazy"
          className={cn("size-full", photo ? "object-cover" : "object-contain p-[10%]")}
        />
      ) : null}
    </span>
  );
}
