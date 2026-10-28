import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import common from "@/i18n/messages/th/common/common.json";
import prepress from "@/i18n/messages/th/admin/prepress.json";
import { ApiError } from "@/lib/api/problem";

import { FileItem } from "./FileItem";

const api = { GET: vi.fn(), POST: vi.fn() };
let permissions: string[] = [];

vi.mock("../console", async () => {
  const actions = await import("@/features/shared/actions/ConfirmAction");
  return {
    adminBrowserApis: () => ({ contract: api }),
    ConfirmAction: actions.ConfirmAction,
    problemMessage: (_error: unknown, fallback: string) => fallback,
    useCan: (...keys: string[]) => keys.every((key) => permissions.includes(key)),
  };
});

const notFound = new ApiError({
  type: "about:blank",
  title: "ไม่พบ",
  status: 404,
  code: "http.not_found",
  detail: "ไม่พบ",
  requestId: "req-fake",
} as never);

function renderItem() {
  return render(
    <NextIntlClientProvider locale="th" messages={{ prepress, common } as never}>
      <FileItem fileId="0192f3a0-0000-7000-8000-000000000001" name="fake-artwork.pdf" />
    </NextIntlClientProvider>,
  );
}

describe("FileItem — Superadmin opens a customer file with a typed reason (C1d, D-449 (1))", () => {
  beforeEach(() => {
    api.GET.mockReset();
    api.POST.mockReset();
  });

  it("asks a Superadmin for a reason when the ordinary download is refused, then logs it with the request", async () => {
    permissions = ["customer_files.read_with_reason"];
    api.GET.mockRejectedValue(notFound);
    api.POST.mockResolvedValue({
      data: { url: "https://files.example.invalid/x", expiresAt: "2026-10-28T10:05:00+07:00" },
    });
    renderItem();
    fireEvent.click(screen.getByRole("button", { name: /ดาวน์โหลด|fake-artwork/ }));
    expect(await screen.findByText(prepress.detail.reasonDialog.title)).toBeInTheDocument();
    const box = screen.getByRole("textbox");
    fireEvent.change(box, { target: { value: "สั้นไป" } });
    fireEvent.click(screen.getByRole("button", { name: prepress.detail.reasonDialog.confirm }));
    expect(api.POST).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: "ลูกค้าแจ้งไฟล์พิมพ์ผิด ตรวจตามคำร้อง" } });
    fireEvent.click(screen.getByRole("button", { name: prepress.detail.reasonDialog.confirm }));
    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith("/v1/admin/files/{fileId}/actions/download-with-reason", {
        params: { path: { fileId: "0192f3a0-0000-7000-8000-000000000001" } },
        body: { reason: "ลูกค้าแจ้งไฟล์พิมพ์ผิด ตรวจตามคำร้อง" },
      }),
    );
    expect(await screen.findByRole("link")).toHaveAttribute("href", "https://files.example.invalid/x");
  });

  it("never offers the reason path to Admin, Auditor or anyone without the permission", async () => {
    permissions = ["files.read"];
    api.GET.mockRejectedValue(notFound);
    renderItem();
    fireEvent.click(screen.getByRole("button", { name: /ดาวน์โหลด|fake-artwork/ }));
    await waitFor(() => expect(api.GET).toHaveBeenCalled());
    expect(screen.queryByText(prepress.detail.reasonDialog.title)).toBeNull();
    expect(api.POST).not.toHaveBeenCalled();
  });
});
