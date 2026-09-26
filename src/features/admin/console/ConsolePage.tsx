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
        "mx-auto flex w-full flex-col gap-5 px-4 py-6 md:px-6",
        width === "narrow" && "max-w-3xl",
        width === "wide" && "max-w-7xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
