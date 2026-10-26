import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import common from "@/i18n/messages/th/common/common.json";
import { ApiError } from "@/lib/api/problem";

import { RouteError } from "./RouteError";

vi.mock("./NextStep", () => ({ NextStep: () => null }));
vi.mock("@/lib/observability/report", () => ({ reportError: () => undefined }));

const outage = () =>
  new ApiError({
    type: "t",
    title: "t",
    status: 503,
    code: "provider.unavailable",
    detail: "d",
    requestId: "5fe1ecce-1234-4abc-8def-2fb5e788f013",
  });

function view(error: Error & { digest?: string }, reset: () => void) {
  return render(
    <NextIntlClientProvider locale="th" messages={{ common }}>
      <RouteError error={error} reset={reset} />
    </NextIntlClientProvider>,
  );
}

let path = 0;
beforeEach(() => {
  vi.useFakeTimers();
  // Retries are counted per address; each test is a different one.
  window.history.pushState({}, "", `/account/orders/${++path}`);
});
afterEach(() => vi.useRealTimers());

describe("the customer error state", () => {
  it("says the system is temporarily unavailable, shows the reference and retries by itself", () => {
    const reset = vi.fn();
    view(outage(), reset);
    expect(screen.getByRole("alert")).toHaveTextContent("ระบบขัดข้องชั่วคราว");
    expect(screen.getByText("PK-88F013")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("กำลังลองใหม่อัตโนมัติ (ครั้งที่ 1 จาก 3)");
    expect(reset).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(3000));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("stops after three automatic attempts and leaves a manual retry", () => {
    const reset = vi.fn();
    const error = outage();
    const first = view(error, reset);
    act(() => void vi.advanceTimersByTime(3000));
    first.unmount();
    // The boundary is mounted anew after a failed reset: the count survives.
    const second = view(error, reset);
    act(() => void vi.advanceTimersByTime(6000));
    second.unmount();
    view(error, reset);
    act(() => void vi.advanceTimersByTime(12000));
    expect(reset).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("alert")).not.toHaveTextContent("กำลังลองใหม่อัตโนมัติ");
    act(() => void vi.advanceTimersByTime(60_000));
    expect(reset).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("button", { name: "ลองอีกครั้ง" })).toBeInTheDocument();
  });

  it("does not retry a failure that is not temporary", () => {
    const reset = vi.fn();
    view(Object.assign(new Error("x is not a function"), { digest: "123456" }), reset);
    expect(screen.getByRole("alert")).toHaveTextContent("เกิดข้อผิดพลาด");
    act(() => void vi.advanceTimersByTime(60_000));
    expect(reset).not.toHaveBeenCalled();
  });
});
