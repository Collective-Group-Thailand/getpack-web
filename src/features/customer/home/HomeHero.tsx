import { getTranslations } from "next-intl/server";

import { storeImageSrc } from "@/features/customer/catalog/images";
import { Link } from "@/i18n/navigation";
import type { Banner } from "@/features/customer/catalog/api.server";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";

import { HeroStillLife } from "./HeroStillLife";
import { QuickStart } from "./QuickStart";


/** The figures under the hero's buttons — each one the API's, or left out. */
export interface HeroFacts {
  /** Categories the catalogue offers. */
  categories: number;
  /** The shortest lead time any product states, in business days. */
  fastestDays: number | null;
}

/**
 * Home §1 to the "Main" board (design language v2): the eyebrow, the serif title with its italic
 * accent, two pill buttons, three figures over a hairline, the still life on the right — or the
 * admin's `home_hero` banner when there is one — and the quick quote as a paper slip under it.
 * Every figure is the API's (D-181); the third, "every job proofed before production", is how
 * Packio works, not a statistic.
 */
export async function HomeHero({
  banner,
  products,
  facts,
  validityDays,
}: {
  banner: Banner | undefined;
  products: { slug: string; name: string }[];
  facts: HeroFacts;
  /** How long a saved price holds (the configurator's `quoteValidityDays`), when known. */
  validityDays: number | null;
}) {
  const t = await getTranslations("home.hero");

  return (
    <section className="grain overflow-hidden bg-[linear-gradient(180deg,var(--color-bg)_0%,#f6efe3_100%)] dark:bg-none">
      <div className="max-w-content relative z-[1] mx-auto grid items-center gap-10 px-5 pt-10 pb-8 md:px-8 lg:min-h-[640px] lg:grid-cols-[1.1fr_1fr] lg:pt-14">
        <div>
          <p className="eyebrow rise">{t("eyebrow")}</p>
          <h1 className="rise mt-5 text-[2.75rem] leading-[1.06] sm:text-6xl lg:text-[4.75rem] lg:leading-[1.04]">
            {t("titleLine1")}
            <br />
            {t.rich("titleLine2", { em: (chunks) => <em>{chunks}</em> })}
          </h1>
          <p className="rise text-muted mt-6 max-w-[28em] text-lg leading-relaxed md:text-[1.1875rem]">{t("lead")}</p>
          <div className="rise mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" shape="pill" iconEnd="arrow-right">
              <Link href="#quick-quote">{t("price")}</Link>
            </Button>
            <Button asChild size="lg" shape="pill" variant="secondary">
              <Link href="/studio/new">{t("design")}</Link>
            </Button>
          </div>
          <dl className="rise border-border mt-11 flex flex-wrap gap-x-9 gap-y-4 border-t pt-6">
            {facts.categories > 0 ? (
              <div>
                <dt className="sr-only">{t("facts.categories")}</dt>
                <dd className="serif text-3xl leading-none">{facts.categories}</dd>
                <dd className="text-subtle mt-1 text-sm">{t("facts.categories")}</dd>
              </div>
            ) : null}
            {facts.fastestDays !== null ? (
              <div>
                <dt className="sr-only">{t("facts.fastest")}</dt>
                <dd className="serif text-3xl leading-none">{t("facts.days", { days: facts.fastestDays })}</dd>
                <dd className="text-subtle mt-1 text-sm">{t("facts.fastest")}</dd>
              </div>
            ) : null}
            <div>
              <dt className="sr-only">{t("facts.proofed")}</dt>
              <dd className="serif text-3xl leading-none">100%</dd>
              <dd className="text-subtle mt-1 text-sm">{t("facts.proofed")}</dd>
            </div>
          </dl>
        </div>

        {banner && storeImageSrc(banner.desktopImageUrl) ? (
          <HeroBanner banner={banner} />
        ) : (
          <div className="rise relative hidden h-[560px] lg:block" aria-hidden="true">
            <HeroStillLife />
            <div className="border-border bg-surface shadow-overlay absolute end-0 top-[10%] flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-sm">
              <span className="bg-primary ring-primary/20 size-2 rounded-full ring-4" />
              <span>
                <b className="block">{t("note.title")}</b>
                <small className="text-muted">{t("note.body")}</small>
              </span>
            </div>
            <p className="serif absolute start-0 top-[4%] -rotate-6 text-[15px] font-medium text-[var(--kraft-3)] italic">
              {t("note.hand")}
            </p>
          </div>
        )}
      </div>

      {/* Home §1b: the quick quote, a paper slip under the hero. */}
      <div id="quick-quote" className="max-w-content relative z-[2] mx-auto scroll-mt-24 px-5 pb-16 md:px-8 md:pb-18">
        <QuickStart products={products} />
        <p className="text-subtle ms-1.5 mt-3 text-[13px]">
          {validityDays !== null ? t("slipNoteDays", { days: validityDays }) : t("slipNote")}
        </p>
      </div>
    </section>
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
      className="border-border shadow-overlay aspect-[5/4] w-full rounded-[1.75rem] border object-cover"
    />
  );
  return target ? (
    <Link
      href={target}
      prefetch={false}
      className="focus-visible:ring-focus-ring block rounded-[1.75rem] outline-none focus-visible:ring-2"
    >
      {image}
    </Link>
  ) : (
    image
  );
}
