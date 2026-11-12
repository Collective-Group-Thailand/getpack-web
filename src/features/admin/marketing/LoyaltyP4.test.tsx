import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import approvals from "@/i18n/messages/th/admin/approvals.json";
import common from "@/i18n/messages/th/common/common.json";
import problems from "@/i18n/messages/th/common/problems.json";
import console_ from "@/i18n/messages/th/admin/console.json";
import marketing from "@/i18n/messages/th/admin/marketing.json";
import type { CapacityDealFunding, LoyaltyRollout, ProgrammeBudget } from "@/features/shared/loyalty-p4/types";
import { ApiError } from "@/lib/api/problem";

import { CofundingPanel, FundingSplitBlock } from "./Cofunding";
import { FundingSplitTable } from "./FundingSplit";
import { GateCard, growsCohort, LoyaltyRolloutScreen, RolloutStageCard } from "./LoyaltyRollout";
import { BudgetBannerView, BudgetUse, budgetMonths } from "./ProgrammeBudget";
import { changedFlags, SurfaceSwitches } from "./SurfaceSwitches";

const get = vi.fn();
const post = vi.fn();
vi.mock("../console", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../console")>()),
  adminBrowserApis: () => ({ requests: {}, contract: { GET: get, POST: post } }),
  useCan: () => true,
  useActor: () => ({ id: "u-1", roles: ["marketing"], permissions: [] }),
}));
vi.mock("@/ui/components/Toast", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

function renderTh(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider
        locale="th"
        messages={{ marketing, console: console_, approvals, common, problems }}
        timeZone="Asia/Bangkok"
      >
        {node}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

const page = <T,>(data: T[]) => ({ data, meta: { page: 1, perPage: 100, total: data.length } });
const PROMOTION = "0192f3a0-7c1e-7d2a-9b1f-0000000f3001";
const OFFER = {
  id: "0192f3a0-7c1e-7d2a-9b1f-0000000f7001",
  promotionId: PROMOTION,
  factory: { id: "0192f3a0-7c1e-7d2a-9b1f-000000000f01", name: "โรงงาน ตัวอย่าง" },
  mode: "pct_of_discount" as const,
  sharePct: "40.00",
  fixedAmount: null,
  capAmount: "20000.00",
  validFrom: "2026-11-09T00:00:00+07:00",
  validTo: "2026-11-15T23:59:59+07:00",
  respondBy: "2026-11-07T23:59:59+07:00",
  status: "proposed" as const,
  accruedAmount: "0.00",
  capRemaining: "20000.00",
  capReached: false,
  ordersCount: 0,
  note: null,
  proposedAt: "2026-11-04T08:00:00+07:00",
  answeredAt: null,
  declineReason: null,
  withdrawReason: null,
  termsText: "40 % ของส่วนลดดีล สูงสุด ฿20,000",
  proposedBy: { id: "0192f3a0-7c1e-7d2a-9b1f-000000000u01", displayName: "มาลี ส." },
  answeredBy: null,
  withdrawnAt: null,
  rowVersion: 1,
};

describe("co-funding on a capacity deal (D-506)", () => {
  it("says getpack funds 100 % until a factory accepts, lists the offer with the API's terms, and proposes one", async () => {
    get.mockImplementation(async (path: string) => {
      if (path.includes("cofunding-offers")) return { data: page([OFFER]) };
      if (path.includes("cofunding-contributions")) return { data: page([]) };
      if (path.includes("cofunding-candidates"))
        return {
          data: page([{ factoryId: "0192f3a0-7c1e-7d2a-9b1f-000000000f02", name: "โรงงาน B", hasLiveOffer: false }]),
        };
      throw new Error(path);
    });
    renderTh(<CofundingPanel promotionId={PROMOTION} window={{ from: "2026-11-09", to: "2026-11-15" }} />);
    expect(await screen.findByText("40 % ของส่วนลดดีล สูงสุด ฿20,000")).toBeInTheDocument();
    expect(screen.getByText(/getpack สนับสนุน 100%/)).toBeInTheDocument();
    expect(screen.getAllByText("รอตอบรับ").length).toBeGreaterThan(0);

    fireEvent.click(await screen.findByRole("button", { name: "เสนอส่วนร่วม" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/สัดส่วนของส่วนลด/), { target: { value: "30" } });
    fireEvent.change(within(dialog).getByLabelText(/วงเงินรวมสูงสุด/), { target: { value: "5000" } });
    post.mockResolvedValueOnce({ data: OFFER });
    fireEvent.click(within(dialog).getByRole("button", { name: "ส่งข้อเสนอ" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/v1/admin/promotions/{promotionId}/cofunding-offers",
        expect.objectContaining({
          params: { path: { promotionId: PROMOTION }, header: { "Idempotency-Key": expect.any(String) } },
          body: expect.objectContaining({
            factoryId: "0192f3a0-7c1e-7d2a-9b1f-000000000f02",
            mode: "pct_of_discount",
            sharePct: "30.00",
            fixedAmount: null,
            capAmount: "5000.00",
            validFrom: "2026-11-09T00:00:00+07:00",
          }),
        }),
      ),
    );
  });

  it("shows the flag state instead of the panel while capacity deals are off", async () => {
    get.mockImplementation(async (path: string) => {
      if (path.includes("cofunding-candidates"))
        throw new ApiError({
          status: 404,
          code: "loyalty.feature_disabled",
          title: "x",
          type: "x",
          detail: "",
          requestId: "r",
        });
      return { data: page([]) };
    });
    renderTh(<CofundingPanel promotionId={PROMOTION} window={{ from: "2026-11-09", to: null }} />);
    expect(await screen.findByText(/ดีลจากคิวผลิตว่างปิดอยู่/)).toBeInTheDocument();
  });

  it("shows the approval's funding split and that a later acceptance counts too", () => {
    const funding: CapacityDealFunding = {
      defaultFunder: "getpack",
      offers: [
        {
          offerId: OFFER.id,
          factoryName: "โรงงาน ตัวอย่าง",
          status: "accepted",
          termsText: OFFER.termsText,
          capAmount: "20000.00",
          accruedAmount: "4320.00",
        },
      ],
      acceptedCount: 1,
      factoryShareSoFar: "4320.00",
    };
    renderTh(<FundingSplitBlock funding={funding} />);
    expect(screen.getByText(/โรงงานร่วมสนับสนุน 1 แห่ง/)).toBeInTheDocument();
    expect(screen.getByText(/ข้อเสนอที่ตอบรับหลังส่งขออนุมัติจะนับเพิ่ม/)).toBeInTheDocument();
  });
});

const BUDGET: ProgrammeBudget = {
  month: "2026-11",
  budget: { monthlyBaht: "200000.00", override: "250000.00", effective: "250000.00", settingVersionId: OFFER.id },
  spent: {
    points: "121400.00",
    discounts: "78250.00",
    tierPerks: "16900.00",
    factoryShare: "6550.00",
    total: "210000.00",
  },
  usedPct: "84.00",
  state: "warning",
  alertPcts: [80, 100],
  alerts: [{ thresholdPct: 80, firedAt: "2026-11-21T10:15:00+07:00", budget: "250000.00", spent: "200410.00" }],
  pendingOverride: null,
  asOf: "2026-11-22T09:15:00+07:00",
  currency: "THB",
};

describe("programme budget (D-507)", () => {
  it("shows the spend against the budget, the factory share as a minus line and the first alert", () => {
    renderTh(<BudgetUse data={BUDGET} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "84");
    expect(screen.getByText("หักส่วนร่วมจากโรงงาน")).toBeInTheDocument();
    expect(screen.getByText(/ถึงจุดแจ้งเตือนแล้ว/)).toBeInTheDocument();
  });

  it("words the banner at 84 % and at 100 % without an amber fill on the exhausted one", () => {
    const { unmount } = renderTh(<BudgetBannerView data={BUDGET} />);
    expect(screen.getByRole("status")).toHaveTextContent(/ใช้ไป 84/);
    unmount();
    renderTh(<BudgetBannerView data={{ ...BUDGET, usedPct: "100.00", state: "exhausted" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("งบเดือนนี้ครบแล้ว");
    expect(screen.getByRole("status").innerHTML).not.toMatch(/accent/);
  });

  it("offers the last twelve Bangkok months, newest first", () => {
    const months = budgetMonths(new Date("2026-11-30T20:00:00Z"));
    expect(months[0]).toBe("2026-12");
    expect(months).toHaveLength(12);
  });
});

const ROLLOUT: LoyaltyRollout = {
  current: {
    stage: "percent",
    percent: 10,
    allowlistCompanyIds: [],
    allowlistUserIds: [],
    settingVersionId: OFFER.id,
    effectiveFrom: "2026-11-20T09:00:00+07:00",
  },
  cohort: { companies: 41, companiesTotal: 402, usersWithoutCompany: 318, usersWithoutCompanyTotal: 3120 },
  gates: [
    { metric: "redemption_rate", value: "18.40", target: "15.00", direction: "min", status: "pass", window: "3m" },
    {
      metric: "margin_after_promotions",
      value: "17.10",
      target: "18.00",
      direction: "min",
      status: "attention",
      window: "3m",
    },
    {
      metric: "points_liability",
      value: null,
      target: "500000.00",
      direction: "max",
      status: "unknown",
      window: "now",
    },
  ],
  pendingAdvance: null,
  history: [],
};

describe("rollout (D-510)", () => {
  it("knows a grow from a shrink as the API does", () => {
    const now = { stage: "percent" as const, percent: 10, allowlistCompanyIds: [], allowlistUserIds: [] };
    expect(growsCohort(now, { ...now, percent: 25 })).toBe(true);
    expect(growsCohort(now, { ...now, stage: "all", percent: 0 })).toBe(true);
    expect(growsCohort(now, { ...now, allowlistUserIds: ["x"] })).toBe(true);
    expect(growsCohort(now, { ...now, stage: "uat", percent: 0 })).toBe(false);
    expect(growsCohort(now, { ...now, percent: 5 })).toBe(false);
  });

  it("marks the current step and states gates as pass / check / no data, never as a block", () => {
    renderTh(<RolloutStageCard data={ROLLOUT} />);
    expect(screen.getByText("บางส่วน 10%", { selector: "p" }).closest("li")).toHaveAttribute("aria-current", "step");
    for (const gate of ROLLOUT.gates) renderTh(<GateCard gate={gate} />);
    expect(screen.getByText("ผ่าน")).toBeInTheDocument();
    expect(screen.getByText("ต้องดู")).toBeInTheDocument();
    expect(screen.getByText("ยังไม่มีข้อมูล")).toBeInTheDocument();
  });

  it("asks for an advance with a reason and rolls back at once", async () => {
    get.mockResolvedValue({ data: ROLLOUT });
    post.mockResolvedValue({ data: { approvalId: OFFER.id, status: "pending" } });
    renderTh(<LoyaltyRolloutScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "ขอเลื่อนขั้น" }));
    let dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/สัดส่วนลูกค้า/), { target: { value: "25" } });
    fireEvent.change(within(dialog).getByLabelText(/เหตุผล/), { target: { value: "ผ่านเกณฑ์สองสัปดาห์แล้ว" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "ส่งขออนุมัติ" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/v1/admin/loyalty/rollout/actions/advance",
        expect.objectContaining({ body: expect.objectContaining({ stage: "percent", percent: 25 }) }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "ถอยกลับ" }));
    dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: /UAT/ }));
    fireEvent.change(within(dialog).getByLabelText(/เหตุผล/), { target: { value: "พบปัญหาคำนวณแต้มโบนัส" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "ถอยกลับ" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/v1/admin/loyalty/rollout/actions/rollback",
        expect.objectContaining({ body: expect.objectContaining({ stage: "uat", percent: 0 }) }),
      ),
    );
  });
});

describe("surfaces and the funding split", () => {
  it("saves only when a switch changed, as a new loyalty.surfaces version in force now", async () => {
    const value = {
      deals: true,
      dealsLiff: true,
      redeem: true,
      tierPerks: true,
      capacityDeals: true,
      checklist: true,
      pointsLiff: true,
      quoteRecovery: true,
    };
    expect(changedFlags(value, { ...value, redeem: false })).toEqual(["redeem"]);
    renderTh(
      <SurfaceSwitches
        setting={
          {
            id: "s-1",
            key: "loyalty.surfaces",
            ownerRole: "marketing",
            current: { versionNo: 1, effectiveFrom: "2026-11-05T00:00:00+07:00", value },
          } as never
        }
      />,
    );
    expect(screen.queryByRole("button", { name: /บันทึก/ })).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "แลกแต้ม" }));
    fireEvent.change(screen.getByLabelText(/เหตุผล/), { target: { value: "ปิดชั่วคราวช่วงตรวจระบบ" } });
    post.mockResolvedValueOnce({ data: {} });
    fireEvent.click(screen.getByRole("button", { name: /บันทึก/ }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/v1/admin/settings/{settingId}/versions",
        expect.objectContaining({ body: expect.objectContaining({ value: { ...value, redeem: false } }) }),
      ),
    );
  });

  it("lists who funded each capacity deal with the totals", () => {
    renderTh(
      <FundingSplitTable
        data={{
          data: [
            {
              promotionId: PROMOTION,
              name: "สั่งกล่องลูกฟูกสัปดาห์นี้ ลด 5%",
              productTypeName: "กล่องลูกฟูก",
              weekStart: "2026-11-09",
              orders: 31,
              discountTotal: "38750.00",
              factoryShare: "4320.00",
              getpackShare: "34430.00",
              reversed: "960.00",
              factoryCount: 1,
              offersAccepted: 1,
            },
          ],
          meta: {
            page: 1,
            perPage: 50,
            total: 1,
            totals: { discountTotal: "38750.00", factoryShare: "4320.00", getpackShare: "34430.00" },
          },
          asOf: "2026-11-22T09:15:00+07:00",
          currency: "THB",
        }}
      />,
    );
    expect(screen.getAllByText("กล่องลูกฟูก").length).toBeGreaterThan(0);
    expect(screen.getByText(/โรงงาน ฿4,320/)).toBeInTheDocument();
  });
});
