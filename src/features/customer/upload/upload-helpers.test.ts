import { describe, expect, it } from "vitest";

import { handOffFiles, mimeOf, refusalOf, sizeMb, takeHandedFiles } from "./files";
import { boxPosition, markerPosition } from "./markers";

describe("upload file rules", () => {
  it("takes PDF and AI by name within the size, refuses the rest", () => {
    expect(refusalOf({ name: "box.PDF", size: 10 }, 100)).toBeNull();
    expect(refusalOf({ name: "box.ai", size: 10 }, 100)).toBeNull();
    expect(refusalOf({ name: "box.png", size: 10 }, 100)).toBe("type");
    expect(refusalOf({ name: "box.pdf", size: 101 }, 100)).toBe("size");
    expect(refusalOf({ name: "box.pdf", size: 0 }, 100)).toBe("empty");
    expect(refusalOf({ name: "box.pdf", size: 10 ** 12 }, null)).toBeNull();
  });

  it("presigns AI files without a browser type as Illustrator", () => {
    expect(mimeOf({ name: "a.ai", type: "" })).toBe("application/illustrator");
    expect(mimeOf({ name: "a.pdf", type: "" })).toBe("application/pdf");
    expect(mimeOf({ name: "a.pdf", type: "application/pdf" })).toBe("application/pdf");
    expect(sizeMb(18 * 1024 * 1024)).toBe(18);
  });

  it("hands dropped files over once", () => {
    const file = new File(["%PDF-1.7"], "box.pdf");
    handOffFiles([file]);
    expect(takeHandedFiles()).toEqual([file]);
    expect(takeHandedFiles()).toEqual([]);
  });
});

describe("check markers", () => {
  const media = [0, 0, 200, 100];
  it("maps a PDF point (y up) onto the preview (y down)", () => {
    expect(markerPosition({ x: 50, y: 75 }, media)).toEqual({ left: 25, top: 25 });
    expect(markerPosition({ x: 500, y: -10 }, media)).toEqual({ left: 100, top: 100 });
    expect(markerPosition(null, media)).toBeNull();
    expect(markerPosition({ x: 1, y: 1 }, null)).toBeNull();
  });

  it("outlines the die box over the page", () => {
    expect(boxPosition([20, 10, 180, 90], media)).toEqual({ left: 10, top: 10, width: 80, height: 80 });
  });
});
