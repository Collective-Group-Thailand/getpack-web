import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { Field } from "./Field";
import { Input, NumberInput, Textarea } from "./Input";

describe("Field", () => {
  it("wires the label, hint and error to the control without app code", () => {
    render(
      <Field label="ชื่อแบบ" hint="ใช้ค้นหาภายหลัง" required requiredLabel="จำเป็น">
        <Input />
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: /ชื่อแบบ/ });
    expect(input).toBeRequired();
    expect(input).toHaveAccessibleDescription("ใช้ค้นหาภายหลัง");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("marks the control invalid and describes it with the error", () => {
    render(
      <Field label="ยาว (L)" hint="หน่วยมิลลิเมตร" error="ต้องอยู่ระหว่าง 50–800 มม.">
        <Input />
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "ยาว (L)" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    // The error leads, and the hint stays available.
    expect(input).toHaveAccessibleDescription("ต้องอยู่ระหว่าง 50–800 มม. หน่วยมิลลิเมตร");
  });

  it("gives the required marker a word, not just an asterisk", () => {
    render(
      <Field label="ชื่อ" required requiredLabel="จำเป็น">
        <Input />
      </Field>,
    );
    expect(screen.getByText("จำเป็น")).toBeInTheDocument();
  });

  it("clicking the label focuses the control", async () => {
    render(
      <Field label="ชื่อแบบ">
        <Input />
      </Field>,
    );
    await userEvent.click(screen.getByText("ชื่อแบบ"));
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("has no axe violations across the text controls", async () => {
    const { container } = render(
      <div>
        <Field label="ชื่อแบบ" hint="ใช้ค้นหาภายหลัง">
          <Input />
        </Field>
        <Field label="รายละเอียด">
          <Textarea />
        </Field>
        <Field label="สูง (H)" error="จำเป็น">
          <NumberInput unit="มม." />
        </Field>
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});

describe("NumberInput", () => {
  it("announces the unit as part of the control", () => {
    render(
      <Field label="สูง (H)">
        <NumberInput unit="มม." defaultValue={80} />
      </Field>,
    );
    expect(screen.getByRole("spinbutton", { name: "สูง (H)" })).toHaveAccessibleDescription("มม.");
  });

  it("works outside a Field, for toolbars", () => {
    render(<NumberInput aria-label="ซูม" unit="%" defaultValue={100} />);
    expect(screen.getByRole("spinbutton", { name: "ซูม" })).toBeInTheDocument();
  });
});
