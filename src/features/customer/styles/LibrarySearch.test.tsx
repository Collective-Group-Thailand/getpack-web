import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import styles from "@/i18n/messages/th/customer/styles.json";

import { LibrarySearch } from "./LibrarySearch";
import { emptyParams } from "./query";

const router = { replace: vi.fn(), push: vi.fn() };
vi.mock("@/i18n/navigation", () => ({ useRouter: () => router }));

const view = (props: Partial<React.ComponentProps<typeof LibrarySearch>> = {}) =>
  render(
    <NextIntlClientProvider locale="th" messages={{ styles }}>
      <LibrarySearch params={emptyParams()} action="/styles" quickTerms={[]} {...props} />
    </NextIntlClientProvider>,
  );

describe("the library's live search", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    router.replace.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("follows the words after 160 ms of rest, with no submit button", () => {
    view();
    expect(screen.queryByRole("button", { name: /ค้นหา$/ })).toBeNull();
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "เค" } });
    fireEvent.change(input, { target: { value: "เค้ก" } });
    act(() => void vi.advanceTimersByTime(159));
    expect(router.replace).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace.mock.calls[0]?.[0]).toBe("/styles?q=%E0%B9%80%E0%B8%84%E0%B9%89%E0%B8%81");
  });

  it("keeps the filters, drops the quick view and an explicit order when the words change", () => {
    view({ params: { ...emptyParams(), useCase: ["gift"], sort: "new", style: "PK-RG-01" } });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "box" } });
    act(() => void vi.advanceTimersByTime(160));
    expect(router.replace.mock.calls[0]?.[0]).toBe("/styles?q=box&use=gift");
  });

  it('focuses on "/" unless the customer is already typing somewhere', () => {
    view();
    fireEvent.keyDown(document.body, { key: "/" });
    expect(screen.getByRole("searchbox")).toHaveFocus();
    screen.getByRole("searchbox").blur();
    const other = document.createElement("input");
    document.body.append(other);
    other.focus();
    fireEvent.keyDown(other, { key: "/" });
    expect(screen.getByRole("searchbox")).not.toHaveFocus();
    other.remove();
  });

  it("shows no quick-term row when staff configured none (nothing invented)", () => {
    view();
    expect(screen.queryByText(styles.library.quickSearch)).toBeNull();
  });

  it("searches a quick term at once", () => {
    view({ quickTerms: [{ label: "แม่เหล็ก", query: "magnet" }] });
    fireEvent.click(screen.getByRole("button", { name: "แม่เหล็ก" }));
    expect(router.replace.mock.calls[0]?.[0]).toBe("/styles?q=magnet");
    expect(screen.getByRole("searchbox")).toHaveValue("magnet");
  });
});
