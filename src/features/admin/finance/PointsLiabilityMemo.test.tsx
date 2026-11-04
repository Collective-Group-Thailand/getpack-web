import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import finance from "@/i18n/messages/th/admin/finance.json";
import common from "@/i18n/messages/th/common/common.json";

import { PointsLiabilityMemo } from "./PointsLiabilityMemo";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const memo = {
  asOf: "2026-10-31",
  outstandingPoints: 182400,
  faceValue: "456000.00",
  expectedRedemptionRatePct: "60",
  rateConfirmation: "pending_cpa",
  estimatedLiability: "273600.00",
  ledgerBalance2330: "270150.00",
  pointsExpenseInPeriod: "4860.00",
  source: "loyalty.expected_redemption_rate_pct",
};

describe("PointsLiabilityMemo", () => {
  it("states the estimate at the rate, the CPA flag and the ledger balance as the API sent them", () => {
    render(
      <NextIntlClientProvider locale="th" messages={{ finance, common } as never} timeZone="Asia/Bangkok">
        <PointsLiabilityMemo memo={memo} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/ภาระแต้มสะสม \(ประมาณการ ที่อัตราใช้แต้ม 60%\)/)).toBeInTheDocument();
    expect(screen.getByText("รอ CPA ยืนยัน")).toBeInTheDocument();
    expect(screen.getByText("฿273,600.00")).toBeInTheDocument();
    expect(screen.getByText("฿270,150.00")).toBeInTheDocument();
    expect(screen.getByText("ไม่รวมในงบข้างบน")).toBeInTheDocument();
  });
});
