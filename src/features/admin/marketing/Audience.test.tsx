import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import marketing from "@/i18n/messages/th/admin/marketing.json";
import common from "@/i18n/messages/th/common/common.json";
import type { Schemas } from "@/lib/api/types";

import {
  audienceDraftOf,
  audienceOf,
  bundleChecks,
  bundleDraftOf,
  incompleteCriteria,
  type AudienceDraft,
} from "./audience";
import { PromotionAudience } from "./PromotionAudience";
import { PromotionBundle } from "./PromotionBundle";
import { BLOCKED_WORDS } from "./promotion-display";
import { SegmentPicker } from "./SegmentPicker";

const contract = { GET: vi.fn(), PATCH: vi.fn() };
const requests = { call: vi.fn() };
vi.mock("../console", () => ({
  adminBrowserApis: () => ({ contract, requests }),
  problemMessage: (_error: unknown, fallback: string) => fallback,
  useProductTypes: () => ({
    types: [
      { code: "corrugated", status: "active" },
      { code: "label_sticker", status: "active" },
    ],
    labelOf: (code: string) => ({ corrugated: "กล่องลูกฟูก", label_sticker: "สติกเกอร์" })[code] ?? code,
  }),
}));
vi.mock("@/ui/components/Toast", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

function renderTh(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="th" messages={{ marketing, common } as never} timeZone="Asia/Bangkok">
        {node}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const promotion = {
  id: "0192f3a0-7c1e-7d2a-9b1f-0000000a0001",
  status: "active",
  stackGroup: null,
  conditions: { segments: ["returning"], productTypeCodes: ["corrugated"] },
  display: null,
} as unknown as Schemas["PromotionDto"];

beforeEach(() => {
  contract.GET.mockReset().mockResolvedValue({
    data: promotion,
    response: new Response(null, { headers: { ETag: 'W/"p.1"' } }),
  });
  contract.PATCH.mockReset().mockResolvedValue({ data: promotion });
  requests.call.mockReset().mockResolvedValue({ customers: 120, rounded: true });
});

describe("audience rules", () => {
  it("keeps only the criteria that are on and say something", () => {
    const draft: AudienceDraft = {
      ...audienceDraftOf(null),
      on: { newCustomer: false, tiers: true, businessTypes: true, inactiveDays: false, orderedTypes: true },
      tiers: ["silver", "gold"],
      orderedTypes: ["corrugated"],
    };
    expect(audienceOf(draft)).toEqual({ tiers: ["silver", "gold"], orderedProductTypeCodes: ["corrugated"] });
    expect(incompleteCriteria(draft)).toEqual(["businessTypes"]);
    expect(audienceOf(audienceDraftOf(null))).toBeNull();
  });

  it("refuses audience words in deal text, as the API's publish guard does", () => {
    expect(BLOCKED_WORDS.test("ลูกค้าที่ไม่ได้สั่งนาน รับส่วนลด")).toBe(true);
    expect(BLOCKED_WORDS.test("เฉพาะประเภทธุรกิจอาหาร")).toBe(true);
    expect(BLOCKED_WORDS.test("สมาชิก Silver ขึ้นไป ลด 8%")).toBe(false);
  });

  it("checks a bundle has 2–4 complete items of enough types", () => {
    const rows = bundleDraftOf([
      { productTypeCode: "corrugated", configuration: { lengthMm: 300 }, quantity: 500 },
      { productTypeCode: "label_sticker", configuration: { shape: "circle" }, quantity: 1000 },
    ]);
    expect(bundleChecks(rows, 2)).toEqual({ count: true, types: true, rows: true });
    expect(bundleChecks([rows[0]!, { ...rows[0]! }], 2).types).toBe(false);
    expect(bundleChecks([rows[0]!, { ...rows[1]!, configuration: "[1]" }], 2).rows).toBe(false);
  });
});

describe("SegmentPicker", () => {
  function Harness() {
    const [draft, setDraft] = useState(audienceDraftOf(null));
    return (
      <SegmentPicker draft={draft} onChange={setDraft} productTypes={[{ value: "corrugated", label: "กล่องลูกฟูก" }]} />
    );
  }

  it("reads the rule back as one sentence as criteria are chosen", () => {
    renderTh(<Harness />);
    expect(screen.getByText(/ดีลนี้ใช้ได้กับลูกค้าทุกคน/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /ระดับสมาชิก/ }));
    fireEvent.click(screen.getByRole("button", { name: "Silver" }));
    fireEvent.click(screen.getByRole("button", { name: "Gold" }));
    expect(screen.getByRole("button", { name: "Gold" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("checkbox", { name: /เคยสั่งประเภทสินค้า/ }));
    fireEvent.click(screen.getByRole("button", { name: "กล่องลูกฟูก" }));
    expect(screen.getByText("ระดับ Silver หรือ Gold")).toBeInTheDocument();
    expect(screen.getByText("เคยสั่งกล่องลูกฟูก")).toBeInTheDocument();
  });
});

describe("PromotionAudience", () => {
  it("estimates the audience and saves it as conditions v2 without the legacy segments", async () => {
    renderTh(
      <PromotionAudience
        item={{ ...promotion, conditions: { ...promotion.conditions } } as Schemas["PromotionDto"]}
        editable
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /ลูกค้าใหม่/ }));
    await waitFor(() => expect(screen.getByText("120")).toBeInTheDocument(), { timeout: 2000 });
    expect(requests.call).toHaveBeenCalledWith("GET /v1/admin/promotions/{promotionId}/audience-estimate", {
      path: { promotionId: promotion.id },
      query: { audience: JSON.stringify({ newCustomer: true }) },
    });
    await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "บันทึกกลุ่มลูกค้า" })[0]!));
    const body = contract.PATCH.mock.calls[0]![1].body;
    expect(body.conditions).toEqual({ productTypeCodes: ["corrugated"], audience: { newCustomer: true } });
    expect(body.conditions).not.toHaveProperty("segments");
    expect(body.display).toEqual({ listing: "everyone" });
  });
});

describe("PromotionBundle", () => {
  it("locks the stack group to bundle and saves only when the items are complete", async () => {
    renderTh(<PromotionBundle item={promotion} editable />);
    expect(screen.getByDisplayValue("bundle")).toBeDisabled();
    for (const save of screen.getAllByRole("button", { name: "บันทึกชุดสินค้า" })) expect(save).toBeDisabled();
  });
});
