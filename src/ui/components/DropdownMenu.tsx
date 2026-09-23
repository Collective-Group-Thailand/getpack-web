"use client";

import { DropdownMenu as MenuPrimitive } from "radix-ui";

import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";

export interface MenuItem {
  /** Stable key, also used as the radio/checkbox value. */
  id: string;
  label: React.ReactNode;
  /** Secondary line — the export menu's "ขนาดจริง + bleed 3 มม." */
  description?: React.ReactNode;
  icon?: IconName;
  onSelect?: () => void;
  disabled?: boolean;
  /** Draws a rule above this item. */
  separatorBefore?: boolean;
  /** Renders as a radio item and shows a tick when true (the theme menu). */
  selected?: boolean;
  tone?: "default" | "destructive";
}

export interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: MenuItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: MenuPrimitive.DropdownMenuContentProps["side"];
  align?: MenuPrimitive.DropdownMenuContentProps["align"];
  /** Accessible name for the menu itself. */
  label?: string;
  className?: string;
}

/**
 * An actions menu on Radix DropdownMenu: arrow keys, typeahead, Escape, focus returned to
 * the trigger. Items are data rather than children, so a menu cannot be built without a
 * label per item.
 */
export function DropdownMenu({
  trigger,
  items,
  open,
  onOpenChange,
  side = "bottom",
  align = "end",
  label,
  className,
}: DropdownMenuProps) {
  return (
    <MenuPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <MenuPrimitive.Trigger asChild>{trigger}</MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content
          side={side}
          align={align}
          sideOffset={4}
          collisionPadding={8}
          aria-label={label}
          className={cn(
            "z-modal border-border bg-surface-raised min-w-56 overflow-hidden rounded-lg border p-1 shadow-lg",
            className,
          )}
        >
          {items.map((item) => {
            const content = (
              <>
                {item.icon ? <Icon name={item.icon} size={16} className="mt-0.5" /> : null}
                <span className="min-w-0 flex-1">
                  <span className="block">{item.label}</span>
                  {item.description ? <span className="text-muted block text-xs">{item.description}</span> : null}
                </span>
              </>
            );

            const itemClassName = cn(
              "flex w-full cursor-default items-start gap-2 rounded-md px-2 py-2 text-start text-sm outline-none",
              "data-highlighted:bg-surface-subtle",
              "data-disabled:pointer-events-none data-disabled:opacity-50",
              item.tone === "destructive" && "text-danger data-highlighted:bg-danger-subtle",
            );

            return (
              <div key={item.id}>
                {item.separatorBefore ? <MenuPrimitive.Separator className="bg-border my-1 h-px" /> : null}
                {item.selected === undefined ? (
                  <MenuPrimitive.Item onSelect={item.onSelect} disabled={item.disabled} className={itemClassName}>
                    {content}
                  </MenuPrimitive.Item>
                ) : (
                  <MenuPrimitive.CheckboxItem
                    checked={item.selected}
                    onSelect={item.onSelect}
                    disabled={item.disabled}
                    className={itemClassName}
                  >
                    {content}
                    <MenuPrimitive.ItemIndicator>
                      <Icon name="check" size={16} />
                    </MenuPrimitive.ItemIndicator>
                  </MenuPrimitive.CheckboxItem>
                )}
              </div>
            );
          })}
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}
