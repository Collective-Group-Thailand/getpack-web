import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useEditor } from "../store/editor";
import { type PersistenceConfig, usePersistence } from "./persistence";

const spec = {
  specVersion: 2 as const,
  styleId: "rsc",
  values: { length: 150, width: 100, height: 80 },
  material: { caliperMm: 1.6, kind: "corrugated" as const, flute: "E" },
  materialId: "e-white",
};

const config = (overrides: Partial<PersistenceConfig> = {}): PersistenceConfig => ({
  mode: "local",
  editable: true,
  serverId: null,
  etag: null,
  versionNo: null,
  updatedAt: null,
  thumbnail: () => null,
  ...overrides,
});

describe("usePersistence onSaved", () => {
  beforeEach(() => {
    localStorage.clear();
    useEditor.getState().load({ id: "design-1", name: "กล่องทดสอบ", spec });
  });

  it("is called after a save the browser confirmed", async () => {
    const onSaved = vi.fn();
    const { result } = renderHook(() => usePersistence(config({ onSaved })));
    await act(async () => {
      expect(await result.current.save("manual")).toBe(true);
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("is not called when nothing could be saved", async () => {
    const onSaved = vi.fn();
    useEditor.getState().load({ id: "design-2", name: "ไม่มีกล่อง", spec: null });
    const { result } = renderHook(() => usePersistence(config({ onSaved })));
    await act(async () => {
      expect(await result.current.save("manual")).toBe(false);
    });
    expect(onSaved).not.toHaveBeenCalled();
  });
});
