import { cn } from "@/ui/lib/cn";

/**
 * The frame of every back-office page: width, gutters and the vertical rhythm between the
 * header, the toolbar and the content. A Server Component — pages put their client islands
 * inside it.
 */
export function ConsolePage({
  children,
  width = "wide",
  className,
}: {
  children: React.ReactNode;
  width?: "narrow" | "wide" | "full";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-6 px-4 py-5 md:gap-7 md:px-6 md:py-8",
        width === "narrow" && "max-w-3xl",
        width === "wide" && "max-w-7xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
