import { describe, expect, it } from "vitest";

import { boxStyleOf } from "./ConfiguratorPreview";
import type { Configurator, ConfiguratorState } from "./state";

const of = (pattern: { code: string; dielineKey: string | null }) =>
  boxStyleOf(
    { patterns: [{ id: "p1", parts: [], ...pattern }] } as unknown as Configurator,
    { patternId: "p1" } as ConfiguratorState,
  );

/** C7 (DECISIONS-STAGE-A §2): every drawable product offers "ออกแบบในสตูดิโอ". */
describe("boxStyleOf", () => {
  it("resolves the pattern's dieline key (aliases too)", () => {
    expect(of({ code: "X", dielineKey: "rte" })).toBe("reverse-tuck-end");
    expect(of({ code: "X", dielineKey: "rsc" })).toBe("rsc");
  });

  it("falls back to the core recipe of a pattern whose code is a style-library base", () => {
    expect(of({ code: "PK-CS-01", dielineKey: null })).toBe("rsc");
    expect(of({ code: "PK-CF-01", dielineKey: "FEFCO-0427" })).toBe("mailer");
  });

  it("is null when nothing names a drawing", () => {
    expect(of({ code: "DEV-OPEN-TOP", dielineKey: null })).toBeNull();
  });
});
