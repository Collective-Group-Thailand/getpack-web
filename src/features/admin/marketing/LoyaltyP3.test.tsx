import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import marketing from "@/i18n/messages/th/admin/marketing.json";
import companies from "@/i18n/messages/th/admin/companies.json";
import finance from "@/i18n/messages/th/admin/finance.json";
import console_ from "@/i18n/messages/th/admin/console.json";
import { ApiError } from "@/lib/api/problem";
import type { RewardCatalogItem } from "@/features/shared/loyalty-p3/types";
import type { Schemas } from "@/lib/api/types";

import { CreditUpliftPanel } from "../companies/CreditUplift";
import { CreditUpliftList } from "../finance/CreditUpliftList";
import { benefitV2Body, withSchemaVersion } from "./benefit-v2";
import { CapacityDealList, canRequestPublish } from "./CapacityDeals";
import { blankCampaignDraft, campaignInputOf, campaignProblems } from "./loyalty-campaign";
import { LoyaltyCampaignForm } from "./LoyaltyCampaigns";
import { blankRewardDraft, rewardActionsOf, rewardDraftProblems, rewardInputOf } from "./reward-item";
import { RewardItemForm } from "./RewardItemForm";

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const patch = vi.fn();
vi.mock("../console", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../console")>()),
  adminBrowserApis: () => ({ requests: {}, contract: { GET: get, POST: post, PUT: put, PATCH: patch } }),
  useCan: () => true,
  useProductTypes: () => ({ options: [], types: [], labelOf: (code: string) => code }),
}));
vi.mock("@/ui/components/Toast", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

function renderTh(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider
      locale="th"
      messages={{ marketing, companies, finance, console: console_ }}
      timeZone="Asia/Bangkok"
    >
      {node}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  for (const mock of [get, post, put, patch]) mock.mockReset();
});

const page = <T,>(data: T[]) => ({ data: { data, meta: { page: 1, perPage: 100, total: data.length } } });

const ITEM: RewardCatalogItem = {
  id: "0192f3a0-7c1e-7d2a-9b1f-0000000e0004",
  code: "free_shipping",
  kind: "free_shipping",
  name: { th: "ส่งฟรี 1 คำสั่งซื้อ", en: "Free shipping on one order" },
  description: { th: null, en: null },
  costPoints: 60,
  value: { type: "free_shipping" },
  valueTextTh: "ส่งฟรี",
  constraints: { minOrderValue: "2000.00", productTypeCodes: null, perUserEveryMonths: null },
  tierRequired: null,
  validityDays: 90,
  activeFrom: "2026-11-01T00:00:00+07:00",
  activeTo: null,
  sortOrder: 40,
  status: "active",
  promotionId: "0192f3a0-7c1e-7d2a-9b1f-0000000f0204",
  redemptions30d: 58,
  updatedAt: "2026-10-25T10:00:00+07:00",
};

describe("reward item model", () => {
  it("refuses an empty draft field by field, and a cash-off without a minimum", () => {
    const problems = rewardDraftProblems(blankRewardDraft());
    expect(problems).toEqual(
      expect.arrayContaining(["code", "nameTh", "nameEn", "costPoints", "amount", "minOrderValue"]),
    );
  });

  it("builds the benefit v2 of the kind and leaves empty constraints null", () => {
    const input = rewardInputOf({
      ...blankRewardDraft(),
      code: "print_upgrade",
      kind: "free_addon",
      nameTh: "อัปเกรดเคลือบ Spot UV",
      nameEn: "Spot UV upgrade",
      costPoints: "100",
      addonCode: "spot_uv",
      maxAmount: "1500",
      productTypeCodes: ["folding_carton"],
    });
    expect(input.value).toEqual({ type: "free_addon", addonCode: "spot_uv", maxAmount: "1500.00" });
    expect(input.constraints).toEqual({
      minOrderValue: null,
      productTypeCodes: ["folding_carton"],
      perUserEveryMonths: null,
    });
    expect(input.tierRequired).toBeNull();
  });

  it("offers the lifecycle the status allows", () => {
    expect(rewardActionsOf("draft")).toEqual(["activate", "archive"]);
    expect(rewardActionsOf("active")).toEqual(["pause", "archive"]);
    expect(rewardActionsOf("archived")).toEqual([]);
  });
});

describe("RewardItemForm", () => {
  it("names the fields to fix before asking the API", async () => {
    renderTh(<RewardItemForm item={null} editable productTypes={[]} onSaved={vi.fn()} />);
    await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "สร้างรางวัล" })[0]!));
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByText("กรุณาใส่ชื่อภาษาไทย")).toBeTruthy();
  });

  it("locks code and kind once active and puts the API's cap_floor on the minimum", async () => {
    patch.mockRejectedValueOnce(
      new ApiError({
        status: 422,
        code: "validation.failed",
        title: "x",
        detail: "x",
        requestId: "r",
        errors: [{ path: "constraints.minOrderValue", code: "cap_floor", message: "x" }],
      } as Schemas["ProblemDetails"]),
    );
    renderTh(<RewardItemForm item={ITEM} etag='W/"x.1"' editable productTypes={[]} onSaved={vi.fn()} />);
    expect((screen.getByRole("textbox", { name: /รหัส/ }) as HTMLInputElement).disabled).toBe(true);
    await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "บันทึก" })[0]!));
    const [path, init] = patch.mock.calls[0]!;
    expect(path).toBe("/v1/admin/loyalty/rewards/{itemId}");
    expect(init.params.path.itemId).toBe(ITEM.id);
    expect(init.body.code).toBeUndefined();
    expect(init.headers["If-Match"]).toBe('W/"x.1"');
    expect(screen.getByText("ยอดขั้นต่ำน้อยกว่า 5 เท่าของส่วนลด")).toBeTruthy();
  });
});

describe("benefit v2 in the promotion editor", () => {
  const draft = { maxAmount: "", daysSaved: "", addonCode: "", rounds: "" };
  it("sends a v2 kind in its shape with benefitSchemaVersion 2, and leaves v1 alone", () => {
    expect(benefitV2Body({ ...draft, type: "free_rush", daysSaved: "2" })).toEqual({ type: "free_rush", daysSaved: 2 });
    expect(benefitV2Body({ ...draft, type: "revision_round", rounds: "1" })).toEqual({
      type: "revision_round",
      rounds: 1,
    });
    expect(withSchemaVersion({ name: "x" }, { ...draft, type: "free_sample", maxAmount: "500" })).toEqual({
      name: "x",
      benefitSchemaVersion: 2,
    });
    expect(withSchemaVersion({ name: "x" }, { ...draft, type: "percent" })).toEqual({ name: "x" });
    // Free shipping is v2 only with a cap.
    expect(benefitV2Body({ ...draft, type: "free_shipping" })).toBeNull();
    expect(benefitV2Body({ ...draft, type: "free_shipping", maxAmount: "300" })).toEqual({
      type: "free_shipping",
      maxAmount: "300.00",
    });
  });
});

describe("loyalty campaigns", () => {
  it("checks the draft and sends an admin_rule with two-decimal multiplier and Platinum in the audience", () => {
    const draft = {
      ...blankCampaignDraft(),
      name: "ปลายปีแต้ม ×2",
      multiplier: "2",
      startsOn: "2026-12-01",
      endsOn: "2026-12-31",
      reason: "year_end_2026",
    };
    expect(campaignProblems({ ...draft, multiplier: "6" })).toEqual(["multiplier"]);
    expect(campaignProblems({ ...draft, endsOn: "2026-11-30" })).toEqual(["endsOn"]);
    const input = campaignInputOf({
      ...draft,
      audience: { ...draft.audience, on: { ...draft.audience.on, tiers: true }, tiers: ["gold", "platinum"] },
    });
    expect(input).toMatchObject({
      kind: "admin_rule",
      multiplier: "2.00",
      startsAt: "2026-12-01T00:00:00+07:00",
      endsAt: "2026-12-31T23:59:59+07:00",
      productTypeCodes: null,
      audience: { tiers: ["gold", "platinum"] },
    });
  });

  it("creates through the form", async () => {
    post.mockResolvedValueOnce({ data: { id: "x" } });
    const onSaved = vi.fn();
    renderTh(<LoyaltyCampaignForm campaign={null} productTypes={[]} onCancel={vi.fn()} onSaved={onSaved} />);
    fireEvent.change(screen.getByRole("textbox", { name: /ชื่อแคมเปญ/ }), { target: { value: "สะสมแต้มกล่อง" } });
    fireEvent.change(screen.getByLabelText(/^เริ่ม/), { target: { value: "2026-12-01" } });
    fireEvent.change(screen.getByLabelText(/^สิ้นสุด/), { target: { value: "2026-12-31" } });
    fireEvent.change(screen.getByRole("textbox", { name: /รหัสเหตุผล/ }), { target: { value: "box_dec_2026" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "สร้างแคมเปญ" })));
    expect(post.mock.calls[0]![0]).toBe("/v1/admin/loyalty/campaigns");
    expect(post.mock.calls[0]![1].body).toMatchObject({ kind: "admin_rule", name: "สะสมแต้มกล่อง" });
    expect(onSaved).toHaveBeenCalled();
  });
});

const CREDIT = {
  limitAmount: "1000000.00",
  pendingRequest: null,
  versions: [],
  uplift: {
    mode: "auto",
    modeReason: null,
    baseLimit: "600000.00",
    companyTier: "platinum",
    companySpend12m: "612400.00",
    target: "1200000.00",
    capped: true,
    aboveCapTarget: "1200000.00",
  },
} as unknown as Schemas["AdminCompanyCreditDto"];

describe("credit uplift", () => {
  it("shows the API's figures and files the full amount through the request form", () => {
    const onRequestFull = vi.fn();
    renderTh(
      <CreditUpliftPanel companyId="c1" credit={CREDIT} canManage onRequestFull={onRequestFull} onChanged={vi.fn()} />,
    );
    expect(screen.getByText("Platinum")).toBeTruthy();
    expect(screen.getByText("เกินเพดานอัตโนมัติ")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ขออนุมัติวงเงินเต็ม" }));
    expect(onRequestFull).toHaveBeenCalledWith("1200000.00");
  });

  it("asks a reason before switching the mode", async () => {
    put.mockResolvedValueOnce({ data: { ...CREDIT, uplift: { ...CREDIT.uplift, mode: "frozen" } } });
    const onChanged = vi.fn();
    renderTh(
      <CreditUpliftPanel companyId="c1" credit={CREDIT} canManage onRequestFull={vi.fn()} onChanged={onChanged} />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "หยุดไว้" }));
    const dialog = screen.getByRole("dialog");
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "หยุดไว้" })));
    expect(put).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByRole("textbox"), {
      target: { value: "รอตรวจงบการเงินปี 2569 ก่อนปรับวงเงิน" },
    });
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "หยุดไว้" })));
    expect(put).toHaveBeenCalledWith("/v1/admin/companies/{companyId}/credit/uplift", {
      params: { path: { companyId: "c1" } },
      body: { mode: "frozen", reason: "รอตรวจงบการเงินปี 2569 ก่อนปรับวงเงิน" },
    });
    expect(onChanged).toHaveBeenCalled();
  });
});

/** A fresh client per test: the lists read through react-query. */
function withQuery(node: React.ReactNode) {
  return <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>;
}

describe("lists", () => {
  it("lists uplifts with the capped target and the deep link to request it", async () => {
    get.mockResolvedValueOnce(
      page([
        {
          versionId: "v1",
          company: { id: "c1", legalName: "บริษัท ตัวอย่าง จำกัด" },
          companyTier: "platinum",
          companySpend12m: "612400.00",
          baseLimit: "600000.00",
          factor: "2.00",
          target: "1200000.00",
          newLimit: "1000000.00",
          previousLimit: "900000.00",
          capped: true,
          aboveCapTarget: "1200000.00",
          effectiveFrom: "2026-11-04T03:10:00+07:00",
          mode: "auto",
          origin: "tier_uplift",
          pendingRequest: null,
        },
      ]),
    );
    renderTh(withQuery(<CreditUpliftList />));
    const link = await screen.findByRole("link", { name: "ขออนุมัติวงเงินเต็ม" });
    expect(link.getAttribute("href")).toBe("/companies/c1?tab=credit&uplift=request");
  });

  it("lists capacity deals per product type with the approval, and no factory word", async () => {
    get.mockResolvedValueOnce(
      page([
        {
          promotionId: "p1",
          productTypeCode: "corrugated_rsc",
          productTypeName: "กล่องลูกฟูก",
          weekStart: "2026-11-09",
          freePct: "41.50",
          discountPct: "5",
          visibility: "hidden",
          status: "draft",
          approval: { id: "a1", status: "pending" },
          createdAt: "2026-11-04T07:20:00+07:00",
        },
      ]),
    );
    const { container } = renderTh(withQuery(<CapacityDealList />));
    expect((await screen.findByRole("link", { name: "เปิดคำขอ" })).getAttribute("href")).toBe("/approvals/a1");
    expect(container.textContent).not.toMatch(/โรงงาน|factory/i);
  });

  it("offers request_publish on a draft with no request waiting or approved (D-502)", () => {
    expect(canRequestPublish("draft", null)).toBe(true);
    expect(canRequestPublish("draft", { id: "a1", status: "rejected" })).toBe(true);
    expect(canRequestPublish("draft", { id: "a1", status: "pending" })).toBe(false);
    expect(canRequestPublish("active", { id: "a1", status: "approved" })).toBe(false);
  });
});
