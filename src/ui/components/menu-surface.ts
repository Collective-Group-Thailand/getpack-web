/**
 * One popover surface for every list that opens from a control — a select's listbox, a searchable select, an
 * action ("⋯") menu — so they share radius, border, shadow, item height and the highlight tint (owner request
 * 2026-10-30). Menus stay menus and selects stay selects; only the look is shared.
 */
export const POPOVER_SURFACE = "z-modal border-border bg-surface-raised shadow-overlay rounded-lg border";
/** An item's box: at least 36 px tall, text-sm, rounded inside the surface's 4 px padding. */
export const MENU_ITEM = "flex min-h-9 cursor-default items-start gap-2 rounded-md px-2 py-2 text-sm outline-none";
/** The highlighted (hovered or arrowed-to) item. */
export const MENU_ITEM_ACTIVE = "bg-primary-subtle text-primary-subtle-fg";
