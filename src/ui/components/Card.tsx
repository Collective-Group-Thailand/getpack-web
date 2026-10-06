import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";

const cardVariants = cva("rounded-card bg-surface", {
  variants: {
    elevation: {
      flat: "border border-border",
      raised: "border border-border shadow-card",
      floating: "shadow-overlay",
    },
    padding: {
      none: "",
      sm: "p-3",
      md: "p-4",
      lg: "p-6",
    },
    /**
     * A card that is itself a way in (a link stretched over it, or a step in a sequence): it rises
     * a few pixels and takes the overlay shadow on hover. Motion only when the user allows it.
     */
    interactive: {
      // The lift is the zone's (`--card-lift`): 4 px on the storefront, none in the back office.
      true: "duration-base ease-standard transition-[transform,box-shadow] hover:shadow-overlay motion-safe:hover:translate-y-[calc(var(--card-lift,2px)*-1)]",
      false: "",
    },
  },
  defaultVariants: { elevation: "flat", padding: "md", interactive: false },
});

type CardElement = "div" | "article" | "li" | "section";

export interface CardProps extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof cardVariants> {
  /** Render as `<article>`, `<li>`, … when the card is a list item or a standalone entity. */
  as?: CardElement;
}

/** A surface that groups related content. It carries no interaction of its own; `interactive` only styles hover. */
export function Card({ className, elevation, padding, interactive, as: Component = "div", ...props }: CardProps) {
  return <Component className={cn(cardVariants({ elevation, padding, interactive }), className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-3 flex items-start justify-between gap-3", className)} {...props} />;
}

export function CardTitle({
  className,
  as: Component = "h3",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: "h2" | "h3" | "h4" }) {
  return <Component className={cn("text-lg font-semibold", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-muted text-sm", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-4 flex items-center gap-2", className)} {...props} />;
}
