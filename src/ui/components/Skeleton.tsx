import { cn } from "../lib/cn";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Render several stacked bars — the common "loading a paragraph" case. */
  lines?: number;
}

/**
 * A placeholder shaped like the content that replaces it (design-system.md §4), so nothing
 * moves when the data lands — the CLS budget depends on it.
 *
 * `aria-hidden`: the region it fills should carry `aria-busy`, and announcing "loading" once
 * beats announcing an empty grey box per line.
 */
export function Skeleton({ className, lines, ...props }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div className="space-y-2" aria-hidden {...props}>
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={cn(
              "bg-surface-subtle h-4 animate-pulse rounded-sm",
              // A ragged last line reads as text rather than as a block.
              i === lines - 1 ? "w-2/3" : "w-full",
              className,
            )}
          />
        ))}
      </div>
    );
  }

  return <div aria-hidden className={cn("bg-surface-subtle animate-pulse rounded-md", className)} {...props} />;
}
