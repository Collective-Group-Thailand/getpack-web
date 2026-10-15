/** `code` of studio templates and elements, as packio-api validates it (D-281, D-282). */
export const STUDIO_CODE = /^[a-z0-9][a-z0-9_-]{1,63}$/;

/** A LINE rich menu's key (D-151). */
export const RICH_MENU_KEY = /^[a-z][a-z0-9_]{1,40}$/;

/** A canned response's tag (D-300). */
export const CANNED_TAG = /^[a-z0-9_]{1,30}$/;

/**
 * Tags typed as free text — commas or new lines between them — in the form packio-api keeps:
 * lower-case, spaces and dashes as `_`, duplicates dropped.
 */
export function tagsFrom(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[,\n]/)
        .map((tag) =>
          tag
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, "_"),
        )
        .filter(Boolean),
    ),
  ];
}
