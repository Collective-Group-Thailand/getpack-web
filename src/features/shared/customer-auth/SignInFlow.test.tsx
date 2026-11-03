import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import auth from "@/i18n/messages/th/common/auth.json";
import common from "@/i18n/messages/th/common/common.json";
import { expectNoA11yViolations } from "@/ui/test/axe";

import { SignInFlow } from "./SignInFlow";

vi.mock("./actions", () => ({
  requestOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signInWithFirebase: vi.fn(),
  signInWithLine: vi.fn(),
}));
vi.mock("./providers", () => ({ firebaseConfigured: () => true, lineConfigured: () => true }));

function renderFlow(providersFirst: boolean) {
  return render(
    <NextIntlClientProvider locale="th" messages={{ auth, common }}>
      <SignInFlow variant="overlay" providersFirst={providersFirst} />
    </NextIntlClientProvider>,
  );
}

/** Where a control sits in the document, to compare the order the person meets them in. */
const position = (element: HTMLElement) =>
  [...document.querySelectorAll("button, input")].indexOf(element as HTMLButtonElement | HTMLInputElement);

describe("SignInFlow — one-tap providers first (D-471, the second free dieline download)", () => {
  it("puts Google, Apple and LINE above the phone OTP form when asked mid-task", async () => {
    const { container } = renderFlow(true);
    const google = screen.getByRole("button", { name: /Google/ });
    const apple = screen.getByRole("button", { name: /Apple/ });
    const line = screen.getByRole("button", { name: /LINE/ });
    const phone = screen.getByRole("textbox");
    expect(position(google)).toBeLessThan(position(apple));
    expect(position(apple)).toBeLessThan(position(line));
    expect(position(line)).toBeLessThan(position(phone));
    expect(screen.getByText("หรือใช้เบอร์มือถือ")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("keeps the phone form first on the sign-in page and everywhere else", () => {
    renderFlow(false);
    expect(position(screen.getByRole("textbox"))).toBeLessThan(
      position(screen.getByRole("button", { name: /Google/ })),
    );
  });
});
