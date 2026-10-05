import { cn } from "../lib/cn";
import { Skeleton } from "./Skeleton";

/**
 * Route-level loading shapes (U5.7 §2: skeletons shaped like the final content, never a
 * full-screen spinner). `list` is rows, `grid` is cards, `thread` is a conversation, `dashboard`
 * is a hero and two rows of cards. The region is `aria-busy`; the bars themselves are hidden.
 */
export function PageSkeleton({
  shape,
  label,
  className,
}: {
  shape: "list" | "grid" | "thread" | "dashboard";
  /** Announced once: "กำลังโหลด…". */
  label: string;
  className?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={cn("flex flex-col gap-6", className)}>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      {shape === "dashboard" ? (
        <>
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((n) => (
              <Skeleton key={n} className="h-20 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((n) => (
              <Skeleton key={n} className="h-32 rounded-xl" />
            ))}
          </div>
        </>
      ) : shape === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <Skeleton key={n} className="aspect-[4/3] rounded-xl" />
          ))}
        </div>
      ) : shape === "thread" ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-3/5 rounded-xl" />
          <Skeleton className="h-12 w-2/5 self-end rounded-xl" />
          <Skeleton className="h-16 w-1/2 rounded-xl" />
          <Skeleton className="mt-4 h-24 w-full rounded-xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-16 rounded-xl" />
          ))}
        </div>
      )}
    </div>
  );
}
