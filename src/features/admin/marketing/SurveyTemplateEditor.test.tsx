import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import marketing from "@/i18n/messages/th/admin/marketing.json";
import common from "@/i18n/messages/th/common/common.json";
import type { SurveyTemplate } from "@/features/shared/loyalty-p2/types";

import { draftOf, draftProblems, inputOf, isCodeTaken, nextKey, withKind } from "./survey-template";
import { SurveyTemplateEditor } from "./SurveyTemplateEditor";

const GET = vi.fn();
const POST = vi.fn();
const PATCH = vi.fn();
vi.mock("../console", () => ({
  adminBrowserApis: () => ({ contract: { GET, POST, PATCH } }),
  problemMessage: (_error: unknown, fallback: string) => fallback,
}));

const both = (th: string, en: string) => ({ th, en });
const published: SurveyTemplate = {
  id: "0192f3a0-7c1e-7d2a-9b1f-0000000e0002",
  code: "quarterly_v1",
  version: 2,
  trigger: "quarterly",
  status: "draft",
  rewardEnabled: false,
  title: both("ไตรมาสนี้เป็นอย่างไร", "How was this quarter?"),
  questions: [
    { key: "overall", kind: "rating", label: both("พอใจแค่ไหน", "How satisfied?"), required: true, min: 1, max: 5 },
    {
      key: "channel",
      kind: "single",
      label: both("สั่งผ่านช่องทางใด", "Which channel?"),
      required: true,
      options: [
        { key: "web", label: both("เว็บ", "Web") },
        { key: "line", label: both("LINE", "LINE") },
      ],
    },
    { key: "comment", kind: "text", label: both("อื่น ๆ", "Anything else?"), required: false, maxLength: 300 },
  ],
  responseRatePct: null,
  completed: 0,
  opened: 0,
  createdAt: "2026-11-01T10:00:00+07:00",
  publishedAt: null,
  retiredAt: null,
};

function renderTh(template: SurveyTemplate | null, onSaved = vi.fn()) {
  render(
    <NextIntlClientProvider locale="th" messages={{ marketing, common } as never} timeZone="Asia/Bangkok">
      <SurveyTemplateEditor open template={template} onClose={vi.fn()} onSaved={onSaved} />
    </NextIntlClientProvider>,
  );
  return onSaved;
}

beforeEach(() => {
  GET.mockReset();
  POST.mockReset();
  PATCH.mockReset();
});

describe("survey template rules", () => {
  it("starts a new template with a rating, a choice and a text question", () => {
    expect(draftOf().questions.map((question) => [question.key, question.kind])).toEqual([
      ["q1", "rating"],
      ["q2", "single"],
      ["q3", "text"],
    ]);
    expect(nextKey("o", ["o1", "o3"])).toBe("o2");
  });

  it("reads the API's code-taken refusal (422 validation.failed, `code` · `taken`) and nothing else", async () => {
    const { ApiError } = await import("@/lib/api/problem");
    const refusal = (code: string, errors: { path: string; code: string; message: string }[]) =>
      new ApiError({
        type: "about:blank",
        title: "x",
        status: 422,
        code,
        detail: "x",
        requestId: "r",
        errors,
      } as never);
    expect(isCodeTaken(refusal("validation.failed", [{ path: "code", code: "taken", message: "x" }]))).toBe(true);
    expect(isCodeTaken(refusal("validation.failed", [{ path: "title.th", code: "required", message: "x" }]))).toBe(
      false,
    );
    expect(isCodeTaken(new Error("network"))).toBe(false);
  });

  it("names every problem: code, titles, labels, options, count", () => {
    const draft = draftOf();
    expect(draftProblems(draft, true)).toEqual(["code", "title", "q0.label", "q1.label", "q1.optionLabel", "q2.label"]);
    expect(draftProblems({ ...draft, questions: draft.questions.slice(0, 2) }, false)).toContain("count");
    expect(draftProblems(draftOf(published), false)).toEqual([]);
  });

  it("keeps a question's words when its kind changes and sends only what each kind needs", () => {
    const text = withKind(draftOf(published).questions[1]!, "text");
    expect(text.options).toEqual([]);
    expect(text.th).toBe("สั่งผ่านช่องทางใด");
    expect(withKind(text, "multi").options).toHaveLength(2);
    const body = inputOf(draftOf(published));
    expect(body.questions[0]).toEqual({ ...published.questions[0] });
    expect(body.questions[1]!.options).toEqual(published.questions[1]!.options);
    expect(body.questions[2]).toEqual(published.questions[2]);
  });
});

describe("SurveyTemplateEditor", () => {
  it("refuses to save an incomplete new template and says where", async () => {
    renderTh(null);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "สร้างฉบับร่าง" })));
    expect(POST).not.toHaveBeenCalled();
    expect(screen.getByText("ใช้ตัวพิมพ์เล็ก ตัวเลข และ _ เท่านั้น")).toBeInTheDocument();
    expect(screen.getAllByText("ใส่หัวข้อ")).toHaveLength(2);
    expect(screen.getByText("ใส่ตัวเลือกให้ครบทั้งสองภาษา")).toBeInTheDocument();
  });

  it("adds up to five questions and keeps three at least", () => {
    renderTh(null);
    const remove = screen.getByRole("button", { name: "ลบคำถามที่ 1" });
    expect(remove).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มคำถาม" }));
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มคำถาม" }));
    expect(screen.getByRole("button", { name: "ครบ 5 คำถามแล้ว" })).toBeDisabled();
    expect(screen.getByText("5 คำถาม · ต้องมี 3–5")).toBeInTheDocument();
  });

  it("edits a draft under its ETag without resending the code", async () => {
    GET.mockResolvedValue({ data: published, response: new Response(null, { headers: { ETag: 'W/"7"' } }) });
    PATCH.mockResolvedValue({ data: { ...published, title: both("ไตรมาสนี้", "How was this quarter?") } });
    const onSaved = renderTh(published);
    const question = screen.getByRole("listitem", { name: "คำถามที่ 2" });
    fireEvent.change(within(question).getByRole("textbox", { name: "ตัวเลือก 2 (ไทย)" }), {
      target: { value: "ไลน์" },
    });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "บันทึก" })));
    expect(GET).toHaveBeenCalledWith("/v1/admin/surveys/templates/{templateId}", {
      params: { path: { templateId: published.id } },
    });
    const [key, init] = PATCH.mock.calls[0]!;
    expect(key).toBe("/v1/admin/surveys/templates/{templateId}");
    expect(init.params.header["If-Match"]).toBe('W/"7"');
    expect(init.body.code).toBeUndefined();
    expect(init.body.questions[1].options[1].label).toEqual({ th: "ไลน์", en: "LINE" });
    expect(onSaved).toHaveBeenCalled();
  });

  it("says a published template cannot be edited", async () => {
    GET.mockResolvedValue({ data: published, response: new Response(null) });
    const { ApiError } = await import("@/lib/api/problem");
    PATCH.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "x",
        status: 409,
        code: "surveys.template_published",
        detail: "x",
        requestId: "r",
      } as never),
    );
    renderTh(published);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "บันทึก" })));
    expect(screen.getByRole("alert")).toHaveTextContent("ชุดนี้เผยแพร่แล้วจึงแก้ไม่ได้");
  });
});
