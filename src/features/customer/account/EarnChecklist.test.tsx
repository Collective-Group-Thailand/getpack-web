import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import account from "@/i18n/messages/th/customer/account.json";

import { buildLoyaltyTasks, REVIEW_TASK_STATES } from "../../../../mocks/store/loyalty-fixtures";

import { EarnBanner } from "./EarnBanner";
import { EarnChecklistView } from "./EarnChecklist";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderTh(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="th" messages={{ account }} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

const review = buildLoyaltyTasks(REVIEW_TASK_STATES);

describe("EarnChecklistView", () => {
  it("shows the rows in the API's order, with the recommended task in its own block", () => {
    renderTh(<EarnChecklistView data={review} />);
    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    const titles = rows.map((row) => row.textContent ?? "");
    const expected = review.tasks
      .filter((task) => !task.recommended)
      .map((task) => (account.points.tasks as Record<string, { title: string }>)[task.code]!.title);
    expect(titles.map((text, index) => text.startsWith(expected[index]!))).toEqual(expected.map(() => true));
    expect(screen.getByText("แนะนำถัดไป")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เพิ่มข้อมูล" })).toHaveAttribute("href", "/account/addresses#book-tax");
  });

  it("says how much is left and how many are done", () => {
    renderTh(<EarnChecklistView data={review} />);
    expect(screen.getByText(`รับได้อีก ${review.remainingPoints} แต้ม · ทำแล้ว 3 จาก 13`)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
  });

  it("states the 12-month cap and what is left of it in the footer", () => {
    renderTh(<EarnChecklistView data={review} />);
    expect(screen.getByText("แต้มจากกิจกรรมรวมได้สูงสุด 600 แต้มต่อ 12 เดือน · เหลือ 564 แต้ม")).toBeInTheDocument();
  });

  it("says the cap is reached and offers no next step", () => {
    renderTh(<EarnChecklistView data={buildLoyaltyTasks(REVIEW_TASK_STATES, { activityEarned12m: 600 })} />);
    expect(screen.getByText(/ได้แต้มจากกิจกรรมครบ 600 แต้มสำหรับ 12 เดือนนี้แล้ว/)).toBeInTheDocument();
    expect(screen.queryByText("แนะนำถัดไป")).not.toBeInTheDocument();
  });

  it("shows a held task only as under review, never why", () => {
    renderTh(<EarnChecklistView data={review} />);
    const held = screen.getByText("ทีมงานกำลังตรวจสอบข้อมูล").closest("div")!;
    expect(within(held).getByText("รอตรวจสอบ")).toBeInTheDocument();
    expect(held.textContent).not.toMatch(/ซ้ำ|บัญชีอื่น/);
    // Not a link: there is nothing for the customer to do.
    expect(held.closest("a")).toBeNull();
  });

  it("names each status for screen readers", () => {
    renderTh(<EarnChecklistView data={review} />);
    expect(screen.getAllByText(", ยังไม่ได้ทำ").length).toBe(8);
    expect(screen.getAllByText(", ได้รับแล้ว").length).toBe(3);
  });

  it("collapses to one line when every task is done", () => {
    const all = Object.fromEntries(
      review.tasks.map((task) => [task.code, { status: "done", doneAt: "2026-11-01T00:00:00.000Z" }]),
    );
    renderTh(<EarnChecklistView data={buildLoyaltyTasks(all)} />);
    expect(screen.getByText("ทำครบทุกข้อแล้ว")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("limits the compact variant to five rows and links to the rest", () => {
    renderTh(<EarnChecklistView data={review} variant="compact" />);
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByRole("link", { name: "ดูทั้งหมด 13 รายการ" })).toHaveAttribute("href", "/account/points#earn");
  });

  it("offers a retry when the list could not be read", () => {
    const retry = vi.fn();
    renderTh(<EarnChecklistView state="error" onRetry={retry} />);
    screen.getByRole("button", { name: "ลองอีกครั้ง" }).click();
    expect(retry).toHaveBeenCalled();
  });
});

describe("EarnBanner", () => {
  it("links to the checklist with the points left", () => {
    renderTh(<EarnBanner tasks={review} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/account/points#earn");
    expect(screen.getByText(`รับแต้มเพิ่ม ${review.remainingPoints} แต้ม`)).toBeInTheDocument();
  });

  it("is hidden when nothing is left to earn", () => {
    const { container } = renderTh(<EarnBanner tasks={{ ...review, remainingPoints: 0 }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is hidden when the checklist could not be read", () => {
    const { container } = renderTh(<EarnBanner tasks={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
