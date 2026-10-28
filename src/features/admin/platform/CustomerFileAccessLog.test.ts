import { describe, expect, it } from "vitest";

import { fileAccessLogExportQuery, fileAccessLogQuery } from "./CustomerFileAccessLog";

const ID = "0192f3a0-7c1e-7d2a-9b1f-0000000f1014";

/** C1f (owner 2026-10-28 13:58, D-451, DECISIONS-STAGE-A §14.7): the log page's filters → the API and the export. */
describe("customer file access log filters", () => {
  it("maps the kind filter to a file kind or to the Superadmin reason accesses", () => {
    expect(fileAccessLogQuery({ kind: "production_copy" })).toMatchObject({
      fileKind: "production_copy",
      withReason: undefined,
    });
    expect(fileAccessLogQuery({ kind: "reason" })).toMatchObject({ fileKind: undefined, withReason: true });
    expect(fileAccessLogQuery({ kind: "nonsense" })).toMatchObject({ fileKind: undefined, withReason: undefined });
  });

  it("sends Bangkok day bounds (to inclusive) and leaves unusable typed values out", () => {
    const q = fileAccessLogQuery({
      from: "2026-10-01",
      to: "2026-10-28",
      orderCode: " DEVOR-2610-00001 ",
      fileId: "not-a-uuid",
      userId: ID,
    });
    expect(q.from).toBe("2026-09-30T17:00:00.000Z");
    expect(q.to).toBe("2026-10-28T17:00:00.000Z");
    expect(q.orderCode).toBe("DEVOR-2610-00001");
    expect(q.fileId).toBeUndefined();
    expect(q.userId).toBe(ID);
    expect(fileAccessLogQuery({ orderCode: "ไม่ใช่รหัส" }).orderCode).toBeUndefined();
  });

  it("exports with the same filters, days kept as days", () => {
    expect(fileAccessLogExportQuery({ kind: "reason", from: "2026-10-01", to: "2026-10-28", fileId: ID })).toEqual({
      withReason: "true",
      fileId: ID,
      from: "2026-10-01",
      to: "2026-10-28",
    });
    expect(fileAccessLogExportQuery({})).toEqual({});
  });
});
