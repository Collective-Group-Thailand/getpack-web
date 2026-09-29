import { describe, expect, it } from "vitest";

import { ApiError } from "./problem";
import { problemCopy, type ProblemTranslator } from "./problem-copy";

const COPY: Record<string, string> = {
  "auth.otp_invalid": "รหัส OTP ไม่ถูกต้อง",
  "bff.origin_mismatch": "คำขอถูกปฏิเสธเพื่อความปลอดภัย",
};
const t = Object.assign((key: string) => COPY[key]!, { has: (key: string) => key in COPY }) as ProblemTranslator;

const error = (code: string, detail: string) =>
  new ApiError({ type: `https://errors.packio/${code}`, title: code, status: 400, code, detail, requestId: "r-1" });

describe("problemCopy", () => {
  it("puts this app's title over the API's own detail, which carries the values", () => {
    expect(problemCopy(error("auth.otp_invalid", "รหัส OTP ไม่ถูกต้อง เหลือโอกาสอีก 2 ครั้ง"), t)).toEqual({
      title: "รหัส OTP ไม่ถูกต้อง",
      detail: "รหัส OTP ไม่ถูกต้อง เหลือโอกาสอีก 2 ครั้ง",
    });
  });

  it("keeps the BFF's developer-facing detail off the screen", () => {
    expect(problemCopy(error("bff.origin_mismatch", "The Origin header is not this host."), t)?.detail).toBeNull();
  });

  it("returns null for a code without copy, so the caller uses its own wording", () => {
    expect(problemCopy(error("http.502", "Bad Gateway"), t)).toBeNull();
  });
});
