import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "../test";
import { Field } from "./Field";
import { normaliseThaiMobile, PhoneInput, isThaiMobile } from "./PhoneInput";
import { OTPInput } from "./OTPInput";

function ControlledOtp({
  length = 6,
  onComplete,
  appearance,
}: {
  length?: number;
  onComplete?: (value: string) => void;
  appearance?: "field" | "boxes";
}) {
  const [value, setValue] = useState("");
  return (
    <Field label="รหัส OTP">
      <OTPInput value={value} onChange={setValue} length={length} onComplete={onComplete} appearance={appearance} />
    </Field>
  );
}

describe("OTPInput", () => {
  it("is a single field, so a code can be pasted (WCAG 2.2 §3.3.8)", async () => {
    render(<ControlledOtp />);
    const input = screen.getByLabelText("รหัส OTP");

    await userEvent.click(input);
    await userEvent.paste("123456");

    expect(input).toHaveValue("123456");
    // One input, not six: split boxes are where paste and autofill break.
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  it("draws one box per digit over the same single input, which still takes a paste", async () => {
    const onComplete = vi.fn();
    const { container } = render(<ControlledOtp appearance="boxes" onComplete={onComplete} />);
    const input = screen.getByLabelText("รหัส OTP");

    await userEvent.click(input);
    await userEvent.paste("รหัสของคุณ 482913");

    expect(input).toHaveValue("482913");
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    const boxes = container.querySelectorAll("span[aria-hidden='true']");
    expect([...boxes].map((box) => box.textContent).join("")).toBe("482913");
    expect(onComplete).toHaveBeenCalledWith("482913");
    await expectNoA11yViolations(container);
  });

  it("offers itself to the SMS autofill and the number pad", () => {
    render(<ControlledOtp />);
    const input = screen.getByLabelText("รหัส OTP");

    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    expect(input).toHaveAttribute("inputmode", "numeric");
  });

  it("keeps only the digits out of a pasted code that carries formatting", async () => {
    render(<ControlledOtp />);
    const input = screen.getByLabelText("รหัส OTP");

    await userEvent.click(input);
    await userEvent.paste("รหัส 123 456");

    expect(input).toHaveValue("123456");
  });

  it("stops at the length the API said the code is", async () => {
    render(<ControlledOtp length={4} />);
    const input = screen.getByLabelText("รหัส OTP");

    await userEvent.click(input);
    await userEvent.paste("123456789");

    expect(input).toHaveValue("1234");
  });

  it("reports completion once, when the code is full length", async () => {
    const onComplete = vi.fn();
    render(<ControlledOtp length={4} onComplete={onComplete} />);

    await userEvent.click(screen.getByLabelText("รหัส OTP"));
    await userEvent.paste("1234");

    expect(onComplete).toHaveBeenCalledExactlyOnceWith("1234");
  });

  it("has no axe violations", async () => {
    const { container } = render(<ControlledOtp />);
    await expectNoA11yViolations(container);
  });
});

describe("normaliseThaiMobile", () => {
  it("keeps digits and drops the spacing people type", () => {
    expect(normaliseThaiMobile("081 234 5678")).toBe("0812345678");
    expect(normaliseThaiMobile("081-234-5678")).toBe("0812345678");
  });

  it("never grows past the ten digits a Thai mobile number has", () => {
    expect(normaliseThaiMobile("08123456789999")).toBe("0812345678");
  });
});

function ControlledPhone() {
  const [value, setValue] = useState("");
  return (
    <Field label="เบอร์มือถือ" hint="ใช้เบอร์ในประเทศไทย">
      <PhoneInput value={value} onChange={setValue} />
    </Field>
  );
}

describe("isThaiMobile", () => {
  it("takes ten digits from 0, or nine typed after +66 without the 0", () => {
    expect(isThaiMobile("0812345678")).toBe(true);
    expect(isThaiMobile("812345678")).toBe(true);
    expect(isThaiMobile("081234567")).toBe(false);
    expect(isThaiMobile("0212345678")).toBe(false);
  });
});

describe("PhoneInput", () => {
  it("shows the number grouped as it is read off a phone, whatever was typed", async () => {
    render(<ControlledPhone />);
    const input = screen.getByLabelText("เบอร์มือถือ");

    await userEvent.type(input, "0812345678");

    expect(input).toHaveValue("081 234 5678");
  });

  it("groups a mobile typed without its leading zero", async () => {
    render(<ControlledPhone />);
    const input = screen.getByLabelText("เบอร์มือถือ");

    await userEvent.type(input, "812345678");

    expect(input).toHaveValue("81 234 5678");
  });

  it("is wired to its label and hint through Field, not by hand", () => {
    render(<ControlledPhone />);
    const input = screen.getByLabelText("เบอร์มือถือ");

    expect(input).toHaveAccessibleDescription("ใช้เบอร์ในประเทศไทย");
  });

  it("hides the dialling code from screen readers, which the label already covers", () => {
    render(<ControlledPhone />);

    expect(screen.queryByText("+66")).toHaveAttribute("aria-hidden", "true");
  });

  it("has no axe violations", async () => {
    const { container } = render(<ControlledPhone />);
    await expectNoA11yViolations(container);
  });
});
