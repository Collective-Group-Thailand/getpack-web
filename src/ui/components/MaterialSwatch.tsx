import { cn } from "../lib/cn";

export interface MaterialSwatchProps {
  /** `#RRGGBB` from the API — what the board, film or stock looks like. */
  colour?: string | null;
  /** A photo of the material, when the catalogue has one; wins over the colour. */
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = { sm: "size-6", md: "size-10", lg: "size-14" } as const;

/**
 * A chip showing what a material looks like (design-system.md §3 "MaterialSwatch", §1.2 "show
 * the box"). Decorative: it always sits next to the material's name, which is what a screen
 * reader hears, so it is hidden from assistive technology rather than given a second name.
 *
 * The colour is data from the API — real board colours, not theme — so it is applied inline;
 * a hairline border keeps a white board visible on a white card.
 */
export function MaterialSwatch({ colour, imageUrl, size = "md", className }: MaterialSwatchProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "border-border-strong inline-block shrink-0 overflow-hidden rounded-lg border bg-cover bg-center",
        SIZES[size],
        !colour && !imageUrl && "bg-surface-subtle",
        className,
      )}
      style={imageUrl ? { backgroundImage: `url("${imageUrl}")` } : colour ? { backgroundColor: colour } : undefined}
    />
  );
}
