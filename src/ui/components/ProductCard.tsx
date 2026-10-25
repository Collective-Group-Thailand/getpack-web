import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";
import { kraftOf, ProductIllustration, type ProductFamily } from "./ProductIllustration";

export interface ProductCardImage {
  src: string;
  /** Required by type: an image without alt text is an accessibility failure (design-system.md §6). */
  alt: string;
  /** `contain` for a drawing (a dieline) that must show whole, on a plain plate; photos `cover`. */
  fit?: "cover" | "contain";
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
  topLine?: React.ReactNode;
  /** The caller formats it ("เริ่มต้น ฿3.50 / ชิ้น") from what the API returned. */
  price?: React.ReactNode;
  /** Lead time, minimum order — one quiet line. */
  meta?: React.ReactNode;
  /** Block content under the facts (chips, a short list) — not a paragraph, so it may hold lists. */
  details?: React.ReactNode;
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
  /**
   * A campaign badge, top-right, apart from the mode badge (UX audit: "badge โปรโมชันมุมขวาบน") —
   * on a narrow card (a phone's two columns) it drops to the picture's foot, so the two never collide.
   */
  promoBadge?: React.ReactNode;
  /**
   * Controls of their own over the picture's top-end corner (a favourite heart), raised above the
   * stretched link. On a device that hovers they show on hover and focus — and at rest once one of
   * them is pressed (a saved style's star); on touch, always.
   */
  imageActions?: React.ReactNode;
  /** A label at the picture's foot, start side ("18 ตัวเลือก"). */
  imageFoot?: React.ReactNode;
  /** A compact list of facts under the title (size, minimum, lead time) — each item is the caller's. */
  facts?: React.ReactNode;
  /**
   * The card's foot as one row over a hairline — the price at the start, an action at the end —
   * in place of `price` / `meta` / `actions`. Raised above the stretched link, so its controls click.
   */
  footer?: React.ReactNode;
  /** Keep two lines for the title even when it needs one, so every card in a row lines up. */
  reserveTitleLines?: boolean;
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
  topLine,
  price,
  meta,
  details,
  badges,
  promoBadge,
  hoverCta,
  actions,
  imageActions,
  imageFoot,
  facts,
  footer,
  reserveTitleLines = false,
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
          // `shrink-0`: in a row of fixed height (a virtual grid) a card with more text must not
          // squeeze its picture — every plate in a row stays the same size.
          "@container relative shrink-0 overflow-hidden",
          aspect === "square" ? "aspect-square" : "aspect-[4/3]",
          image
            ? "bg-bg-subtle"
            : fallback?.tone === "primary"
              ? "bg-primary-subtle text-primary-subtle-fg"
              : fallback?.tone === "paper"
                ? "bg-bg-subtle text-muted"
                : `${kraftOf(fallback?.family ?? "tuck")} text-fg`,
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
            className={cn(
              "duration-base ease-standard h-full w-full transition-transform group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100",
              image.fit === "contain" ? "bg-surface object-contain p-4" : "object-cover",
            )}
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
        {badges ? (
          <div className="absolute start-2.5 top-2.5 flex flex-wrap gap-1 [&>*]:h-5 [&>*]:px-2 [&>*]:text-[0.6875rem] [&>*]:font-medium">
            {badges}
          </div>
        ) : null}
        {promoBadge ? (
          <div className="absolute end-2.5 top-2.5 flex max-w-[55%] flex-wrap justify-end gap-1 @max-[13rem]:top-auto @max-[13rem]:bottom-2.5 @max-[13rem]:max-w-[80%] [&>*]:h-5 [&>*]:max-w-full [&>*]:px-2 [&>*]:text-[0.6875rem] [&>*]:font-medium">
            {promoBadge}
          </div>
        ) : null}
        {imageFoot ? (
          <div className="pointer-events-none absolute start-2.5 bottom-2.5 flex max-w-[80%] gap-1">{imageFoot}</div>
        ) : null}
        {imageActions ? (
          <div className="duration-fast ease-standard absolute end-2 top-2 z-10 flex gap-1 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:has-[[aria-pressed=true]]:opacity-100">
            {imageActions}
          </div>
        ) : null}
        {hoverCta ? (
          <div
            aria-hidden="true"
            // `invisible` at rest as well as transparent: nothing to measure until it shows.
            className="duration-base ease-standard invisible absolute inset-x-3 bottom-3 flex justify-center opacity-0 transition-[opacity,visibility] group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
          >
            <span className="bg-primary text-primary-fg rounded-control inline-flex h-10 items-center gap-1.5 px-4 text-sm font-medium">
              {hoverCta}
              <Icon name="arrow-right" size={16} />
            </span>
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-3">
        {topLine ? <p className="text-muted truncate text-[0.6875rem] tracking-wide">{topLine}</p> : null}
        <Heading
          className={cn(
            "line-clamp-2 text-sm leading-snug font-semibold md:text-[0.9375rem] [&_a]:outline-none [&_a]:after:absolute [&_a]:after:inset-0 [&_a]:after:content-['']",
            reserveTitleLines && "min-h-[2lh]",
          )}
        >
          {title}
        </Heading>
        {facts ? <div className="text-muted pt-1.5 text-xs">{facts}</div> : null}
        {details ? <div className="pt-1">{details}</div> : null}
        {/* Price, the quiet line and the actions sit at the card's foot, so across a row they line
            up whatever the title's length (one line or two). */}
        {footer ? (
          <div className="border-border relative z-10 -mx-3 mt-auto -mb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-t px-3 py-2.5">
            {footer}
          </div>
        ) : price || meta || actions ? (
          <div className="mt-auto flex flex-col gap-0.5 pt-2">
            {price ? <p className="text-sm tabular-nums">{price}</p> : null}
            {meta ? <p className="text-muted line-clamp-2 text-xs">{meta}</p> : null}
            {actions ? (
              <div className="relative z-10 -ms-1.5 mt-1 flex flex-wrap items-center gap-1">{actions}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Component>
  );
}
