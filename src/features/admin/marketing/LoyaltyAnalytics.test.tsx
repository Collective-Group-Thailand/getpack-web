import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import marketing from "@/i18n/messages/th/admin/marketing.json";
import common from "@/i18n/messages/th/common/common.json";

import { loyaltyAnalyticsOf } from "../../../../mocks/admin/loyalty-p2";

import { LoyaltyAnalytics, recentMonths } from "./LoyaltyAnalytics";

const contract = { GET: vi.fn() };
vi.mock("../console", () => ({
  adminBrowserApis: () => ({ contract }),
  QueryError: () => <p>error</p>,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderTh() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="th" messages={{ marketing, common } as never} timeZone="Asia/Bangkok">
        <LoyaltyAnalytics />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => contract.GET.mockReset().mockResolvedValue({ data: loyaltyAnalyticsOf("2026-05", "2026-10") }));

describe("recentMonths", () => {
  it("lists whole months only, newest first, in Bangkok time", () => {
    // 1 Nov 2026 01:00 in Bangkok is still 31 Oct in UTC: November is not whole, so October leads.
    expect(recentMonths(new Date("2026-10-31T18:00:00Z"), 3)).toEqual(["2026-10", "2026-09", "2026-08"]);
    expect(recentMonths(new Date("2027-01-15T00:00:00Z"), 2)).toEqual(["2026-12", "2026-11"]);
  });
});

describe("LoyaltyAnalytics", () => {
  it("shows the liability at the rate with its CPA flag and the ledger difference, all as the API sent them", async () => {
    renderTh();
    expect(await screen.findByText("฿273,600.00")).toBeInTheDocument();
    expect(screen.getByText("รอ CPA ยืนยัน")).toBeInTheDocument();
    expect(screen.getByText("ข้อมูล 7 จาก 12 เดือน")).toBeInTheDocument();
    expect(screen.getByText("฿3,450.00")).toBeInTheDocument();
    expect(contract.GET).toHaveBeenCalledWith("/v1/admin/loyalty/analytics", {
      params: { query: expect.objectContaining({ from: expect.stringMatching(/^\d{4}-\d{2}$/) }) },
    });
  });

  it("tables the monthly movement and withholds a programme rate under 10 customers", async () => {
    renderTh();
    const movement = (await screen.findAllByRole("table", { name: "ความเคลื่อนไหวแต้มรายเดือน" }))[0]!;
    expect(within(movement).getByText("182,400")).toBeInTheDocument();
    const programmes = screen.getAllByRole("table", { name: "ผลของโปรแกรมรักษาลูกค้า" })[0]!;
    const survey = within(programmes).getByText("แบบสอบถาม").closest("tr")!;
    expect(within(survey).getByText("น้อยกว่า 10 ราย ไม่แสดงอัตรา")).toBeInTheDocument();
  });
});
