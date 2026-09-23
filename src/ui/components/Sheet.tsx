"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";
import { useReturnFocus } from "../lib/useReturnFocus";
import { IconButton } from "./IconButton";

const sheetVariants = cva(["fixed z-modal flex flex-col overflow-hidden border-border bg-surface-raised shadow-xl"], {
  variants: {
    side: {
      /** Filters and detail panels on desktop. */
      end: "inset-y-0 end-0 h-dvh w-[min(26rem,calc(100vw-2rem))] border-s",
      start: "inset-y-0 start-0 h-dvh w-[min(26rem,calc(100vw-2rem))] border-e",
      /** The mobile default: a bottom sheet keeps actions in the thumb zone. */
      bottom: "inset-x-0 bottom-0 max-h-[85dvh] w-full rounded-t-2xl border-t",
    },
  },
  defaultVariants: { side: "end" },
});

export interface SheetProps extends VariantProps<typeof sheetVariants> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeLabel: string;
  className?: string;
}

/**
 * A side or bottom sheet. Same Radix Dialog behaviour as `Dialog` — trapped focus, Escape,
 * scroll lock — with a different geometry: filter panels, mobile property panels, anything
 * that should not cover the thing it edits.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  closeLabel,
  side,
  className,
}: SheetProps) {
  const returnFocus = useReturnFocus();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="z-overlay bg-overlay fixed inset-0" />
        <DialogPrimitive.Content {...returnFocus} className={cn(sheetVariants({ side }), className)}>
          <div className="border-border flex items-start justify-between gap-4 border-b px-4 py-3">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-muted mt-0.5 text-sm">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton name="close" label={closeLabel} size="sm" />
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>

          {footer ? <div className="border-border flex gap-2 border-t px-4 py-3">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
