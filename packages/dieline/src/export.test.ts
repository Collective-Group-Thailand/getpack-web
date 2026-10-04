import { describe, expect, it } from "vitest";

import { dielineToDxf } from "./export/dxf";
import { dielineToPdf } from "./export/pdf";
import { dielineToSvg } from "./export/svg";
import { REFERENCE_MATERIALS } from "./materials";
import { getStyle } from "./styles";

const board = REFERENCE_MATERIALS["board-350"];
const withCurves = getStyle("tuck-end").build(
  { ...getStyle("tuck-end").defaults, window: "ellipse", windowWidth: 30, windowHeight: 20, thumbNotch: true },
  board,
);

describe("SVG", () => {
  const svg = dielineToSvg(withCurves, { bleedMm: 3, annotations: true });

  it("is true size in millimetres", () => {
    expect(svg).toMatch(new RegExp(`width="${Math.round((withCurves.width + 10) * 1000) / 1000}mm"`));
  });

  it("has one group per layer, in order", () => {
    const ids = [...svg.matchAll(/<g id="([A-Z]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(["CUT", "CREASE", "PERF", "HALFCUT", "GLUE", "BLEED", "NOTES"]);
  });

  it("keeps arcs as SVG arcs and Béziers as curves", () => {
    const cut = /<g id="CUT"[^>]*>(.*?)<\/g>/.exec(svg)![1];
    expect(cut).toMatch(/ A\d/); // tuck corners and thumb notch
    expect(cut).toMatch(/ C-?\d/); // the elliptical window
  });

  it("marks glue areas on the GLUE layer", () => {
    expect(/<g id="GLUE"[^>]*>(.*?)<\/g>/.exec(svg)![1]).toContain("<path");
  });
});

describe("DXF", () => {
  const dxf = dielineToDxf(withCurves);

  it("is R12 in millimetres with the die layers", () => {
    expect(dxf).toContain("AC1009");
    for (const layer of ["CUT", "CREASE", "PERF", "HALFCUT", "GLUE"]) expect(dxf).toContain(`\n2\n${layer}\n`);
    expect(dxf.trimEnd().endsWith("EOF")).toBe(true);
  });

  it("writes circular arcs as ARC entities and lines as LINE", () => {
    expect(dxf).toContain("\nARC\n");
    expect(dxf).toContain("\nLINE\n");
    expect(dxf).toContain("\nPOLYLINE\n"); // the ellipse
  });
});

describe("PDF", () => {
  const bytes = dielineToPdf(withCurves, { bleedMm: 3, title: "กล่องทดสอบ" });
  const text = new TextDecoder("latin1").decode(bytes);

  it("is a PDF with a valid cross-reference table", () => {
    expect(text.startsWith("%PDF-1.6")).toBe(true);
    const start = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(start, start + 4)).toBe("xref");
    const offsets = [...text.slice(start).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
    offsets.forEach((o, i) => expect(text.slice(o, o + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
  });

  it("strokes the die in spot colours on named layers, with overprint", () => {
    expect(text).toContain("/Separation /CutContour");
    expect(text).toContain("/Separation /Crease");
    expect(text).toContain("/OP true");
    expect(text).toContain("/Type /OCG /Name <FEFF004300550054>"); // "CUT"
    expect(text).toContain("/TrimBox");
    expect(text).toContain("/BleedBox");
  });

  it("places JPEG artwork tiles under the die", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const withArt = new TextDecoder("latin1").decode(
      dielineToPdf(withCurves, { images: [{ jpeg, widthPx: 1, heightPx: 1, x: 0, y: 0, width: 10, height: 10 }] }),
    );
    expect(withArt).toContain("/Filter /DCTDecode");
    expect(withArt).toContain("/Im0 Do");
  });
});

describe("finish separation pages (U4.4)", () => {
  it("adds one page per finish: its stencil in a spot colour of its name, with the die lines", async () => {
    const { dielineToPdf } = await import("./export/pdf");
    const { getStyle } = await import("./styles");
    const d = getStyle("tuck-end").build({ length: 70, width: 40, height: 150 }, { caliperMm: 0.45, kind: "paperboard" });
    const bits = new Uint8Array(Math.ceil(16 / 8) * 16).fill(0xff);
    const pdf = new TextDecoder("latin1").decode(
      dielineToPdf(d, {
        finishes: [
          { name: "Foil", cmyk: [0, 0.2, 0.6, 0.2], mask: { bits, widthPx: 16, heightPx: 16, x: 0, y: 0, width: d.width, height: d.height } },
          { name: "SpotUV", cmyk: [0.3, 0, 0, 0], mask: { bits, widthPx: 16, heightPx: 16, x: 0, y: 0, width: d.width, height: d.height } },
        ],
      }),
    );
    expect(pdf).toMatch(/\/Count 3/);
    expect(pdf).toContain("/Separation /Foil");
    expect(pdf).toContain("/Separation /SpotUV");
    expect(pdf.match(/\/ImageMask true/g)).toHaveLength(2);
    expect(pdf.match(/CS_CUT CS/g)!.length).toBe(3);
  });
});
