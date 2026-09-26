import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { DimensionInput, fromMm, toMm, type LengthUnit } from "./DimensionInput";
import { PriceBreakTable, PriceSummary } from "./PriceSummary";
import { QuoteDock } from "./QuoteDock";
import { Stepper } from "./Stepper";

const stepperLabels = {
  complete: "เรียบร้อยแล้ว",
  error: "ต้องแก้ไข",
  stepOf: (i: number, n: number) => `ขั้นที่ ${i} จาก ${n}`,
};

describe("Stepper", () => {
  function Harness() {
    const [current, setCurrent] = useState("size");
    return (
      <Stepper
        aria-label="ขั้นตอน"
        current={current}
        onSelect={setCurrent}
        labels={stepperLabels}
        steps={[
          { id: "size", label: "ขนาด", status: "current", summary: "100 × 100 × 50 มม.", content: <p>เนื้อหาขนาด</p> },
          { id: "material", label: "วัสดุ", status: "complete", summary: "อาร์ตการ์ด", content: <p>เนื้อหาวัสดุ</p> },
          { id: "print", label: "การพิมพ์", status: "error", content: <p>เนื้อหาการพิมพ์</p> },
        ]}
      />
    );
  }

  it("opens one step at a time, reopens any from its header, and says status in words", async () => {
    const { container } = render(<Harness />);
    expect(screen.getByText("เนื้อหาขนาด")).toBeVisible();
    expect(screen.queryByText("เนื้อหาวัสดุ")).toBeNull();
    // A closed step shows its answer.
    expect(screen.getByText("อาร์ตการ์ด")).toBeInTheDocument();

    const material = screen.getByRole("button", { name: /วัสดุ\s*—\s*เรียบร้อยแล้ว/ });
    expect(material).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(material);
    expect(material).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("เนื้อหาวัสดุ")).toBeVisible();
    expect(screen.getByRole("button", { name: /การพิมพ์\s*—\s*ต้องแก้ไข/ })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")[1]).toHaveAttribute("aria-current", "step");
    await expectNoA11yViolations(container);
  });
});

describe("PriceSummary and PriceBreakTable", () => {
  it("pairs each amount with its label and lets a quantity be chosen", async () => {
    const onSelect = vi.fn();
    const { container } = render(
      <>
        <PriceSummary
          aria-label="สรุปราคา"
          rows={[
            { label: "ค่าสินค้า", value: "฿12,016.10", hint: "รวม VAT แล้ว" },
            { label: "ส่วนลด", value: "−฿500.00", tone: "discount" },
          ]}
          total={{ label: "ยอดรวม", value: "฿11,516.10" }}
        />
        <PriceBreakTable
          caption="ราคาต่อจำนวน"
          headers={{ quantity: "จำนวน", perPiece: "ต่อชิ้น", total: "รวม" }}
          rows={[
            { key: "500", quantity: "500", perPiece: "฿15.19", total: "฿7,597.00" },
            { key: "1000", quantity: "1,000", perPiece: "฿12.02", total: "฿12,016.10", selected: true },
            { key: "300000", quantity: "300,000", perPiece: "", total: "", unavailable: "กำลังผลิตเต็ม" },
          ]}
          onSelect={onSelect}
          selectLabel={(row) => `เลือก ${String(row.quantity)} ชิ้น`}
          selectText="เลือก"
          selectedText="เลือกอยู่"
        />
      </>,
    );
    expect(screen.getByText("฿11,516.10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "เลือก 1,000 ชิ้น" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "เลือก 500 ชิ้น" }));
    expect(onSelect).toHaveBeenCalledWith("500");
    // A quantity without a price stays in the table, explained, and cannot be chosen.
    const row = screen.getByRole("row", { name: /300,000/ });
    expect(within(row).getByText("กำลังผลิตเต็ม")).toBeInTheDocument();
    expect(within(row).queryByRole("button")).toBeNull();
    await expectNoA11yViolations(container);
  });
});

describe("DimensionInput", () => {
  it("converts for display only: the value reported is always whole millimetres", () => {
    expect(fromMm(120, "cm")).toBe("12");
    expect(fromMm(254, "in")).toBe("10");
    expect(toMm("12.5", "cm")).toBe(125);
    expect(toMm("2", "in")).toBe(51);
    expect(toMm("12,5", "cm")).toBe(125);
    expect(toMm("abc", "mm")).toBeNull();
  });

  it("labels each axis with its unit and error, and keeps millimetres across a unit switch", async () => {
    const onChange = vi.fn();
    function Harness() {
      const [unit, setUnit] = useState<LengthUnit>("mm");
      return (
        <DimensionInput
          legend="ขนาดภายใน"
          unit={unit}
          onUnitChange={setUnit}
          onChange={onChange}
          unitLabels={{ mm: "มม.", cm: "ซม.", in: "นิ้ว" }}
          unitToggleLabel="หน่วยที่แสดง"
          axes={[
            { key: "l", label: "ยาว", valueMm: 120, hint: "30–600" },
            { key: "w", label: "กว้าง", valueMm: 80, error: "ต้องไม่เกิน 500" },
          ]}
        />
      );
    }
    const { container } = render(<Harness />);
    const length = screen.getByLabelText("ยาว");
    expect(length).toHaveValue("120");
    expect(screen.getByLabelText("กว้าง")).toHaveAccessibleDescription(/ต้องไม่เกิน 500/);

    await userEvent.click(screen.getByRole("radio", { name: "ซม." }));
    expect(length).toHaveValue("12");
    await userEvent.clear(length);
    await userEvent.type(length, "15");
    expect(onChange).toHaveBeenLastCalledWith("l", 150);
    await expectNoA11yViolations(container);
  });
});

describe("QuoteDock", () => {
  it("shows the headline and actions, and the status instead of a price when there is none", async () => {
    const { container, rerender } = render(
      <QuoteDock
        title="ราคาของคุณ"
        headline="฿12.02 / ชิ้น"
        subline="รวม ฿12,016.10"
        primaryAction={<button type="button">เพิ่มลงตะกร้า</button>}
        detailsLabel="รายละเอียด"
        closeLabel="ปิด"
      >
        <p>รายละเอียดราคา</p>
      </QuoteDock>,
    );
    expect(screen.getAllByText("฿12.02 / ชิ้น").length).toBeGreaterThan(0);
    expect(screen.getByRole("complementary", { name: "ราคาของคุณ" })).toBeInTheDocument();
    await expectNoA11yViolations(container);

    rerender(
      <QuoteDock
        title="ราคาของคุณ"
        headline=""
        status={<p>เลือกอีกนิดเพื่อดูราคา</p>}
        primaryAction={<button type="button">ขอใบเสนอราคา</button>}
        detailsLabel="รายละเอียด"
        closeLabel="ปิด"
      >
        {null}
      </QuoteDock>,
    );
    expect(screen.getAllByText("เลือกอีกนิดเพื่อดูราคา").length).toBeGreaterThan(0);
  });
});
