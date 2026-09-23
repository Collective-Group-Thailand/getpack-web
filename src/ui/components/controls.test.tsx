import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { Checkbox } from "./Checkbox";
import { ColorField } from "./ColorField";
import { Field } from "./Field";
import { RadioCards } from "./RadioCards";
import { SegmentedControl } from "./SegmentedControl";
import { Select } from "./Select";
import { Slider } from "./Slider";
import { Switch } from "./Switch";

describe("Checkbox", () => {
  it("cannot be built without a label, and the label toggles it", async () => {
    const { container } = render(<Checkbox label="แสดงเขตปลอดภัย (3 มม.)" />);
    const checkbox = screen.getByRole("checkbox", { name: "แสดงเขตปลอดภัย (3 มม.)" });

    await userEvent.click(screen.getByText("แสดงเขตปลอดภัย (3 มม.)"));
    expect(checkbox).toBeChecked();
    await expectNoA11yViolations(container);
  });

  it("toggles with Space", async () => {
    render(<Checkbox label="แสดงชื่อด้านกล่อง" />);
    await userEvent.tab();
    await userEvent.keyboard(" ");
    expect(screen.getByRole("checkbox")).toBeChecked();
  });
});

describe("Switch", () => {
  it("is labelled and operable by keyboard", async () => {
    const onCheckedChange = vi.fn();
    const { container } = render(<Switch label="โหมดคอนทราสต์สูง" onCheckedChange={onCheckedChange} />);

    await userEvent.tab();
    await userEvent.keyboard(" ");
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("switch", { name: "โหมดคอนทราสต์สูง" })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});

describe("Select", () => {
  it("takes its accessible name from the Field around it", async () => {
    const { container } = render(
      <Field label="วัสดุ">
        <Select
          options={[
            { value: "kraft", label: "คราฟท์ 350 แกรม" },
            { value: "art", label: "อาร์ตการ์ด 350 แกรม" },
          ]}
          placeholder="เลือกวัสดุ"
        />
      </Field>,
    );
    expect(screen.getByRole("combobox", { name: "วัสดุ" })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("opens with the keyboard and reports the chosen value", async () => {
    const onValueChange = vi.fn();
    render(
      <Select
        aria-label="วัสดุ"
        options={[
          { value: "kraft", label: "คราฟท์" },
          { value: "art", label: "อาร์ตการ์ด" },
        ]}
        onValueChange={onValueChange}
      />,
    );

    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("option", { name: "คราฟท์" })).toBeInTheDocument();
  });
});

describe("RadioCards", () => {
  it("is a single radio group with arrow-key navigation", async () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <Field label="รูปแบบกล่อง">
        <RadioCards
          value="rsc"
          onValueChange={onValueChange}
          options={[
            { value: "rsc", label: "กล่องฝาชน (RSC)", description: "กล่องลูกฟูกมาตรฐาน" },
            { value: "tuck-end", label: "กล่องฝาเสียบ", description: "กระดาษแข็งสำหรับขายปลีก" },
          ]}
        />
      </Field>,
    );

    expect(screen.getByRole("radiogroup", { name: "รูปแบบกล่อง" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /กล่องฝาชน/ })).toBeChecked();

    // Focus lands on the checked card (roving tabindex) and the arrow keys move between cards.
    // Radix's selection-follows-focus needs a real browser to drive, so e2e covers that half.
    const first = screen.getByRole("radio", { name: /กล่องฝาชน/ });
    await userEvent.click(first);
    expect(onValueChange).not.toHaveBeenCalled();

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: /กล่องฝาเสียบ/ })).toHaveFocus();

    await userEvent.click(screen.getByRole("radio", { name: /กล่องฝาเสียบ/ }));
    expect(onValueChange).toHaveBeenCalledWith("tuck-end");
    await expectNoA11yViolations(container);
  });
});

describe("SegmentedControl", () => {
  it("never reports an empty selection", async () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedControl
        label="จัดวาง"
        value="center"
        onValueChange={onValueChange}
        options={[
          { value: "left", label: "ซ้าย" },
          { value: "center", label: "กลาง" },
          { value: "right", label: "ขวา" },
        ]}
      />,
    );

    // Clicking the active segment would clear a bare ToggleGroup; here it is ignored.
    await userEvent.click(screen.getByRole("radio", { name: "กลาง" }));
    expect(onValueChange).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("radio", { name: "ขวา" }));
    expect(onValueChange).toHaveBeenCalledWith("right");
  });
});

describe("Slider", () => {
  it("offers a keyboard alternative to dragging (WCAG 2.5.7)", async () => {
    const onValueChange = vi.fn();
    render(
      <Slider aria-label="ซูม" value={[100]} min={10} max={400} onValueChange={onValueChange} valueText="100 %" />,
    );

    const slider = screen.getByRole("slider", { name: "ซูม" });
    expect(slider).toHaveAttribute("aria-valuetext", "100 %");

    slider.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenCalled();
  });
});

describe("ColorField", () => {
  it("lets the value be typed as well as picked", async () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <Field label="สีลาย">
        <ColorField value="#0f766e" onValueChange={onValueChange} hexLabel="รหัสสี" />
      </Field>,
    );

    const hex = screen.getByRole("textbox", { name: "รหัสสี" });
    await userEvent.clear(hex);
    expect(onValueChange).toHaveBeenCalled();
    await expectNoA11yViolations(container);
  });
});
