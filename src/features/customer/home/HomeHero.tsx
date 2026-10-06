import { getTranslations } from "next-intl/server";

import type { Banner } from "@/features/customer/catalog/api.server";
import { storeImageSrc } from "@/features/customer/catalog/images";
import { BoxPreview } from "@/features/designer/components/BoxPreview";
import { CANVAS_COLORS } from "@/features/designer/canvas-colors";
import { Link } from "@/i18n/navigation";
import { BRAND_TAGLINE } from "@/ui/brand";
import { Button } from "@/ui/components/Button";
import { Highlight, IconTile } from "@/ui/components/Decor";
import { Icon, type IconName } from "@/ui/icons";

import { QuickStart } from "./QuickStart";

/**
 * Home §1: the value proposition, two ways in, four things Packio can back, one picture — and the
 * quick quote, a card that overlaps the hero's bottom edge. The picture is the admin's
 * `home_hero` banner when there is one (the LCP), otherwise a real tuck-end dieline from
 * `@packio/dieline` on the designer's dotted canvas — the product itself, not a stock photo.
 */
export async function HomeHero({
  banner,
  products,
}: {
  banner: Banner | undefined;
  products: { slug: string; name: string }[];
}) {
  const t = await getTranslations("home");
  const checks = ["instant", "dieline", "proof", "tax"] as const;

  return (
    <>
      <section className="bg-bg pk-hero-wash relative overflow-hidden pt-12 pb-24 md:pt-20 md:pb-32">
        <div className="max-w-content mx-auto grid items-center gap-12 px-5 md:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div>
            <p className="bg-primary-subtle text-primary-subtle-fg border-primary/20 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold">
              <span aria-hidden className="bg-primary ring-primary/20 size-1.5 rounded-full ring-4" />
              {BRAND_TAGLINE}
            </p>
            <h1 className="font-display mt-5 text-[2.5rem] leading-[1.15] font-bold tracking-tight sm:text-5xl lg:text-[4rem] lg:leading-[1.1]">
              {t("hero.titleLine1")}
              <br />
              <Highlight className="text-primary">{t("hero.titleLine2")}</Highlight>
            </h1>
            <p className="text-muted mt-5 max-w-[30em] text-lg leading-relaxed md:text-xl">{t("hero.lead")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" iconEnd="arrow-right" className="rounded-xl">
                <Link href="/products">{t("hero.price")}</Link>
              </Button>
              <Button asChild size="lg" variant="secondary" iconStart="pen-tool" className="border-border rounded-xl">
                <Link href="/studio/new">{t("hero.design")}</Link>
              </Button>
            </div>
            <ul className="mt-9 grid gap-x-8 gap-y-3 sm:grid-cols-[repeat(2,max-content)]">
              {checks.map((key) => (
                <CheckItem key={key}>{t(`hero.checks.${key}`)}</CheckItem>
              ))}
            </ul>
          </div>

          {banner ? <HeroBanner banner={banner} /> : <HeroDieline label={t("hero.preview")} />}
        </div>
      </section>

      {/* Home §1b: the quick quote, overlapping the hero. */}
      <section className="max-w-content relative z-10 mx-auto -mt-16 px-5 md:px-8">
        <QuickStart products={products} />
      </section>
    </>
  );
}

/** A tick and a line, for the short "what you get" lists on the home page. */
export function CheckItem({ children, inverse = false }: { children: React.ReactNode; inverse?: boolean }) {
  return (
    <li className={`flex items-center gap-2.5 ${inverse ? "text-fg-inverse/85" : "text-muted"}`}>
      <span
        aria-hidden
        className={`grid size-5 shrink-0 place-items-center rounded-full ${
          inverse ? "bg-fg-inverse/15 text-fg-inverse" : "bg-primary-subtle text-primary"
        }`}
      >
        <Icon name="check" size={13} strokeWidth={3} />
      </span>
      {children}
    </li>
  );
}

async function HeroDieline({ label }: { label: string }) {
  const t = await getTranslations("home.hero");
  return (
    <div className="border-border bg-surface pk-dot-grid shadow-overlay relative aspect-[5/4] overflow-hidden rounded-2xl border">
      <div className="absolute inset-x-[9%] top-[18%] bottom-[20%]">
        <BoxPreview styleId="tuck-end" values={{ length: 70, width: 40, height: 110 }} label={label} />
      </div>
      <FloatingNote
        className="start-4 top-4 sm:start-5 sm:top-5"
        icon="ruler"
        title={t("noteSize")}
        body={t("noteSizeBody")}
      />
      <FloatingNote
        className="end-4 bottom-4 hidden sm:end-5 sm:bottom-5 sm:flex"
        icon="file-check"
        tone="kraft"
        title={t("noteProof")}
        body={t("noteProofBody")}
      />
      <div className="text-muted absolute start-5 bottom-5 flex gap-3.5 text-xs sm:start-6 sm:bottom-6">
        <span className="flex items-center gap-1.5">
          <i aria-hidden className="w-4.5 border-t-2" style={{ borderColor: CANVAS_COLORS.cut }} />
          {t("legendCut")}
        </span>
        <span className="flex items-center gap-1.5">
          <i aria-hidden className="w-4.5 border-t-2 border-dashed" style={{ borderColor: CANVAS_COLORS.fold }} />
          {t("legendFold")}
        </span>
      </div>
    </div>
  );
}

function FloatingNote({
  icon,
  title,
  body,
  tone = "primary",
  className,
}: {
  icon: IconName;
  title: string;
  body: string;
  tone?: "primary" | "kraft";
  className?: string;
}) {
  return (
    <div
      className={`border-border bg-surface shadow-overlay absolute flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 ${className ?? ""}`}
    >
      <IconTile name={icon} tone={tone} size="sm" />
      <span className="leading-tight">
        <b className="block text-sm">{title}</b>
        <small className="text-muted text-xs">{body}</small>
      </span>
    </div>
  );
}

/**
 * A banner's target is an admin-entered path; only a path inside the site becomes a link, and
 * it is not prefetched — nothing guarantees the page exists, and a prefetch that 404s holds its
 * socket open (see `ComingSoon`).
 */
function bannerTarget(url: string | null): string | null {
  if (!url || !url.startsWith("/") || url.startsWith("//")) return null;
  // Admins enter paths with a locale prefix ("/th/products/…"); the router adds the locale.
  return url.replace(/^\/(th|en)(?=\/|$)/, "") || "/";
}

function HeroBanner({ banner }: { banner: Banner }) {
  const src = storeImageSrc(banner.desktopImageUrl);
  const target = bannerTarget(banner.targetUrl);
  if (!src) return null;
  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- API-origin image (see ProductCard)
    <img
      src={src}
      alt={banner.title}
      width={1200}
      height={960}
      fetchPriority="high"
      className="border-border shadow-overlay aspect-[5/4] w-full rounded-2xl border object-cover"
    />
  );
  return target ? (
    <Link
      href={target}
      prefetch={false}
      className="focus-visible:ring-focus-ring block rounded-2xl outline-none focus-visible:ring-2"
    >
      {image}
    </Link>
  ) : (
    image
  );
}
