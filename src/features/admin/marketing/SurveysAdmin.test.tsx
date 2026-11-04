import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import marketing from "@/i18n/messages/th/admin/marketing.json";
import common from "@/i18n/messages/th/common/common.json";

import { SurveysAdmin } from "./SurveysAdmin";

const results = {
  templateId: "0192f3a0-7c1e-7d2a-9b1f-0000000e0001",
  completed: 96,
  opened: 210,
  completionPct: "45.71",
  countsOnly: false,
  questions: [
    { key: "overall", kind: "rating", label: "ความพึงพอใจโดยรวม", answered: 96, average: "4.31" },
    {
      key: "comment",
      kind: "text",
      label: "อยากบอกอะไรเพิ่มเติม",
      answered: 31,
      texts: [{ customer: "คุณส•••", orderCode: "OR-2610-0042", text: "กล่องแข็งแรง" }],
    },
  ],
};
const template = (id: string, status: string, trigger: string) => ({
  id,
  code: `${trigger}_v1`,
  version: 1,
  trigger,
  status,
  rewardEnabled: true,
  title: { th: `ชุด ${trigger}`, en: trigger },
  questions: [{}, {}, {}],
  responseRatePct: status === "published" ? "45.71" : null,
  responses: status === "published" ? 96 : 0,
  updatedAt: "2026-11-01T10:00:00+07:00",
});
const call = vi.fn();
vi.mock("../console", () => ({
  adminBrowserApis: () => ({ requests: { call } }),
  problemMessage: (_error: unknown, fallback: string) => fallback,
  QueryError: () => <p>error</p>,
  useCan: () => true,
}));
vi.mock("@/ui/components/Toast", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

beforeEach(() => {
  call.mockReset().mockImplementation(async (key: string) => {
    if (key === "GET /v1/admin/surveys/templates")
      return {
        items: [
          template("0192f3a0-7c1e-7d2a-9b1f-0000000e0001", "published", "post_delivery"),
          template("0192f3a0-7c1e-7d2a-9b1f-0000000e0002", "draft", "quarterly"),
        ],
      };
    if (key.endsWith("/results")) return results;
    return {};
  });
});

function renderTh() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="th" messages={{ marketing, common } as never} timeZone="Asia/Bangkok">
        <SurveysAdmin />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("SurveysAdmin", () => {
  it("lists the templates and shows the published one's results with masked free text", async () => {
    renderTh();
    expect(await screen.findByText("4.31")).toBeInTheDocument();
    expect(screen.getByText("คุณส••• · OR-2610-0042")).toBeInTheDocument();
    expect(screen.getAllByText("เผยแพร่แล้ว").length).toBeGreaterThan(0);
  });

  it("publishes a draft through the template action", async () => {
    renderTh();
    // Only the draft offers "เผยแพร่" (the table and its phone cards both render it).
    const [publish] = await screen.findAllByRole("button", { name: "เผยแพร่" });
    await act(async () => fireEvent.click(publish!));
    expect(call).toHaveBeenCalledWith("POST /v1/admin/surveys/templates/{templateId}/actions/{action}", {
      path: { templateId: "0192f3a0-7c1e-7d2a-9b1f-0000000e0002", action: "publish" },
    });
  });
});
