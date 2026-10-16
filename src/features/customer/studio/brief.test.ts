import { getStyle } from "@getpack/dieline";
import { describe, expect, it } from "vitest";

import type { DesignContent, DesignSpec } from "@/features/designer/types";

import { briefOf, type BriefWords } from "./brief";

const words: BriefWords = {
  box: "Box",
  size: "Size",
  material: "Material",
  print: "Print",
  printMethod: { digital: "Digital", offset: "Offset", flexo: "Flexo", none: "No print" },
  colours: "Colours",
  texts: "Texts",
  images: "Pictures",
  none: "none",
  mm: "mm",
};

const style = getStyle("tuck-end");
const spec = {
  specVersion: 2,
  styleId: "tuck-end",
  values: { ...style.presets[0]!.values, length: 70, width: 40, height: 150 },
  material: { caliperMm: 0.45, kind: style.materials[0]! },
  materialName: "Art card 350 g",
  studio: { printMethod: "digital" },
} as unknown as DesignSpec;

describe("the design-service brief", () => {
  it("starts from the box, the colours, the words and the pictures placed", () => {
    const content = {
      elements: [
        { id: "a", type: "text", text: "Coffee\n  beans", fill: "#5B3A29" },
        { id: "b", type: "rect", fill: "#ffffff", stroke: "#5b3a29" },
        { id: "c", type: "image" },
      ],
      pattern: { kind: "solid", color: "#F2E8DC", background: "#ffffff", size: 12 },
    } as unknown as DesignContent;
    const brief = briefOf(spec, content, "en", words).split("\n");
    expect(brief[0]).toBe(`Box: ${style.name.en}`);
    expect(brief[1]).toMatch(/^Size: 70.*150 mm$/);
    expect(brief).toContain("Material: Art card 350 g");
    expect(brief).toContain("Print: Digital");
    expect(brief).toContain("Colours: #5b3a29, #ffffff, #f2e8dc");
    expect(brief).toContain("Texts: “Coffee beans”");
    expect(brief).toContain("Pictures: 1");
  });

  it("says none for an empty box", () => {
    const brief = briefOf(
      spec,
      { elements: [], pattern: { kind: "none", color: "#000000", background: "#ffffff", size: 12 } } as DesignContent,
      "en",
      words,
    );
    expect(brief).toContain("Texts: none");
    expect(brief).toContain("Colours: none");
  });
});
