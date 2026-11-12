import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import agentSales from "@/i18n/messages/th/agent/sales.json";
import { expectNoA11yViolations } from "@/ui/test/axe";

import { LeadScore } from "./LeadScore";

const reasons = [
  { reason: "source", points: 20 },
  { reason: "company_email_domain", points: 15 },
  { reason: "free_email_domain", points: -5 },
] as const;

function renderScore(props: React.ComponentProps<typeof LeadScore>) {
  return render(
    <NextIntlClientProvider locale="th" messages={{ agentSales }} timeZone="Asia/Bangkok">
      <LeadScore {...props} />
    </NextIntlClientProvider>,
  );
}

describe("LeadScore (D-471)", () => {
  it("opens the reasons from the keyboard, names them, and closes back onto the chip", async () => {
    const user = userEvent.setup();
    const { container } = renderScore({ score: 72, reasons: [...reasons], name: "คุณภูมิ" });
    const chip = screen.getByRole("button", { name: /คะแนนของ คุณภูมิ: 72 จาก 100 — ดูเหตุผล/ });
    expect(chip).toHaveAttribute("aria-expanded", "false");
    await user.tab();
    expect(chip).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(chip).toHaveAttribute("aria-expanded", "true");
    const dialog = await screen.findByRole("dialog", { name: "ทำไมได้ 72 คะแนน" });
    expect(dialog).toHaveTextContent("อีเมลโดเมนบริษัท");
    expect(dialog).toHaveTextContent("+15");
    expect(dialog).toHaveTextContent("−5");
    await expectNoA11yViolations(container);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(chip).toHaveFocus();
  });

  it("is a plain label on an agent's own lead: the score only, no button, no reasons", () => {
    renderScore({ score: 41 });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("คะแนน 41 จาก 100")).toBeTruthy();
  });

  it("says not scored yet rather than showing a zero", () => {
    const { container } = renderScore({ score: null });
    expect(screen.getByText("ยังไม่มีคะแนน")).toBeTruthy();
    expect(container.textContent).not.toContain("0");
  });
});
