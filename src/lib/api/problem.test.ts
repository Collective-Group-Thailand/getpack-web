import { describe, expect, it, vi } from "vitest";

import { ApiError, applyProblemToForm, isApiError, toApiError, type ProblemDetails } from "./problem";

const problem: ProblemDetails = {
  type: "https://errors.packio/order.invalid_transition",
  title: "Invalid order transition",
  status: 422,
  code: "order.invalid_transition",
  detail: "ไม่สามารถเปลี่ยนสถานะคำสั่งซื้อได้",
  requestId: "req-1",
  errors: [
    { path: "items[0].quantity", code: "min", message: "อย่างน้อย 100 ชิ้น" },
    { path: "email", code: "format", message: "อีเมลไม่ถูกต้อง" },
  ],
};

function problemResponse(body: unknown, status = 422, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/problem+json", ...headers },
  });
}

describe("toApiError", () => {
  it("carries the code, the localised detail and the request id", async () => {
    const error = await toApiError(problemResponse(problem));

    expect(isApiError(error)).toBe(true);
    expect(error.code).toBe("order.invalid_transition");
    expect(error.detail).toBe("ไม่สามารถเปลี่ยนสถานะคำสั่งซื้อได้");
    expect(error.message).toBe(error.detail);
    expect(error.requestId).toBe("req-1");
    expect(error.errors).toHaveLength(2);
  });

  it("still produces an error when the body is not problem details", async () => {
    const error = await toApiError(new Response("<html>502 Bad Gateway</html>", { status: 502 }));

    expect(error.status).toBe(502);
    expect(error.code).toBe("http.502");
    expect(error.detail).not.toBe("");
  });

  it("takes the request id from the response header when the body has none", async () => {
    const withoutId = { ...problem, requestId: "" };
    const error = await toApiError(problemResponse(withoutId, 422, { "x-request-id": "header-id" }));

    expect(error.requestId).toBe("header-id");
  });

  it("falls back to the id the caller sent, so a failure is always traceable", async () => {
    const error = await toApiError(new Response(null, { status: 500 }), "sent-id");

    expect(error.requestId).toBe("sent-id");
  });

  it("leaves the response body readable by the caller", async () => {
    const response = problemResponse(problem);
    await toApiError(response);

    await expect(response.json()).resolves.toMatchObject({ code: "order.invalid_transition" });
  });
});

describe("ApiError classification", () => {
  const withStatus = (status: number, code = "x") => new ApiError({ ...problem, status, code, errors: undefined });

  it("retries only what retrying can fix", () => {
    expect(withStatus(500).isRetryable).toBe(true);
    expect(withStatus(503).isRetryable).toBe(true);
    expect(withStatus(429).isRetryable).toBe(true);
    expect(withStatus(408).isRetryable).toBe(true);
    expect(withStatus(422).isRetryable).toBe(false);
    expect(withStatus(404).isRetryable).toBe(false);
    expect(withStatus(401).isRetryable).toBe(false);
  });

  it("recognises a lost session", () => {
    expect(withStatus(401).isUnauthenticated).toBe(true);
    expect(withStatus(403).isUnauthenticated).toBe(false);
  });

  it("recognises a stale edit by status or by code", () => {
    expect(withStatus(412).isStale).toBe(true);
    expect(withStatus(409, "concurrency.stale").isStale).toBe(true);
    expect(withStatus(409, "order.invalid_transition").isStale).toBe(false);
  });
});

describe("applyProblemToForm", () => {
  it("maps each field error onto the form, path syntax unchanged", () => {
    const setError = vi.fn();
    const unplaced = applyProblemToForm(new ApiError(problem), setError);

    expect(setError).toHaveBeenCalledWith("items[0].quantity", { type: "min", message: "อย่างน้อย 100 ชิ้น" });
    expect(setError).toHaveBeenCalledWith("email", { type: "format", message: "อีเมลไม่ถูกต้อง" });
    expect(unplaced).toEqual([]);
  });

  it("returns errors for fields the form does not render instead of hiding them", () => {
    const setError = vi.fn();
    const unplaced = applyProblemToForm(new ApiError(problem), setError, { fields: ["email"] });

    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith("email", expect.anything());
    // Setting `items[0].quantity` on a form with no such field would mark it invalid with a
    // message nothing displays: the user would see a form that refuses to submit and says
    // nothing about why. It belongs in the error summary instead.
    expect(unplaced).toEqual([{ path: "items[0].quantity", code: "min", message: "อย่างน้อย 100 ชิ้น" }]);
  });

  it("matches an owned field by its root, so items[0].quantity belongs to items", () => {
    const setError = vi.fn();
    const unplaced = applyProblemToForm(new ApiError(problem), setError, { fields: ["items"] });

    expect(setError).toHaveBeenCalledWith("items[0].quantity", expect.anything());
    expect(unplaced.map((error) => error.path)).toEqual(["email"]);
  });

  it("does nothing when the problem carries no field errors", () => {
    const setError = vi.fn();
    const unplaced = applyProblemToForm(new ApiError({ ...problem, errors: undefined }), setError);

    expect(setError).not.toHaveBeenCalled();
    expect(unplaced).toEqual([]);
  });
});
