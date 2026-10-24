import type { Locator, Page } from "@playwright/test";

/**
 * A choice list by its label: the Radix `Select` (a combobox) or the `SearchSelect` every admin and
 * storefront form now uses (a button that opens a listbox, src/ui/components/SearchSelect.tsx).
 * Either way the options that open are `option`s.
 */
export function choiceList(scope: Page | Locator, name: string | RegExp): Locator {
  return scope
    .getByRole("combobox", { name })
    .or(scope.getByRole("button", { name }).and(scope.locator('[aria-haspopup="listbox"]')));
}
