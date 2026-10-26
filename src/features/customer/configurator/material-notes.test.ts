import { describe, expect, it } from "vitest";

import { materialNoteKey, materialsWithoutNote, MATERIAL_NOTES } from "./material-notes";
import type { StoreOption } from "./model";

const material = (code: string, nameTh: string, descriptionTh: string | null = null) =>
  ({ code, nameTh, nameEn: nameTh, descriptionTh, descriptionEn: null }) as unknown as StoreOption;

describe("material notes (content file)", () => {
  it("matches a material by its code or name and finds no key for one that has no entry", () => {
    const notes = [{ match: /KA125.*B/i, key: "ka125B" }];
    expect(materialNoteKey(material("KA125-B", "ลูกฟูก KA125 ลอน B"), notes)).toBe("ka125B");
    expect(materialNoteKey(material("KT125-B", "ลูกฟูก KT125 ลอน B"), notes)).toBeNull();
  });

  it("ships no sentence nobody has approved", () => {
    expect(MATERIAL_NOTES).toEqual([]);
  });

  it("lists the materials that would show no line: no sentence in the file and none from the API", () => {
    const notes = [{ match: /KA125/, key: "ka125" }];
    const options = [
      material("a", "KA125 ลอน B"),
      material("b", "KT125 ลอน B", "ผิวคราฟท์"),
      material("c", "KA185 ลอน B"),
      material("d", "KA125 ลอน E", "  "),
    ];
    const names = (has: boolean) => materialsWithoutNote(options, () => has, notes).map((option) => option.code);
    expect(names(true)).toEqual(["c"]);
    // The key exists in the content file but its sentence is not in the messages yet.
    expect(names(false)).toEqual(["a", "c", "d"]);
  });
});
