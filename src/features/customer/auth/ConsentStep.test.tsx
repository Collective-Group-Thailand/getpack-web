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

const consents: Consent[] = [
  {
    purpose: "terms_of_service",
    required: true,
    granted: null,
    outdated: false,
    versionNo: null,
    summary: "ข้อกำหนดการใช้บริการ",
    text: "ฉบับเต็ม",
  },
  {
    purpose: "privacy_notice",
    required: true,
    granted: null,
    outdated: false,
    versionNo: null,
    summary: "ประกาศความเป็นส่วนตัว",
    text: null,
  },
  {
    purpose: "marketing_line",
    required: false,
    granted: null,
    outdated: false,
    versionNo: null,
    summary: "รับข่าวสารทาง LINE",
    text: null,
  },
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

  it("cannot continue until every required purpose is ticked; optional ones start unticked", async () => {
    const { container } = renderStep();
    const accept = screen.getByRole("button", { name: "ยอมรับและดำเนินการต่อ" });
    expect(accept).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "รับข่าวสารทาง LINE" })).not.toBeChecked();

    await userEvent.click(screen.getByRole("checkbox", { name: "ข้อกำหนดการใช้บริการ" }));
    expect(accept).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: "ประกาศความเป็นส่วนตัว" }));
    expect(accept).toBeEnabled();
    await expectNoA11yViolations(container);
  });

  it("records an answer for every purpose shown, granted or not, then moves on", async () => {
    const { onDone } = renderStep();
    await userEvent.click(screen.getByRole("checkbox", { name: "ข้อกำหนดการใช้บริการ" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "ประกาศความเป็นส่วนตัว" }));
    await userEvent.click(screen.getByRole("button", { name: "ยอมรับและดำเนินการต่อ" }));

    expect(recordConsents).toHaveBeenCalledWith(
      [
        { purpose: "terms_of_service", granted: true },
        { purpose: "privacy_notice", granted: true },
        { purpose: "marketing_line", granted: false },
      ],
      "web",
    );
    expect(onDone).toHaveBeenCalled();
  });
});
