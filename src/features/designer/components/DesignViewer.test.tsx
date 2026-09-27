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
  it("reads a BoxStudio-era document into an engine v2 spec, artwork moved with its face", () => {
    const read = readDesignDocument(document)!;
    expect(read.spec).toMatchObject({
      specVersion: 2,
      styleId: "tuck-end",
      values: { length: 80, width: 50, height: 120 },
      materialId: "ivory-350",
    });
    expect(read.content.elements[0].x).not.toBe(27);
  });

  it("reads a current document as it is", () => {
    const read = readDesignDocument(document)!;
    const again = readDesignDocument({
      spec: { ...read.spec },
      content: read.content as unknown as Record<string, unknown>,
    })!;
    expect(again.spec.styleId).toBe("tuck-end");
    expect(again.content.elements[0].x).toBe(read.content.elements[0].x);
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
    expect(picture.querySelectorAll("path[stroke]").length).toBeGreaterThan(4);
  });
});
