import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DesignViewer, readDesignDocument } from "./DesignViewer";

const document = {
  spec: { style: "tuck-end", dims: { length: 80, width: 50, height: 120 }, paperId: "ivory-350" },
  content: {
    pattern: { kind: "solid", color: "#eef6f4", background: "#ffffff", size: 10 },
    elements: [
      {
        id: "t",
        type: "text",
        x: 27,
        y: 88,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        text: "บรรทัดแรก\nบรรทัดสอง",
        fontSize: 7,
        fontFamily: "Noto Sans Thai",
        fontStyle: "bold",
        fill: "#ffffff",
        align: "left",
      },
    ],
  },
};

describe("readDesignDocument", () => {
  it("reads a document the designer saved", () => {
    expect(readDesignDocument(document)?.spec.style).toBe("tuck-end");
  });

  it("refuses one this build cannot draw, instead of throwing", () => {
    expect(readDesignDocument({ ...document, spec: { ...document.spec, style: "hexagon" } })).toBeNull();
    expect(readDesignDocument({ ...document, spec: { ...document.spec, dims: { length: 0 } } })).toBeNull();
    expect(readDesignDocument({ spec: document.spec, content: {} })).toBeNull();
  });
});

describe("DesignViewer", () => {
  it("draws the dieline and the artwork, read-only, as one named picture", () => {
    const read = readDesignDocument(document)!;
    render(<DesignViewer {...read} label="กล่องตัวอย่าง" idPrefix="t1" />);
    const picture = screen.getByRole("img", { name: "กล่องตัวอย่าง" });
    // Each line of a multi-line text element is its own tspan, as the editor lays them out.
    expect(picture.querySelectorAll("tspan")).toHaveLength(2);
    expect(picture.querySelector("clipPath#t1-clip")).not.toBeNull();
    expect(picture.querySelectorAll("line").length).toBeGreaterThan(4);
  });
});
