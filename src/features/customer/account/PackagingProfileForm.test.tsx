import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import account from "@/i18n/messages/th/customer/account.json";
import type { PackagingProfile } from "@/lib/api/requests/store-loyalty";

import { draftFrom, validateDraft } from "./packaging-profile";
import { PackagingProfileForm } from "./PackagingProfileForm";

const call = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/requests/browser", () => ({ browserRequests: () => ({ call }) }));
vi.mock("@/ui/components/Toast", () => ({ toast }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ refresh: vi.fn() }),
}));

const EMPTY: PackagingProfile = {
  monthlyBoxVolume: null,
  productCategories: null,
  shipToRegions: null,
  peakMonths: null,
  purposeAccepted: null,
  completedAt: null,
  updatedAt: null,
};

function renderForm(profile: PackagingProfile = EMPTY, rewardPoints: number | null = 40) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="th" messages={{ account }} timeZone="Asia/Bangkok">
        <PackagingProfileForm profile={profile} rewardPoints={rewardPoints} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  call.mockReset();
  toast.mockReset();
});

describe("validateDraft", () => {
  it("asks for a volume, a product type, a region and the acknowledgement; months are optional", () => {
    expect(validateDraft(draftFrom(null))).toEqual({
      monthlyBoxVolume: "volumeRequired",
      productCategories: "categoriesRequired",
      shipToRegions: "regionsRequired",
      purposeAccepted: "purposeRequired",
    });
    expect(
      validateDraft({
        monthlyBoxVolume: "lt_500",
        productCategories: ["food"],
        shipToRegions: ["north"],
        peakMonths: [],
        purposeAccepted: true,
      }),
    ).toEqual({});
  });
});

describe("PackagingProfileForm", () => {
  it("shows each error by its group and sends nothing", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "บันทึกข้อมูล" }));
    for (const message of [
      "เลือกปริมาณที่ใช้ต่อเดือน",
      "เลือกอย่างน้อย 1 ประเภท",
      "เลือกอย่างน้อย 1 ภูมิภาค",
      "กรุณาติ๊กรับทราบก่อนบันทึก",
    ]) {
      expect(screen.getByText(message)).toBeInTheDocument();
    }
    expect(call).not.toHaveBeenCalled();
  });

  it("saves a complete profile and announces the points on the first completion", async () => {
    const now = "2026-11-04T08:00:00.000Z";
    call.mockResolvedValue({
      monthlyBoxVolume: "500_2000",
      productCategories: ["food"],
      shipToRegions: ["north"],
      peakMonths: [11, 12],
      purposeAccepted: true,
      completedAt: now,
      updatedAt: now,
    });
    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: "500–2,000 ใบ" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "อาหาร" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "ภาคเหนือ" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "ธ.ค." }));
    fireEvent.click(screen.getByRole("checkbox", { name: "พ.ย." }));
    fireEvent.click(screen.getByRole("checkbox", { name: /รับทราบวัตถุประสงค์/ }));
    fireEvent.click(screen.getByRole("button", { name: "บันทึกข้อมูล" }));

    await waitFor(() => expect(call).toHaveBeenCalled());
    expect(call).toHaveBeenCalledWith("PUT /v1/store/loyalty/packaging-profile", {
      body: {
        monthlyBoxVolume: "500_2000",
        productCategories: ["food"],
        shipToRegions: ["north"],
        peakMonths: [11, 12],
        purposeAccepted: true,
      },
    });
    await waitFor(() => expect(toast).toHaveBeenCalledWith("+40 แต้ม — กรอกข้อมูลการใช้บรรจุภัณฑ์"));
  });

  it("says only 'saved' when the profile was already complete", async () => {
    const done: PackagingProfile = {
      monthlyBoxVolume: "lt_500",
      productCategories: ["food"],
      shipToRegions: ["south"],
      peakMonths: [],
      purposeAccepted: true,
      completedAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-01T00:00:00.000Z",
    };
    call.mockResolvedValue({ ...done, updatedAt: "2026-11-04T00:00:00.000Z" });
    renderForm(done, null);
    fireEvent.click(screen.getByRole("button", { name: "บันทึกข้อมูล" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith("บันทึกข้อมูลแล้ว"));
  });
});
