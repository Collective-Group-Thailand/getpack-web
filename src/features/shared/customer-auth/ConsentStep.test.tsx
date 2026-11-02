import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import auth from "@/i18n/messages/th/common/auth.json";
import { expectNoA11yViolations } from "@/ui/test/axe";

import { ConsentStep } from "./ConsentStep";
import type { Consent } from "./onboarding";

const recordConsents = vi.fn(async () => undefined);
vi.mock("./onboarding", () => ({ recordConsents: (...args: unknown[]) => recordConsents(...(args as [])) }));
vi.mock("@/lib/analytics/useConsent", () => ({ useConsent: () => ({ consent: { analytics: true } }) }));

const consent = (purpose: string, required: boolean, summary: string, text: string | null = null): Consent => ({
  purpose,
  labelTh: summary,
  labelEn: summary,
  required,
  granted: null,
  outdated: false,
  versionNo: null,
  summary,
  text,
});

const consents: Consent[] = [
  consent("terms_of_service", true, "ข้อกำหนดการใช้บริการ", "ฉบับเต็ม"),
  consent("privacy_notice", true, "ประกาศความเป็นส่วนตัว"),
  consent("marketing_line", false, "รับข่าวสารทาง LINE"),
  consent("marketing_sms", false, "รับข่าวสารทาง SMS"),
  consent("analytics_cookies", false, "คุกกี้วิเคราะห์"),
];

function renderStep(onDone = vi.fn()) {
  const view = render(
    <NextIntlClientProvider locale="th" messages={{ auth }}>
      <ConsentStep consents={consents} source="web" onDone={onDone} />
    </NextIntlClientProvider>,
  );
  return { ...view, onDone };
}

describe("the consent step", () => {
  beforeEach(() => recordConsents.mockClear());

  it("asks for one tick covering every required purpose, and the news tick starts off", async () => {
    const { container } = renderStep();
    const accept = screen.getByRole("button", { name: "ยอมรับและดำเนินการต่อ" });
    expect(accept).toBeDisabled();
    const news = screen.getByRole("checkbox", { name: /รับข่าวสาร โปรโมชัน/ });
    expect(news).not.toBeChecked();
    // Cookie analytics is the banner's answer, not a tick here.
    expect(screen.queryByRole("checkbox", { name: "คุกกี้วิเคราะห์" })).toBeNull();

    await userEvent.click(screen.getByRole("checkbox", { name: /ข้อกำหนดการใช้บริการ/ }));
    expect(accept).toBeEnabled();
    await expectNoA11yViolations(container);
  });

  it("keeps the full text's disclosure out of a paragraph, so it hydrates (no <details> in <p>)", () => {
    const { container } = renderStep();
    expect(container.querySelector("p details")).toBeNull();
  });

  it("records an answer for every purpose, the news tick granting every channel", async () => {
    const { onDone } = renderStep();
    await userEvent.click(screen.getByRole("checkbox", { name: /ข้อกำหนดการใช้บริการ/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /รับข่าวสาร โปรโมชัน/ }));
    await userEvent.click(screen.getByRole("button", { name: "ยอมรับและดำเนินการต่อ" }));

    expect(recordConsents).toHaveBeenCalledWith(
      [
        { purpose: "terms_of_service", granted: true },
        { purpose: "privacy_notice", granted: true },
        { purpose: "marketing_line", granted: true },
        { purpose: "marketing_sms", granted: true },
        { purpose: "analytics_cookies", granted: true },
      ],
      "web",
    );
    expect(onDone).toHaveBeenCalled();
  });

  it("lets one channel be chosen on its own under 'choose channels'", async () => {
    renderStep();
    await userEvent.click(screen.getByRole("checkbox", { name: /ข้อกำหนดการใช้บริการ/ }));
    await userEvent.click(screen.getByText("เลือกช่องทางเอง"));
    await userEvent.click(screen.getByRole("checkbox", { name: "รับข่าวสารทาง LINE" }));
    await userEvent.click(screen.getByRole("button", { name: "ยอมรับและดำเนินการต่อ" }));
    expect(recordConsents).toHaveBeenCalledWith(
      expect.arrayContaining([
        { purpose: "marketing_line", granted: true },
        { purpose: "marketing_sms", granted: false },
      ]),
      "web",
    );
  });
});
