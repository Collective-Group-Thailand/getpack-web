import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";
import { CardImage } from "./CardImage";
import { ProductIllustration, type ProductFamily } from "./ProductIllustration";

export interface ShowcasePhoto {
  /** The product's photo; `null` draws its line drawing instead. */
  src: string | null;
  alt: string;
  family: ProductFamily;
}

export interface ShowcaseChip {
  icon: IconName;
  label: string;
}

/** Where each photo sits on the panel: the large one, then two smaller ones at other depths. */
const SPOTS = [
  "start-[9%] top-[13%] z-[1] w-[44%] -rotate-1 xl:start-[7%] xl:top-[12%] xl:w-[58%]",
  "end-[9%] top-[7%] z-[2] w-[30%] rotate-2 xl:end-[6%] xl:top-[6%] xl:w-[38%]",
  "end-[13%] bottom-[8%] z-[3] w-[34%] -rotate-[1.5deg] xl:end-[9%] xl:bottom-[7%] xl:w-[42%]",
] as const;
/** The chips' places, kept clear of the photos' centres. */
const CHIP_SPOTS = ["start-[4%] bottom-[16%]", "start-[30%] top-[4%]", "end-[3%] top-[46%]"] as const;

/**
 * A hero's picture as an editorial product shot (owner direction 2026-10-30): a panel on the pale brand tint with real
 * product photos — one large, two smaller at other depths, a soft shadow and a slight turn each — and a few white
 * capability chips floating over them, each a short line the product really does. No figures, no sample data;
 * a photo that is missing or fails shows its thin-line drawing. Under reduced motion the chips keep still; on a
 * phone the panel turns 4:3 and shows two chips.
 */
export function HeroShowcase({
  photos,
  chips,
  label,
  className,
}: {
  photos: readonly ShowcasePhoto[];
  chips: readonly ShowcaseChip[];
  /** What the picture shows, for assistive tech (the chips are read as a list). */
  label: string;
  className?: string;
}) {
  return (
    <figure
      aria-label={label}
      className={cn(
        "bg-primary-subtle rounded-panel relative isolate aspect-[4/3] w-full overflow-hidden xl:aspect-square",
        className,
      )}
    >
      {photos.slice(0, 3).map((photo, index) => {
        const drawing = (
          <span className="text-muted grid size-full place-items-center [--pi-stroke:1.2]">
            <ProductIllustration family={photo.family} className="max-w-[45%]" />
          </span>
        );
        return (
          <span
            key={`${photo.alt}-${index}`}
            className={cn(
              "bg-surface border-border rounded-card shadow-panel absolute block aspect-square overflow-hidden border",
              SPOTS[index],
            )}
          >
            {photo.src ? (
              <CardImage
                src={photo.src}
                alt={photo.alt}
                className="size-full object-contain p-[8%]"
                loading={index === 0 ? "eager" : "lazy"}
                fallback={drawing}
              />
            ) : (
              <>
                {drawing}
                <span className="sr-only">{photo.alt}</span>
              </>
            )}
          </span>
        );
      })}
      <ul className="contents">
        {chips.slice(0, 3).map((chip, index) => (
          <li
            key={chip.label}
            style={{ animationDelay: `${index * -2}s` }}
            className={cn(
              "hero-float bg-surface border-border rounded-control shadow-overlay absolute z-[4] flex max-w-[60%] items-center gap-2 border px-3 py-2 text-[0.84375rem] leading-snug font-medium",
              CHIP_SPOTS[index],
              index === 2 && "max-md:hidden",
            )}
          >
            <span
              aria-hidden="true"
              className="bg-primary-subtle text-primary-subtle-fg grid size-6 shrink-0 place-items-center rounded-full"
            >
              <Icon name={chip.icon} size={14} />
            </span>
            {chip.label}
          </li>
        ))}
      </ul>
    </figure>
  );
}
