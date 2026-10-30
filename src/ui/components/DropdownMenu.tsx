"use client";

import { DropdownMenu as MenuPrimitive } from "radix-ui";

import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";
import { MENU_ITEM, POPOVER_SURFACE } from "./menu-surface";

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
  /**
   * Marks this item as part of a single-choice group — the theme menu, the language menu.
   * Setting it on any item turns the whole menu into a radio group, so a screen reader
   * announces "selected, 2 of 4" rather than four independent checkboxes.
   */
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
  /** A line above the items that is not an action — who is signed in, above an account menu. */
  heading?: React.ReactNode;
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
  heading,
  className,
}: DropdownMenuProps) {
  // Radix needs one `RadioGroup` around the choices, with the value of the chosen one. Items
  // without `selected` are ordinary actions and sit inside it quite happily.
  const selectedId = items.find((item) => item.selected)?.id;
  const hasChoices = items.some((item) => item.selected !== undefined);

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
          className={cn(POPOVER_SURFACE, "min-w-56 overflow-hidden p-1", className)}
        >
          {heading ? (
            <>
              <MenuPrimitive.Label className="text-fg truncate px-2 pt-1.5 pb-1 text-sm font-semibold">
                {heading}
              </MenuPrimitive.Label>
              <MenuPrimitive.Separator className="bg-border my-1 h-px" />
            </>
          ) : null}
          <Choices enabled={hasChoices} value={selectedId}>
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
                MENU_ITEM,
                "w-full text-start data-highlighted:bg-primary-subtle data-highlighted:text-primary-subtle-fg",
                "data-disabled:pointer-events-none data-disabled:opacity-50",
                item.tone === "destructive" &&
                  "text-danger data-highlighted:bg-danger-subtle data-highlighted:text-danger-subtle-fg",
              );

              return (
                <div key={item.id}>
                  {item.separatorBefore ? <MenuPrimitive.Separator className="bg-border my-1 h-px" /> : null}
                  {item.selected === undefined ? (
                    <MenuPrimitive.Item onSelect={item.onSelect} disabled={item.disabled} className={itemClassName}>
                      {content}
                    </MenuPrimitive.Item>
                  ) : (
                    <MenuPrimitive.RadioItem
                      value={item.id}
                      onSelect={item.onSelect}
                      disabled={item.disabled}
                      className={itemClassName}
                    >
                      {content}
                      <MenuPrimitive.ItemIndicator>
                        <Icon name="check" size={16} />
                      </MenuPrimitive.ItemIndicator>
                    </MenuPrimitive.RadioItem>
                  )}
                </div>
              );
            })}
          </Choices>
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}

/**
 * Wraps the items in a Radix `RadioGroup` only when the menu actually offers a choice.
 *
 * A menu of plain actions must not become a radio group: it would tell a screen reader that
 * "Duplicate" and "Export" are alternatives one of which is selected.
 */
function Choices({ enabled, value, children }: { enabled: boolean; value?: string; children: React.ReactNode }) {
  if (!enabled) return <>{children}</>;
  return <MenuPrimitive.RadioGroup value={value}>{children}</MenuPrimitive.RadioGroup>;
}
