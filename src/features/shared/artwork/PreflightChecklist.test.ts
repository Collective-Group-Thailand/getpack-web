import { describe, expect, it } from "vitest";

import { checklistRows, CORE_CHECKS, requestNewFileMessage } from "./PreflightChecklist";

const result = (check: string, outcome: string, severity = "block", messageTh = "ข้อความ") =>
  ({ check, outcome, severity, messageTh, messageEn: "message", page: null, measurements: {} }) as never;

describe("the preflight checklist (UX audit)", () => {
  it("always lists the five core checks, then other findings", () => {
    const rows = checklistRows(
      [
        result("size_mismatch", "pass"),
        result("missing_bleed", "fail", "block", "ไม่มีระยะตัดตก 3 มม."),
        result("rgb_colour", "fail", "warn"),
        result("thin_lines", "fail", "warn"),
        result("overprint", "pass"),
      ],
      "th",
    );
    expect(rows.map((row) => row.check)).toEqual([...CORE_CHECKS, "thin_lines"]);
    expect(rows.find((row) => row.check === "size_mismatch")?.state).toBe("pass");
    expect(rows.find((row) => row.check === "missing_bleed")).toMatchObject({
      state: "fail",
      message: "ไม่มีระยะตัดตก 3 มม.",
    });
    expect(rows.find((row) => row.check === "rgb_colour")?.state).toBe("warn");
    expect(rows.find((row) => row.check === "low_resolution")?.state).toBe("unknown");
  });

  it("drafts the customer's message from what did not pass", () => {
    const rows = checklistRows([result("missing_bleed", "fail", "block", "ไม่มีระยะตัดตก")], "th");
    expect(requestNewFileMessage(rows, (check) => `[${check}]`)).toBe("• [missing_bleed] — ไม่มีระยะตัดตก");
  });
});
