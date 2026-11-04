import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import account from "@/i18n/messages/th/customer/account.json";
import checkout from "@/i18n/messages/th/customer/checkout.json";
import { multiplierParts, shortMultiplier } from "@/features/shared/loyalty-p2/multipliers";

import { DataRefreshBanner } from "./DataRefreshBanner";
import { PointsBreakdown } from "./PointsBreakdown";
import { ReorderBonusBadge } from "./ReorderBonusBadge";
import { WinbackBanner } from "./WinbackBanner";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderTh(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="th" messages={{ account, checkout }} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

const multipliers = {
  tier: "1.25",
  paymentMethod: "1.00",
  reorderCampaign: "1.50",
  promotion: "1.00",
  combined: "1.88",
  capped: false,
};

describe("multipliers", () => {
  it("names only the multipliers that are not ×1, with the API's figures", () => {
    expect(multiplierParts(multipliers)).toEqual([
      { part: "tier", value: "1.25" },
      { part: "reorderCampaign", value: "1.5" },
    ]);
    expect(multiplierParts(null)).toEqual([]);
    expect(shortMultiplier("2.00")).toBe("2");
    expect(shortMultiplier("1.20")).toBe("1.2");
  });
});

describe("ReorderBonusBadge", () => {
  it("states the multiplier and a fixed end date, never a countdown", () => {
    renderTh(<ReorderBonusBadge multiplier="1.50" endsAt="2026-11-12T09:40:00+07:00" />);
    expect(screen.getByText("แต้ม ×1.5")).toBeInTheDocument();
    const line = screen.getByText(/สั่งซ้ำรับแต้มเพิ่ม/);
    expect(line).toHaveTextContent("12 พ.ย.");
    expect(line.textContent).not.toMatch(/เหลือ|ชั่วโมง|นาที|ทันที/);
  });
});

describe("WinbackBanner", () => {
  const lot = { points: 40, reason: "winback" as const, expiresAt: "2026-12-04T23:59:59+07:00" };

  it("offers the bonus in neutral words and links to the deals", () => {
    renderTh(<WinbackBanner lots={[lot]} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/deals");
    expect(screen.getByText("มี 40 แต้มโบนัสรอคุณอยู่")).toBeInTheDocument();
    expect(screen.getByRole("link").textContent).not.toMatch(/ไม่ได้สั่ง|ห่างหาย|นาน|คิดถึง/);
  });

  it("goes to the LIFF deals from LIFF and shows nothing without a win-back lot", () => {
    const { container, rerender } = renderTh(<WinbackBanner lots={[lot]} variant="liff" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/liff/deals");
    rerender(
      <NextIntlClientProvider locale="th" messages={{ account, checkout }} timeZone="Asia/Bangkok">
        <WinbackBanner lots={[{ ...lot, reason: "first_order" }]} />
      </NextIntlClientProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("PointsBreakdown", () => {
  it("shows the API's points with the multipliers and the QR / transfer hint", () => {
    renderTh(
      <PointsBreakdown
        toEarn={22}
        p2={{
          multipliers,
          paymentBonus: { multiplier: "1.20", methods: ["scb_qr"] },
          toEarnWithPaymentBonus: 27,
        }}
      />,
    );
    expect(screen.getByText(/22 แต้ม/)).toHaveTextContent("ระดับสมาชิก ×1.25 · สั่งซ้ำ ×1.5");
    expect(screen.getByText(/ชำระด้วย QR หรือโอนเงิน/)).toHaveTextContent("×1.2 เป็น 27 แต้ม");
  });

  it("leaves the hint out when the chosen payment already earns the bonus", () => {
    renderTh(
      <PointsBreakdown
        toEarn={27}
        p2={{ multipliers: null, paymentBonus: { multiplier: "1.20", methods: [] }, toEarnWithPaymentBonus: 27 }}
      />,
    );
    expect(screen.queryByText(/ชำระด้วย QR/)).not.toBeInTheDocument();
  });
});

describe("DataRefreshBanner", () => {
  const refresh = {
    due: true,
    lastConfirmedAt: "2025-11-02T10:00:00+07:00",
    nextDueAt: null,
    rewardPoints: 12,
    company: null,
    taxProfiles: [],
    addresses: [],
  };

  it("asks for the yearly confirmation with the API's reward and links to the page", () => {
    renderTh(<DataRefreshBanner refresh={refresh} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/account/confirm-data");
    expect(link).toHaveTextContent("ตรวจและยืนยันรับ 12 แต้ม");
  });

  it("stays out of the way for the first confirmation, when not due, and without a reward line at 0", () => {
    const { rerender } = renderTh(<DataRefreshBanner refresh={{ ...refresh, lastConfirmedAt: null }} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    rerender(
      <NextIntlClientProvider locale="th" messages={{ account, checkout }} timeZone="Asia/Bangkok">
        <DataRefreshBanner refresh={{ ...refresh, due: false }} />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    rerender(
      <NextIntlClientProvider locale="th" messages={{ account, checkout }} timeZone="Asia/Bangkok">
        <DataRefreshBanner refresh={{ ...refresh, rewardPoints: 0 }} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("link")).not.toHaveTextContent("แต้ม");
  });
});
