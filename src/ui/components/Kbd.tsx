import { cn } from "../lib/cn";

export type KbdProps = React.HTMLAttributes<HTMLElement>;

/** A keyboard key in help text and shortcut lists (the designer's shortcut panel, ⌘K hints). */
export function Kbd({ className, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        "border-border inline-flex h-5 min-w-5 items-center justify-center rounded-sm border",
        "bg-surface-subtle text-muted px-1 font-mono text-xs",
        className,
      )}
      {...props}
    />
  );
}
