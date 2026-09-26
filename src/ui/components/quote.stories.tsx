import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Button } from "./Button";
import { DimensionInput, type LengthUnit } from "./DimensionInput";
import { MaterialSwatch } from "./MaterialSwatch";
import { PriceBreakTable, PriceSummary } from "./PriceSummary";
import { QuoteDock } from "./QuoteDock";
import { Stepper } from "./Stepper";

const meta = {
  title: "Commerce/Configure and quote",
  parameters: {
    docs: {
      description: {
        component:
          "The configurator's pieces (F3 3.2): a stepper whose steps are an accordion, a dimension input " +
          "whose unit switch is display only, material swatches, the price summary and price breaks, and " +
          "the quote dock (a sticky panel from md up, a thumb-zone bar and bottom sheet on phones). Every " +
          "figure is a formatted string from the caller — `src/ui` never formats or adds up money. The " +
          "data here is obviously fake.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const StepperAndDimensions: Story = {
  render: function Render() {
    const [current, setCurrent] = useState("size");
    const [unit, setUnit] = useState<LengthUnit>("mm");
    const [dims, setDims] = useState<Record<string, number | null>>({ l: 120, w: 80, d: 60 });
    return (
      <div className="max-w-xl">
        <Stepper
          aria-label="ขั้นตอนการปรับแต่ง"
          current={current}
          onSelect={setCurrent}
          labels={{ complete: "เรียบร้อยแล้ว", error: "ต้องแก้ไข", stepOf: (i, n) => `ขั้นที่ ${i} จาก ${n}` }}
          steps={[
            {
              id: "size",
              label: "ขนาด",
              summary: "120 × 80 × 60 มม.",
              status: "current",
              content: (
                <DimensionInput
                  legend="ขนาดภายในกล่อง"
                  unit={unit}
                  onUnitChange={setUnit}
                  onChange={(key, mm) => setDims((previous) => ({ ...previous, [key]: mm }))}
                  unitLabels={{ mm: "มม.", cm: "ซม.", in: "นิ้ว" }}
                  unitToggleLabel="หน่วยที่แสดง"
                  axes={[
                    { key: "l", label: "ยาว", valueMm: dims.l ?? null, hint: "30–600 มม." },
                    { key: "w", label: "กว้าง", valueMm: dims.w ?? null, hint: "30–500 มม." },
                    {
                      key: "d",
                      label: "สูง",
                      valueMm: dims.d ?? null,
                      error: (dims.d ?? 0) > 400 ? "ต้องไม่เกิน 400 มม." : undefined,
                    },
                  ]}
                />
              ),
            },
            {
              id: "material",
              label: "วัสดุ",
              summary: "อาร์ตการ์ด 350 แกรม",
              status: "complete",
              content: (
                <div className="flex gap-3">
                  <MaterialSwatch colour="#f4f1ea" /> <MaterialSwatch colour="#b08a5a" />{" "}
                  <MaterialSwatch colour="#c9ccd1" />
                </div>
              ),
            },
            { id: "print", label: "การพิมพ์", status: "error", content: <p>ตัวอย่าง</p> },
          ]}
        />
      </div>
    );
  },
};

export const Dock: Story = {
  render: () => (
    <div className="grid max-w-4xl gap-6 md:grid-cols-[1fr_22rem]">
      <div className="bg-bg-subtle h-96 rounded-xl" />
      <QuoteDock
        title="ราคาของคุณ"
        headline="฿12.02 / ชิ้น"
        subline="รวม ฿12,016.10 · 1,000 ชิ้น"
        primaryAction={
          <Button block iconStart="cart">
            เพิ่มลงตะกร้า
          </Button>
        }
        secondaryActions={
          <Button block variant="secondary">
            ออกแบบเลย
          </Button>
        }
        detailsLabel="รายละเอียด"
        closeLabel="ปิด"
        aboveBottomNav={false}
      >
        <PriceSummary
          aria-label="สรุปราคา"
          rows={[
            { label: "ค่าสินค้า 1,000 ชิ้น", value: "฿12,016.10", hint: "รวม VAT แล้ว" },
            { label: "ค่าจัดส่ง", value: "ระบุรหัสไปรษณีย์", tone: "muted" },
            { label: "ภาษีมูลค่าเพิ่ม", value: "฿786.10", tone: "muted", hint: "รวมอยู่ในยอดทั้งหมดแล้ว" },
          ]}
          total={{ label: "ยอดรวมทั้งหมด", value: "฿12,016.10" }}
          footnote="ราคานี้คงที่ 15 วันเมื่อบันทึกเป็นใบเสนอราคา"
        />
        <PriceBreakTable
          caption="ราคาต่อจำนวน"
          headers={{ quantity: "จำนวน", perPiece: "ต่อชิ้น", total: "รวม" }}
          rows={[
            { key: "500", quantity: "500", perPiece: "฿15.19", total: "฿7,597.00" },
            { key: "1000", quantity: "1,000", perPiece: "฿12.02", total: "฿12,016.10", selected: true },
            { key: "300000", quantity: "300,000", perPiece: "", total: "", unavailable: "กำลังผลิตเต็ม" },
          ]}
          onSelect={() => undefined}
          selectLabel={(row) => `เลือก ${String(row.quantity)}`}
          selectText="เลือก"
          selectedText="เลือกอยู่"
        />
      </QuoteDock>
    </div>
  ),
};
