import { beforeEach, describe, expect, it } from "vitest";

import { overlaysFor, useEditorMode } from "./mode";

describe("editor mode (D-456)", () => {
  beforeEach(() => {
    localStorage.clear();
    useEditorMode.setState({ mode: "easy", chosen: false, tool: "select" });
  });

  it("asks once: nothing chosen in a new browser, the choice kept after", () => {
    useEditorMode.getState().hydrate();
    expect(useEditorMode.getState()).toMatchObject({ mode: "easy", chosen: false });
    useEditorMode.getState().setMode("pro");
    useEditorMode.setState({ mode: "easy", chosen: false });
    useEditorMode.getState().hydrate();
    expect(useEditorMode.getState()).toMatchObject({ mode: "pro", chosen: true });
  });

  it("adopts the account's mode over this browser's", () => {
    useEditorMode.getState().setMode("easy");
    useEditorMode.getState().adopt("pro");
    expect(useEditorMode.getState().mode).toBe("pro");
    expect(localStorage.getItem("getpack.editorMode")).toBe("pro");
  });

  it("drops the pro tool when switching to easy", () => {
    useEditorMode.getState().setMode("pro");
    useEditorMode.getState().setTool("pen");
    useEditorMode.getState().setMode("easy");
    expect(useEditorMode.getState().tool).toBe("select");
  });

  it("shows only cut, fold and panel names in easy mode", () => {
    const all = { cut: true, fold: true, bleed: true, safe: true, labels: true, grid: true };
    expect(overlaysFor("easy", all)).toEqual({
      cut: true,
      fold: true,
      labels: true,
      bleed: false,
      safe: false,
      grid: false,
    });
    expect(overlaysFor("pro", all)).toBe(all);
  });
});
