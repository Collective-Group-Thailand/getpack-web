import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Checkbox } from "./Checkbox";
import { ColorField } from "./ColorField";
import { Field, FormSection } from "./Field";
import { Input, NumberInput, Textarea } from "./Input";
import { RadioCards } from "./RadioCards";
import { SegmentedControl } from "./SegmentedControl";
import { Select } from "./Select";
import { Slider } from "./Slider";
import { Switch } from "./Switch";

const meta = {
  title: "Forms/Field and controls",
  parameters: {
    docs: {
      description: {
        component:
          "Labels above the field, hint below it, the error leading the description " +
          "(design-system.md §4). `<Field>` wires `aria-describedby`, `aria-invalid`, " +
          "`required` and `disabled` through context, so no screen has to remember to.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextControls: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-4">
      <Field label="ชื่อแบบ" hint="ใช้ค้นหาภายหลัง" required requiredLabel="จำเป็น">
        <Input defaultValue="กล่องขนมปัง" />
      </Field>
      <Field label="สูง (H)" hint="ขนาดสินค้า ไม่ใช่ขนาดกล่อง">
        <NumberInput unit="มม." defaultValue={80} />
      </Field>
      <Field label="ยาว (L)" error="ต้องอยู่ระหว่าง 50–800 มม. (รวมระยะเผื่อแล้ว)">
        <NumberInput unit="มม." defaultValue={1200} />
      </Field>
      <Field label="หมายเหตุถึงโรงพิมพ์">
        <Textarea placeholder="เช่น ต้องการเคลือบด้าน" />
      </Field>
      <Field label="ชื่อแบบ" disabled hint="แก้ไขไม่ได้เมื่อส่งผลิตแล้ว">
        <Input defaultValue="กล่องขนมปัง" />
      </Field>
    </div>
  ),
};

export const Choices: Story = {
  render: function Choices() {
    const [style, setStyle] = useState("rsc");
    const [mode, setMode] = useState("preset");
    const [paper, setPaper] = useState("kraft-3");

    return (
      <div className="flex max-w-2xl flex-col gap-6">
        <FormSection title="ตั้งค่ากล่อง" description="เลือกรูปแบบ ขนาด และวัสดุ">
          <Field label="รูปแบบกล่อง">
            <RadioCards
              value={style}
              onValueChange={setStyle}
              options={[
                { value: "rsc", label: "กล่องฝาชน (RSC)", description: "กล่องลูกฟูกมาตรฐานสำหรับขนส่ง" },
                { value: "tuck-end", label: "กล่องฝาเสียบ", description: "กระดาษแข็งสำหรับสินค้าขายปลีก" },
                { value: "tray", label: "ถาดฝาเปิด", description: "เบเกอรี่และของขวัญ" },
              ]}
            />
          </Field>

          <Field label="วิธีกำหนดขนาด">
            <SegmentedControl
              label="วิธีกำหนดขนาด"
              value={mode}
              onValueChange={setMode}
              options={[
                { value: "preset", label: "ขนาดมาตรฐาน" },
                { value: "custom", label: "กำหนดเองจากขนาดสินค้า" },
              ]}
            />
          </Field>

          <Field label="วัสดุ" hint="ความหนามีผลต่อขนาดแผ่นคลี่">
            <Select
              value={paper}
              onValueChange={setPaper}
              options={[
                { value: "kraft-3", label: "คราฟท์ลูกฟูก 3 ชั้น (หนา 3 มม.)" },
                { value: "art-350", label: "อาร์ตการ์ด 350 แกรม (หนา 0.4 มม.)" },
                { value: "kraft-5", label: "คราฟท์ลูกฟูก 5 ชั้น (หนา 5 มม.)" },
              ]}
              placeholder="เลือกวัสดุ"
            />
          </Field>
        </FormSection>
      </div>
    );
  },
};

export const Toggles: Story = {
  render: function Toggles() {
    const [zoom, setZoom] = useState([100]);
    const [colour, setColour] = useState("#0f766e");

    return (
      <div className="flex max-w-md flex-col gap-5">
        <Checkbox label="แสดงเขตปลอดภัย (3 มม.)" description="เส้นประรอบพื้นที่ปลอดภัยของแต่ละด้าน" defaultChecked />
        <Checkbox label="แสดงชื่อด้านกล่อง" />
        <Switch label="โหมดคอนทราสต์สูง" description="สำหรับใช้งานในโรงงาน" labelPosition="start" />
        <Field label={`ซูม ${zoom[0]} %`}>
          <Slider value={zoom} onValueChange={setZoom} min={10} max={400} valueText={`${zoom[0]} เปอร์เซ็นต์`} />
        </Field>
        <Field label="สีลาย">
          <ColorField
            value={colour}
            onValueChange={setColour}
            hexLabel="รหัสสี"
            swatches={[
              { value: "#0f766e", label: "เขียวแบรนด์" },
              { value: "#1f2937", label: "เทาเข้ม" },
              { value: "#b45309", label: "น้ำตาลคราฟท์" },
            ]}
          />
        </Field>
      </div>
    );
  },
};
