import { Icon } from "../icons";
import { cn } from "../lib/cn";

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
  /** Badges over the image corner ("ราคาทันที", "ขอใบเสนอราคา"). */
  badges?: React.ReactNode;
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
  headingLevel: Heading = "h3",
  priority = false,
  as: Component = "article",
  className,
  ...props
}: ProductCardProps) {
  return (
    <Component
      className={cn(
        "group border-border bg-surface focus-within:ring-focus-ring relative flex flex-col overflow-hidden rounded-xl border transition-shadow focus-within:ring-2 hover:shadow-md",
        className,
      )}
      {...props}
    >
      <div className="bg-bg-subtle relative aspect-[4/3] overflow-hidden">
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
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="text-subtle flex h-full items-center justify-center" aria-hidden="true">
            <Icon name="box" size={48} />
          </div>
        )}
        {badges ? <div className="absolute start-2 top-2 flex flex-wrap gap-1">{badges}</div> : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        {eyebrow ? <p className="text-muted text-xs">{eyebrow}</p> : null}
        <Heading className="leading-snug font-medium [&_a]:outline-none [&_a]:after:absolute [&_a]:after:inset-0 [&_a]:after:content-['']">
          {title}
        </Heading>
        {price ? <p className="mt-auto pt-2 text-sm font-medium tabular-nums">{price}</p> : null}
        {meta ? <p className="text-muted text-xs">{meta}</p> : null}
      </div>
    </Component>
  );
}
