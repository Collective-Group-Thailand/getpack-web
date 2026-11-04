import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import account from "@/i18n/messages/th/customer/account.json";
import type { DataRefresh, ShowcaseConsent } from "@/features/shared/loyalty-p2/types";

import { DataRefreshView } from "./DataRefreshView";
import { SHOWCASE_TEXT_VERSION, ShowcaseConsentForm } from "./ShowcaseConsentForm";

const post = vi.fn();
const put = vi.fn();
vi.mock("@/lib/api/browser", () => ({ browserApi: () => ({ POST: post, PUT: put }) }));
vi.mock("@/ui/components/Toast", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ refresh: vi.fn() }),
}));

function renderTh(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="th" messages={{ account }} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

const due: DataRefresh = {
  due: true,
  lastConfirmedAt: null,
  nextDueAt: null,
  rewardPoints: 12,
  company: { id: "0192f3a0-7c1e-7d2a-9b1f-0000000c0001", legalName: "บริษัท ตัวอย่าง จำกัด" },
  taxProfiles: [{ id: "0192f3a0-7c1e-7d2a-9b1f-0000000c0101", label: "สำนักงานใหญ่" }],
  addresses: [{ id: "0192f3a0-7c1e-7d2a-9b1f-0000000c0201", label: "คลังสินค้า บางนา", isDefault: true }],
};

beforeEach(() => {
  post.mockReset();
  put.mockReset();
});

describe("DataRefreshView", () => {
  it("summarises the data with edit links and the API's reward", () => {
    renderTh(<DataRefreshView initial={due} />);
    expect(screen.getByText("บริษัท ตัวอย่าง จำกัด")).toBeInTheDocument();
    expect(screen.getByText("ค่าเริ่มต้น")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "แก้ไข" }).map((link) => link.getAttribute("href"))).toEqual([
      "/business",
      "/account/addresses#book-tax",
      "/account/addresses#book-addresses",
    ]);
    expect(screen.getByText(/ยืนยันแล้วรับ/)).toHaveTextContent("ยืนยันแล้วรับ 12 แต้ม");
  });

  it("confirms and then shows when the next confirmation is due", async () => {
    post.mockResolvedValue({
      data: {
        ...due,
        due: false,
        rewardPoints: 0,
        lastConfirmedAt: "2026-11-04T10:00:00+07:00",
        nextDueAt: "2027-11-04T10:00:00+07:00",
      },
    });
    renderTh(<DataRefreshView initial={due} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ยืนยันว่าข้อมูลถูกต้อง" })));
    expect(post).toHaveBeenCalledWith("/v1/store/loyalty/data-refresh/actions/confirm", {
      body: { confirmed: true },
    });
    expect(screen.getByText(/ยืนยันล่าสุด/)).toHaveTextContent("ครั้งถัดไป");
    expect(screen.queryByText(/ยืนยันแล้วรับ/)).not.toBeInTheDocument();
  });
});

const none: ShowcaseConsent = {
  status: "none",
  scope: [],
  consentTextVersion: SHOWCASE_TEXT_VERSION,
  requestedAt: null,
  decidedAt: null,
  rewardPoints: 40,
};

describe("ShowcaseConsentForm", () => {
  it("asks for a scope and the consent before sending", async () => {
    renderTh(<ShowcaseConsentForm initial={none} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ส่งคำขอ" })));
    expect(screen.getByRole("alert")).toHaveTextContent("เลือกอย่างน้อยหนึ่งอย่าง");
    fireEvent.click(screen.getByRole("checkbox", { name: "ชื่อแบรนด์" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ส่งคำขอ" })));
    expect(screen.getByRole("alert")).toHaveTextContent("กรุณาอ่านและยินยอม");
    expect(put).not.toHaveBeenCalled();
  });

  it("sends the scope with the consent text version and shows the review status", async () => {
    put.mockResolvedValue({
      data: { ...none, status: "requested", scope: ["brand_name"], requestedAt: "2026-11-04T15:00:00+07:00" },
    });
    renderTh(<ShowcaseConsentForm initial={none} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "ชื่อแบรนด์" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "ฉันอ่านและยินยอมตามข้อความข้างต้น" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ส่งคำขอ" })));
    expect(put).toHaveBeenCalledWith("/v1/store/loyalty/showcase-consent", {
      body: { granted: true, scope: ["brand_name"], consentTextVersion: SHOWCASE_TEXT_VERSION },
    });
    expect(screen.getByText("รอตรวจสอบ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ถอนความยินยอม" })).toBeInTheDocument();
    // A request under review cannot be changed, only withdrawn.
    expect(screen.queryByRole("button", { name: "เปลี่ยนสิ่งที่อนุญาต" })).not.toBeInTheDocument();
  });

  it("changes an approved consent as a new request, without promising the reward again", async () => {
    const approved: ShowcaseConsent = {
      ...none,
      status: "approved",
      scope: ["brand_name"],
      requestedAt: "2026-10-01T10:00:00+07:00",
      decidedAt: "2026-10-02T10:00:00+07:00",
    };
    put.mockResolvedValue({
      data: { ...approved, status: "requested", scope: ["brand_name", "logo"], decidedAt: null },
    });
    renderTh(<ShowcaseConsentForm initial={approved} />);
    expect(screen.queryByRole("button", { name: "ส่งคำขอ" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "เปลี่ยนสิ่งที่อนุญาต" }));
    expect(screen.getByText(/ยกเลิกความยินยอมที่อนุมัติไว้/)).toBeInTheDocument();
    expect(screen.queryByText(/เมื่อทีมงานอนุมัติ/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "โลโก้" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "ฉันอ่านและยินยอมตามข้อความข้างต้น" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ส่งคำขอ" })));
    expect(put).toHaveBeenCalledWith("/v1/store/loyalty/showcase-consent", {
      body: { granted: true, scope: ["brand_name", "logo"], consentTextVersion: SHOWCASE_TEXT_VERSION },
    });
    expect(screen.getByText("รอตรวจสอบ")).toBeInTheDocument();
  });
});
