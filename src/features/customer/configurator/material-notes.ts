import type { StoreOption } from "./model";

/**
 * CONTENT FILE — the one-line description of each material on the material step.
 *
 * An entry says which materials it describes (a pattern over the API's material `code` and Thai / English
 * name) and the key of its sentence in `configurator.materialNotes` (th + en, `src/i18n`). The wording is
 * the business team's to approve: nothing is written here until they have (the prototype's lines are
 * sample copy and must not ship). A material with no entry shows the description the API sends
 * (`descriptionTh` / `descriptionEn`), and a material with neither shows no line at all.
 *
 * Add an entry as:
 *   { match: /KA125.*B/i, key: "ka125B" }   // + "materialNotes": { "ka125B": "…" } in th and en
 */
export interface MaterialNote {
  match: RegExp;
  key: string;
}

export const MATERIAL_NOTES: readonly MaterialNote[] = [];

/** The key of the sentence that describes this material, or null while none has been written. */
export function materialNoteKey(
  option: Pick<StoreOption, "code" | "nameTh" | "nameEn">,
  notes: readonly MaterialNote[] = MATERIAL_NOTES,
): string | null {
  const haystack = `${option.code} ${option.nameTh} ${option.nameEn}`;
  return notes.find((note) => note.match.test(haystack))?.key ?? null;
}

/**
 * The materials that would show no description: neither a content-file sentence (`has` says the key
 * exists in the messages) nor one from the API. This is the list for the business team.
 */
export function materialsWithoutNote(
  options: readonly StoreOption[],
  has: (key: string) => boolean,
  notes: readonly MaterialNote[] = MATERIAL_NOTES,
): StoreOption[] {
  return options.filter((option) => {
    const key = materialNoteKey(option, notes);
    if (key && has(key)) return false;
    return !(option.descriptionTh?.trim() || option.descriptionEn?.trim());
  });
}
