"use client";

import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "../lib/cn";

export interface TabItem {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
  content: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Accessible name for the tab list. */
  label: string;
  className?: string;
}

/**
 * Tabs on Radix: arrow keys move between tabs, and only the active tab panel is in the tab
 * order. Use for alternative views of one thing — never as navigation between pages, where a
 * back button has to work.
 */
export function Tabs({ items, value, defaultValue, onValueChange, label, className }: TabsProps) {
  return (
    <TabsPrimitive.Root
      value={value}
      defaultValue={defaultValue ?? items[0]?.value}
      onValueChange={onValueChange}
      className={className}
    >
      <TabsPrimitive.List aria-label={label} className="border-border flex gap-1 border-b">
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={cn(
              "text-muted -mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium",
              "hover:text-fg data-[state=active]:border-primary data-[state=active]:text-fg",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      {items.map((item) => (
        <TabsPrimitive.Content key={item.value} value={item.value} className="pt-4">
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
