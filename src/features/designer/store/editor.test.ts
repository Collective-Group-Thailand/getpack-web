import { beforeEach, describe, expect, it } from "vitest";

import { newShape, newText } from "../lib/create";
import { useEditor } from "./editor";

const s = () => useEditor.getState();

describe("editor store (F4 Part D)", () => {
  beforeEach(() => {
    s().load({ id: "d", name: "test", spec: null });
    s().addElement(newShape({ x: 50, y: 50 }, "rect"));
    s().addElement(newText({ x: 80, y: 80 }, "A"));
    s().addElement(newShape({ x: 120, y: 50 }, "circle"));
  });

  const ids = () => s().content.elements.map((e) => e.id);

  it("selects additively and selects a whole group", () => {
    const [a, b, c] = ids();
    s().select(a!);
    s().select(b!, true);
    expect(s().selectedIds).toEqual([a, b]);
    s().group();
    s().select(null);
    s().select(b!);
    expect(new Set(s().selectedIds)).toEqual(new Set([a, b]));
    s().select(c!, true);
    expect(s().selectedIds).toHaveLength(3);
    s().select(c!, true);
    expect(s().selectedIds).not.toContain(c);
  });

  it("moves several elements as one undo step, never a locked one", () => {
    const [a, b] = ids();
    s().setLocked([b!], true);
    const before = s().content.elements.map((e) => [e.x, e.y]);
    s().moveElements([
      { id: a!, dx: 5, dy: 0 },
      { id: b!, dx: 5, dy: 0 },
    ]);
    const after = s().content.elements;
    expect(after[0]!.x).toBe(before[0]![0]! + 5);
    expect(after[1]!.x).toBe(before[1]![0]);
    s().undo();
    expect(s().content.elements[0]!.x).toBe(before[0]![0]);
  });

  it("does not delete locked elements, and select-all skips them", () => {
    const [a] = ids();
    s().setLocked([a!], true);
    s().selectAll();
    expect(s().selectedIds).not.toContain(a);
    s().selectMany(ids());
    s().removeSelected();
    expect(ids()).toEqual([a]);
  });

  it("copies and pastes with new ids, 5 mm down and right (C8), unlocked", () => {
    const [a] = ids();
    s().setLocked([a!], true);
    s().select(a!);
    s().copySelected();
    s().paste();
    const pasted = s().content.elements.at(-1)!;
    expect(pasted.id).not.toBe(a);
    expect(pasted.locked).toBe(false);
    expect(pasted.x).toBe(s().content.elements[0]!.x + 5);
    expect(pasted.y).toBe(s().content.elements[0]!.y + 5);
    expect(s().selectedIds).toEqual([pasted.id]);
  });

  it("duplicates a group into a new group of its own", () => {
    const [a, b] = ids();
    s().selectMany([a!, b!]);
    s().group();
    s().duplicateSelected();
    const copies = s().content.elements.slice(-2);
    expect(copies[0]!.groupId).toBeDefined();
    expect(copies[0]!.groupId).toBe(copies[1]!.groupId);
    expect(copies[0]!.groupId).not.toBe(s().content.elements[0]!.groupId);
  });

  it("clears the focused face when the box changes", () => {
    s().focusFace("front");
    expect(s().focusedFaceId).toBe("front");
    s().setSpec({
      specVersion: 2,
      styleId: "tuck-end",
      values: {},
      material: { caliperMm: 0.4, kind: "paperboard" },
    } as never);
    expect(s().focusedFaceId).toBeNull();
  });
});

describe("editor store (U4.3 design core)", () => {
  beforeEach(() => s().load({ id: "d", name: "test", spec: null }));

  it("keeps at least 200 undo steps", () => {
    for (let i = 0; i < 230; i++) s().addElement(newShape({ x: i, y: i }, "rect"));
    expect(s().past.length).toBe(200);
  });

  it("puts new elements on the side being edited, and select-all stays on that side", () => {
    s().addElement(newShape({ x: 10, y: 10 }, "rect"));
    s().setSide("inside");
    s().addElement(newText({ x: 20, y: 20 }, "ด้านใน"));
    const [outer, inner] = s().content.elements;
    expect(outer!.side).toBeUndefined();
    expect(inner!.side).toBe("inside");
    s().selectAll();
    expect(s().selectedIds).toEqual([inner!.id]);
    s().copySelected();
    s().setSide("outside");
    s().paste();
    expect(s().content.elements.at(-1)!.side).toBeUndefined();
  });

  it("clips an element placed on a focused face to that face", () => {
    s().focusFace("lid-top");
    s().addElement(newText({ x: 20, y: 20 }, "ฝาบน"));
    expect(s().content.elements.at(-1)!.clipFaceId).toBe("lid-top");
    s().focusFace(null);
    s().addElement(newText({ x: 20, y: 20 }, "ทั้งแผ่น"));
    expect(s().content.elements.at(-1)!.clipFaceId).toBeUndefined();
  });

  it("keeps ruler guides with the document, each change one undo step (C8)", () => {
    const before = s().past.length;
    const id = s().addGuide("x", 120);
    expect(s().content.guides).toEqual([{ id, axis: "x", at: 120 }]);
    s().moveGuide(id, 98);
    expect(s().content.guides![0]!.at).toBe(98);
    s().removeGuide(id);
    expect(s().content.guides).toEqual([]);
    expect(s().past.length).toBe(before + 3);
    s().undo();
    expect(s().content.guides![0]!.at).toBe(98);
  });

  it("zooms within 20–600 %, lower only to fit a large sheet (C8)", () => {
    s().setFitZoom(1);
    s().setZoom(0.01);
    expect(s().zoom).toBe(0.2);
    s().setZoom(99);
    expect(s().zoom).toBe(6);
    s().setFitZoom(0.08);
    s().setZoom(0.08);
    expect(s().zoom).toBe(0.08);
  });
});
