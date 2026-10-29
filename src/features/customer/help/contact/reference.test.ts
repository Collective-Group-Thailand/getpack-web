import { describe, expect, it } from "vitest";

import { classifyReference, verifierOf } from "./reference";

describe("contact tracking box (C10)", () => {
  it("tells an order code from a request number (the API's CS- reference, D-440)", () => {
    expect(classifyReference(" pk-2569-00100 ")).toEqual({ type: "order", code: "PK-2569-00100" });
    expect(classifyReference("PK-2610-0001-01")).toEqual({ type: "order", code: "PK-2610-0001-01" });
    expect(classifyReference("cs-2610-00001")).toEqual({ type: "ticket", code: "CS-2610-00001" });
    expect(classifyReference("hello")).toBeNull();
  });

  it("accepts a mobile number or an e-mail as a guest's proof", () => {
    expect(verifierOf("081-234-5678")).toEqual({ phone: "0812345678" });
    expect(verifierOf("+66812345678")).toEqual({ phone: "0812345678" });
    expect(verifierOf("me@example.test")).toEqual({ email: "me@example.test" });
    expect(verifierOf("12")).toBeNull();
  });
});
