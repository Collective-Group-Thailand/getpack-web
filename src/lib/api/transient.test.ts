import { describe, expect, it } from "vitest";

import { ApiError } from "./problem";
import { classifyError } from "./transient";

const api = (status: number, requestId = "5fe1ecce-1234-4abc-8def-2fb5e788f013") =>
  new ApiError({ type: "t", title: "t", status, code: `http.${status}`, detail: "d", requestId });

describe("classifyError", () => {
  it.each([429, 502, 503, 504])("treats an API %s as temporary and keeps its request id as the reference", (status) => {
    expect(classifyError(api(status))).toEqual({
      kind: "transient",
      reference: "5fe1ecce-1234-4abc-8def-2fb5e788f013",
    });
  });

  it.each([400, 404, 409, 422, 500])("does not retry an API %s", (status) => {
    expect(classifyError(api(status)).kind).toBe("generic");
  });

  it("treats a network failure as temporary", () => {
    expect(classifyError(new TypeError("Failed to fetch")).kind).toBe("transient");
    expect(classifyError(new TypeError("Load failed")).kind).toBe("transient");
  });

  it("treats a hidden server render failure as temporary, referenced by its digest", () => {
    const error = Object.assign(
      new Error(
        "An error occurred in the Server Components render. The specific message is omitted in production builds",
      ),
      {
        digest: "200002",
      },
    );
    expect(classifyError(error)).toEqual({ kind: "transient", reference: "200002" });
  });

  it("leaves a bug in the page generic", () => {
    expect(classifyError(new Error("x is not a function")).kind).toBe("generic");
  });
});
