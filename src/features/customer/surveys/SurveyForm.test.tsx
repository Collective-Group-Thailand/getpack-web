import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import account from "@/i18n/messages/th/customer/account.json";
import { ApiError } from "@/lib/api/problem";

import { SURVEY_FIXTURE } from "./fixtures";
import { SurveyCard } from "./SurveyCard";
import { SurveyForm } from "./SurveyForm";
import { missingRequired, toSubmission } from "./survey-model";

const call = vi.fn();
/** A plain failing implementation: a rejected promise from a spy is reported as unhandled by the runner. */
let failWith: Error | null = null;
vi.mock("@/lib/api/browser", () => ({
  browserApi: () => ({
    POST: (...args: unknown[]) => (failWith ? Promise.reject(failWith) : call(...args)),
  }),
}));
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

const submitButton = () => screen.getAllByRole("button", { name: "ส่งคำตอบ" })[0]!;

beforeEach(() => {
  call.mockReset();
  failWith = null;
});

describe("survey rules", () => {
  it("knows which required answers are missing and sends only answered questions", () => {
    const questions = SURVEY_FIXTURE.questions;
    expect(missingRequired(questions, {})).toEqual(["overall", "quality"]);
    expect(missingRequired(questions, { overall: 6, quality: "nope" })).toEqual(["overall", "quality"]);
    expect(toSubmission(questions, { overall: 4, quality: "as_expected", improve: [], comment: "  ดี  " })).toEqual({
      overall: 4,
      quality: "as_expected",
      comment: "ดี",
    });
  });
});

describe("SurveyForm", () => {
  it("shows every question with the reward and the purpose of the answers", () => {
    renderTh(<SurveyForm survey={SURVEY_FIXTURE} />);
    expect(screen.getByRole("radiogroup", { name: "ความพึงพอใจโดยรวม" })).toBeInTheDocument();
    expect(screen.getByText("ตรงตามที่คาด")).toBeInTheDocument();
    expect(screen.getByText(/ตอบครบ 4 ข้อ รับ/)).toBeInTheDocument();
    expect(screen.getByText(/เราใช้คำตอบเพื่อปรับปรุงสินค้าและบริการ/)).toBeInTheDocument();
  });

  it("asks for a required answer before sending anything", async () => {
    renderTh(<SurveyForm survey={SURVEY_FIXTURE} />);
    await act(async () => fireEvent.click(submitButton()));
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("กรุณาตอบคำถามนี้");
    expect(call).not.toHaveBeenCalled();
  });

  it("sends the answers and shows the points the API gave", async () => {
    call.mockResolvedValue({ data: { status: "completed", rewardPoints: 8 } });
    const onSubmitted = vi.fn();
    renderTh(<SurveyForm survey={SURVEY_FIXTURE} onSubmitted={onSubmitted} />);
    fireEvent.click(screen.getByRole("radio", { name: "5" }));
    expect(screen.getByRole("radio", { name: "5" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByLabelText("ตรงตามที่คาด"));
    fireEvent.click(screen.getByLabelText("ราคา"));
    await act(async () => fireEvent.click(submitButton()));
    expect(call).toHaveBeenCalledWith("/v1/store/surveys/{surveyId}/responses", {
      params: { path: { surveyId: SURVEY_FIXTURE.id } },
      body: { answers: { overall: 5, quality: "as_expected", improve: ["price"] } },
    });
    expect(screen.getByText("ขอบคุณสำหรับคำตอบ")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("ได้รับ 8 แต้ม");
    expect(onSubmitted).toHaveBeenCalledWith(8);
  });

  it("says nothing about points when the survey pays none", async () => {
    call.mockResolvedValue({ data: { status: "completed", rewardPoints: 0 } });
    renderTh(<SurveyForm survey={{ ...SURVEY_FIXTURE, rewardPoints: 0 }} />);
    expect(screen.queryByText(/ตอบครบ 4 ข้อ รับ/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "3" }));
    fireEvent.click(screen.getByLabelText("ดีกว่าที่คาด"));
    await act(async () => fireEvent.click(submitButton()));
    expect(screen.getByRole("status")).not.toHaveTextContent("แต้ม");
  });

  it("shows the closed state when the API says the survey is no longer open", async () => {
    const closed = new ApiError({
      title: "",
      status: 409,
      code: "surveys.not_open",
      detail: "",
      requestId: "r",
    } as never);
    failWith = closed;
    renderTh(<SurveyForm survey={SURVEY_FIXTURE} />);
    fireEvent.click(screen.getByRole("radio", { name: "4" }));
    fireEvent.click(screen.getByLabelText("ต่ำกว่าที่คาด"));
    await act(async () => fireEvent.click(submitButton()));
    expect(screen.getByText("แบบสอบถามนี้ปิดแล้ว")).toBeInTheDocument();
  });
});

describe("SurveyCard", () => {
  it("marks the survey seen once and dismisses it for good on later", async () => {
    call.mockResolvedValue({ data: { survey: null } });
    renderTh(<SurveyCard survey={SURVEY_FIXTURE} />);
    expect(screen.getByRole("heading", { name: "คำสั่งซื้อล่าสุดเป็นอย่างไรบ้าง" })).toBeInTheDocument();
    expect(call).toHaveBeenCalledWith("/v1/store/surveys/{surveyId}/actions/seen", {
      params: { path: { surveyId: SURVEY_FIXTURE.id } },
    });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "ไว้ทีหลัง" })));
    expect(call).toHaveBeenCalledWith("/v1/store/surveys/{surveyId}/actions/dismiss", {
      params: { path: { surveyId: SURVEY_FIXTURE.id } },
    });
    expect(screen.queryByRole("heading", { name: "คำสั่งซื้อล่าสุดเป็นอย่างไรบ้าง" })).not.toBeInTheDocument();
  });

  it("renders nothing without an open survey", () => {
    const { container } = renderTh(<SurveyCard survey={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
