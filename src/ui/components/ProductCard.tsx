import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";
import { kraftOf, ProductIllustration, type ProductFamily } from "./ProductIllustration";

export interface ProductCardImage {
  src: string;
  /** Required by type: an image without alt text is an accessibility failure (design-system.md §6). */
  alt: string;
}

export interface ProductCardProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /**
   * The product's name, **as a link** (`<Link href>Name</Link>`). The link is stretched over
   * the whole card, so the card is one tab stop and one accessible name rather than an image
   * link, a title link and a price link that all go to the same place.
   */
  title: React.ReactNode;
  image?: ProductCardImage | null;
  /** A short line above the title: the product type, "สินค้าสต็อก". */
  eyebrow?: React.ReactNode;
  /** The caller formats it ("เริ่มต้น ฿3.50 / ชิ้น") from what the API returned. */
  price?: React.ReactNode;
  /** Lead time, minimum order — one quiet line. */
  meta?: React.ReactNode;
  /**
   * Buttons of their own (save, compare), in a row under the facts — raised above the stretched
   * title link so they stay separately clickable and focusable.
   */
  actions?: React.ReactNode;
  /**
   * What stands in for a missing photo: the product family's line drawing (or, for a non-product
   * card, an icon) on a kraft, paper or brand-tint plate, so a grid without photography still
   * reads as a set rather than as broken images — never a generic box icon (UX audit baseline).
   */
  fallback?: { family?: ProductFamily; icon?: IconName; tone?: "kraft" | "paper" | "primary" };
  /** Image plate proportions: 4:3 for made-to-order types, square for stock items. */
  aspect?: "landscape" | "square";
  /** Badges over the image's top-left corner ("ราคาทันที", "ขอใบเสนอราคา"). */
  badges?: React.ReactNode;
  /** A campaign badge, top-right, apart from the mode badge (UX audit: "badge โปรโมชันมุมขวาบน"). */
  promoBadge?: React.ReactNode;
  /** Revealed on hover and focus at the foot of the picture ("ดูราคา"); the whole card is the link. */
  hoverCta?: React.ReactNode;
  /** The heading level in the page outline. */
  headingLevel?: "h2" | "h3";
  /** Above the fold: load the image eagerly and at high priority (LCP). */
  priority?: boolean;
  as?: "article" | "li" | "div";
}

/**
 * One product in a grid: picture, name, and the facts that decide a click — photography first
 * (design-system.md §5), price and time honest and never computed here.
 *
 * A server component. The image is a plain `<img>` with its intrinsic size declared, so the
 * grid does not shift when it arrives (CLS ≤ 0.05) — catalogue images come from the API's own
 * origin through the BFF, which `next/image` could only optimise with a remote-pattern list this
 * app does not own.
 */
export function ProductCard({
  title,
  image,
  eyebrow,
  price,
  meta,
  badges,
  promoBadge,
  hoverCta,
  actions,
  fallback,
  aspect = "landscape",
  headingLevel: Heading = "h3",
  priority = false,
  as: Component = "article",
  className,
  ...props
}: ProductCardProps) {
  return (
    <Component
      className={cn(
        "group border-border bg-surface focus-within:ring-focus-ring rounded-card hover:shadow-lift duration-base ease-standard relative flex flex-col overflow-hidden border transition-[transform,box-shadow] focus-within:ring-2 motion-safe:hover:-translate-y-1",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "relative overflow-hidden",
          aspect === "square" ? "aspect-square" : "aspect-[4/3]",
          image
            ? "bg-bg-subtle"
            : fallback?.tone === "primary"
              ? "bg-primary-subtle text-primary-subtle-fg"
              : fallback?.tone === "paper"
                ? "bg-bg-subtle text-muted"
                : `${kraftOf(fallback?.family ?? "tuck")} grain text-[#3d3326]`,
        )}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- see the component comment
          <img
            src={image.src}
            alt={image.alt}
            width={800}
            height={600}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            className="duration-base ease-standard h-full w-full object-cover transition-transform group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6" aria-hidden="true">
            {fallback?.icon && !fallback.family ? (
              <Icon name={fallback.icon} size={56} />
            ) : (
              <ProductIllustration
                family={fallback?.family ?? "tuck"}
                className="duration-base ease-standard max-w-36 transition-transform group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
            )}
          </div>
        )}
        {badges ? <div className="absolute start-3 top-3 flex flex-wrap gap-1">{badges}</div> : null}
        {promoBadge ? (
          <div className="absolute end-3 top-3 flex max-w-[55%] flex-wrap justify-end gap-1 [&>*]:max-w-full">
            {promoBadge}
          </div>
        ) : null}
        {hoverCta ? (
          <div
            aria-hidden="true"
            className="duration-base ease-standard absolute inset-x-3 bottom-3 flex justify-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
          >
            <span className="bg-primary text-primary-fg rounded-cta shadow-cta inline-flex h-10 items-center gap-1.5 px-4 text-sm font-medium">
              {hoverCta}
              <Icon name="arrow-right" size={16} />
            </span>
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4 md:px-5 md:pt-4.5 md:pb-5">
        {eyebrow ? <p className="text-muted text-xs">{eyebrow}</p> : null}
        <Heading className="text-[1.0625rem] leading-snug font-bold [&_a]:outline-none [&_a]:after:absolute [&_a]:after:inset-0 [&_a]:after:content-['']">
          {title}
        </Heading>
        {price ? <p className="mt-auto pt-2 text-base tabular-nums">{price}</p> : null}
        {meta ? <p className="text-muted text-xs">{meta}</p> : null}
        {actions ? <div className="relative z-10 mt-2 flex flex-wrap items-center gap-1">{actions}</div> : null}
      </div>
    </Component>
  );
}
