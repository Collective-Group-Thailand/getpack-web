import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import account from "@/i18n/messages/th/customer/account.json";
import deals from "@/i18n/messages/th/customer/deals.json";
import { ApiError } from "@/lib/api/problem";

import {
  BLOCKED_REWARDS,
  GOLD,
  GOLD_POINTS,
  PLATINUM,
  SAMPLE_LIST,
  SAMPLE_NOW,
  SAMPLE_POINTS,
  SAMPLE_REDEMPTIONS,
  SAMPLE_REWARDS,
} from "./fixtures";
import { MyRewardCoupons } from "./MyRewardCoupons";
import { RedeemSheet } from "./RedeemSheet";
import { RewardCard } from "./RewardCard";
import { RewardsTab } from "./RewardsTab";
import { TierPerks } from "./TierPerks";

const call = vi.fn();
vi.mock("@/lib/api/requests/browser", () => ({ browserRequests: () => ({ call }) }));
vi.mock("@/ui/components/Toast", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderTh(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="th" messages={{ account, deals }} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => call.mockReset());

describe("RewardCard", () => {
  it("puts the cost on the stub and offers one outline action", () => {
    const onRedeem = vi.fn();
    renderTh(<RewardCard item={SAMPLE_REWARDS[2]!} onRedeem={onRedeem} />);
    const card = screen.getByRole("article", { name: "ส่งฟรี 1 คำสั่งซื้อ · 60 แต้ม" });
    expect(within(card).getByText("60")).toBeTruthy();
    expect(within(card).getByText("ขั้นต่ำ ฿2,000")).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "แลกส่งฟรี 1 คำสั่งซื้อ ด้วย 60 แต้ม" }));
    expect(onRedeem).toHaveBeenCalledWith(SAMPLE_REWARDS[2]);
  });

  it.each([
    [BLOCKED_REWARDS[0]!, "แต้มไม่พอ — ขาดอีก 12 แต้ม"],
    [BLOCKED_REWARDS[1]!, "สำหรับสมาชิกโกลด์ขึ้นไป"],
    [BLOCKED_REWARDS[2]!, "มีคูปองนี้ที่ยังไม่ใช้ครบจำนวนแล้ว"],
    [BLOCKED_REWARDS[3]!, "บัญชีอยู่ระหว่างตรวจสอบ แลกได้เมื่อตรวจเสร็จ"],
  ])("shows the reason instead of the action (%#)", (item, reason) => {
    renderTh(<RewardCard item={item} onRedeem={vi.fn()} />);
    expect(screen.getByText(reason)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("dates the frequency limit", () => {
    renderTh(<RewardCard item={SAMPLE_REWARDS[3]!} variant="row" onRedeem={vi.fn()} />);
    expect(screen.getByText(/^แลกได้อีกครั้ง 12 ม\.ค\. 2570$/)).toBeTruthy();
  });
});

describe("RedeemSheet", () => {
  it("states the cost and the balance after, then shows the coupon from the API", async () => {
    const item = SAMPLE_REWARDS[2]!;
    call.mockResolvedValueOnce({ ...SAMPLE_REDEMPTIONS[0]!, balanceAfter: 1190 });
    const onRedeemed = vi.fn();
    renderTh(
      <RedeemSheet item={item} balance={1250} cancelWindowDays={7} onOpenChange={vi.fn()} onRedeemed={onRedeemed} />,
    );
    expect(screen.getByText(/ใช้ 60 แต้ม/)).toBeTruthy();
    expect(screen.getByText(/คงเหลือ 1,190 แต้ม/)).toBeTruthy();
    expect(screen.getByText("ยกเลิกได้ภายใน 7 วันถ้ายังไม่ใช้ แต้มจะคืนเข้าบัญชี")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ยืนยันแลก 60 แต้ม" })));
    const [key, init] = call.mock.calls[0]!;
    expect(key).toBe("POST /v1/store/rewards/{itemId}/actions/redeem");
    expect(init).toMatchObject({ path: { itemId: item.id }, body: { expectedCostPoints: 60 } });
    expect(typeof init.idempotencyKey).toBe("string");
    expect(screen.getByText("คูปองอยู่ในกระเป๋าโค้ดแล้ว", { selector: "p" })).toBeTruthy();
    expect(screen.getByText("GP-RW-7Q4K-M2XD")).toBeTruthy();
    expect(screen.getByRole("link", { name: "ใช้กับตะกร้า" }).getAttribute("href")).toBe("/cart");
    expect(onRedeemed).toHaveBeenCalled();
  });

  it("words the cancel rule without a number when the API sends no window", () => {
    renderTh(<RedeemSheet item={SAMPLE_REWARDS[0]!} balance={1250} onOpenChange={vi.fn()} onRedeemed={vi.fn()} />);
    expect(screen.getByText("ยกเลิกได้ถ้ายังไม่ใช้ ภายในวันที่ระบุบนคูปอง แต้มจะคืนเข้าบัญชี")).toBeTruthy();
  });

  it("says a changed cost in words and keeps the sheet open", async () => {
    call.mockRejectedValueOnce(new ApiError({ status: 409, code: "rewards.cost_changed", title: "x" } as never));
    renderTh(<RedeemSheet item={SAMPLE_REWARDS[0]!} balance={1250} onOpenChange={vi.fn()} onRedeemed={vi.fn()} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ยืนยันแลก 20 แต้ม" })));
    expect(screen.getByText("จำนวนแต้มที่ใช้แลกเพิ่งเปลี่ยน ปิดแล้วเปิดรายการนี้อีกครั้ง")).toBeTruthy();
  });
});

describe("MyRewardCoupons", () => {
  it("offers the cancel inside the window only, and never on a tier perk", () => {
    renderTh(<MyRewardCoupons redemptions={SAMPLE_REDEMPTIONS} now={SAMPLE_NOW} />);
    expect(screen.getAllByRole("button", { name: "ยกเลิกการแลก" })).toHaveLength(1);
    expect(screen.getByText("สิทธิ์ตามระดับ ยกเลิกไม่ได้")).toBeTruthy();
    expect(screen.getByText("สิทธิ์ตามระดับสมาชิก · ไตรมาส 4/2569")).toBeTruthy();
  });

  it("hides the cancel once the window has closed", () => {
    renderTh(<MyRewardCoupons redemptions={SAMPLE_REDEMPTIONS} now={Date.parse("2026-11-12T10:00:00+07:00")} />);
    expect(screen.queryByRole("button", { name: "ยกเลิกการแลก" })).toBeNull();
  });

  it("cancels after one confirmation and moves the coupon to ยกเลิก", async () => {
    call.mockResolvedValueOnce({ ...SAMPLE_REDEMPTIONS[0]!, status: "cancelled", cancellableUntil: null });
    renderTh(<MyRewardCoupons redemptions={SAMPLE_REDEMPTIONS} now={SAMPLE_NOW} />);
    fireEvent.click(screen.getByRole("button", { name: "ยกเลิกการแลก" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ยกเลิกและคืนแต้ม" })));
    expect(call).toHaveBeenCalledWith("POST /v1/store/rewards/redemptions/{redemptionId}/actions/cancel", {
      path: { redemptionId: SAMPLE_REDEMPTIONS[0]!.id },
    });
    expect(screen.queryByText("GP-RW-7Q4K-M2XD")).toBeNull();
  });
});

describe("TierPerks", () => {
  it("shows Platinum at the top, the multipliers in force and only the granted perk's status", () => {
    renderTh(<TierPerks points={SAMPLE_POINTS} loyalty={PLATINUM} />);
    expect(screen.getByText("แพลทินัม")).toBeTruthy();
    expect(screen.getByText(/ระดับสูงสุดแล้ว/)).toBeTruthy();
    expect(screen.getByText("เดือนเกิดสมาชิก")).toBeTruthy();
    expect(screen.getByText("รวมกันสูงสุด ×3 ต่อคำสั่งซื้อ แต้มที่ได้จริงแสดงตอนชำระเงิน")).toBeTruthy();
    expect(screen.getByText("คิวผลิตลำดับพิเศษ")).toBeTruthy();
    expect(screen.getByRole("link", { name: "ดูคูปอง" }).getAttribute("href")).toBe("/account/points/redeem#mine");
    expect(screen.queryByText("ใช้อยู่")).toBeNull();
  });

  it("shows the way to the next tier and its perks, muted", () => {
    renderTh(<TierPerks points={GOLD_POINTS} loyalty={GOLD} />);
    expect(screen.getByRole("meter")).toBeTruthy();
    expect(screen.getByText("เมื่อถึงระดับแพลทินัม")).toBeTruthy();
  });
});

describe("RewardsTab (/deals?tab=points)", () => {
  it("gives a guest the costs under one sign-in card, with no action on the tickets", () => {
    renderTh(<RewardsTab list={{ ...SAMPLE_LIST, balance: null }} signedIn={false} />);
    expect(screen.getByRole("heading", { name: "เข้าสู่ระบบเพื่อแลกแต้ม" })).toBeTruthy();
    expect(screen.queryAllByRole("link", { name: /^แลก/ })).toHaveLength(0);
  });

  it("links each redeemable reward to its place on the redeem page", () => {
    renderTh(<RewardsTab list={SAMPLE_LIST} signedIn />);
    const links = screen.getAllByRole("link", { name: "แลกส่งฟรี 1 คำสั่งซื้อ ด้วย 60 แต้ม" });
    expect(links[0]!.getAttribute("href")).toBe("/account/points/redeem#free_shipping");
  });
});
