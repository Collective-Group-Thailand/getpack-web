import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { BigActionButton } from "./BigActionButton";
import { CameraCapture, type CapturedPhoto } from "./CameraCapture";
import { LabelSheet } from "./LabelSheet";
import { QRCode } from "./QRCode";
import { ScanButton } from "./ScanButton";
import { SignaturePad } from "./SignaturePad";
import { StageStepper } from "./StageStepper";

const meta = {
  title: "Partner/Shop floor",
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    docs: {
      description: {
        component:
          "The partner zone's shop-floor set (design-system.md §3, §5): 48 px and larger targets, " +
          "18 px text, one primary action per view, and a non-drag or non-camera path for every " +
          "gesture — a typed code instead of the scanner, a typed name instead of a drawn signature.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const BigAction: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-3">
      <BigActionButton title="รับงาน" hint="เหลือเวลารับงาน 3 ชม. 12 นาที" icon="check" />
      <BigActionButton title="ปฏิเสธงาน" tone="secondary" icon="ban" />
      <BigActionButton title="กำลังบันทึก" loading />
    </div>
  ),
};

export const Stages: Story = {
  render: () => (
    <StageStepper
      className="max-w-md"
      label="ขั้นตอนการผลิต"
      stateLabels={{ done: "เสร็จแล้ว", current: "ขั้นปัจจุบัน", upcoming: "ถัดไป", skipped: "ข้าม" }}
      stages={[
        { key: "1", title: "รับงาน", state: "done", meta: "เสร็จ 25 ก.ย. 09:10" },
        { key: "2", title: "เตรียมวัตถุดิบ", state: "done", meta: "ดี 5,200 · เสีย 0" },
        {
          key: "3",
          title: "พิมพ์",
          state: "current",
          meta: "ครบกำหนด 27 ก.ย. 17:00",
          children: <BigActionButton title="จบขั้นตอนพิมพ์" hint="ต้องแนบรูปอย่างน้อยหนึ่งรูป" icon="check" />,
        },
        { key: "4", title: "ไดคัท", state: "upcoming" },
        { key: "5", title: "ตรวจคุณภาพ", state: "upcoming" },
      ]}
    />
  ),
};

export const Camera: Story = {
  render: function Render() {
    const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
    return (
      <CameraCapture
        className="max-w-md"
        photos={photos}
        onChange={setPhotos}
        labels={{
          take: "ถ่ายรูป",
          more: "ถ่ายเพิ่ม",
          photo: (n) => `รูปที่ ${n}`,
          remove: (n) => `ลบรูปที่ ${n}`,
          count: (n) => `${n} รูป`,
          processing: "กำลังเตรียมรูป",
        }}
      />
    );
  },
};

export const Scan: Story = {
  render: () => (
    <ScanButton
      onCode={() => {}}
      labels={{
        open: "สแกน QR",
        title: "สแกนรหัสงาน",
        aim: "เล็งกล้องไปที่ QR บนใบงานหรือฉลากกล่อง",
        noCamera: "อุปกรณ์นี้สแกนไม่ได้ พิมพ์รหัสแทนได้เลย",
        manual: "รหัสงานหรือรหัสกล่อง",
        manualHint: "เช่น J-2569-00300",
        submit: "เปิดงาน",
        close: "ปิด",
      }}
    />
  ),
};

export const Signature: Story = {
  render: () => (
    <SignaturePad
      className="max-w-md"
      onChange={() => {}}
      labels={{
        label: "ลายเซ็นผู้รับ",
        hint: "ให้ผู้รับเซ็นในกรอบ หรือพิมพ์ชื่อแทน",
        clear: "ล้างลายเซ็น",
        draw: "เซ็น",
        type: "พิมพ์ชื่อ",
        typedName: "ชื่อผู้รับ",
        mode: "วิธีลงชื่อ",
      }}
    />
  ),
};

export const CartonLabels: Story = {
  render: () => (
    <LabelSheet
      label="ฉลากกล่อง"
      labels={[1, 2].map((n) => (
        <div key={n} className="flex h-full flex-col gap-2">
          <p className="text-2xl font-bold">{`S-2569-00801-0${n}`}</p>
          <p>{`กล่องที่ ${n} จาก 2`}</p>
          <p>คุณผู้รับ ตัวอย่าง · 0812345678</p>
          <p>99 ถนนตัวอย่าง แขวงตัวอย่าง กรุงเทพฯ 10110</p>
          <div className="mt-auto self-center">
            <QRCode value={`https://packio.invalid/track/S-2569-00801-0${n}`} size="40mm" label={`QR ติดตามกล่องที่ ${n}`} />
          </div>
        </div>
      ))}
    />
  ),
};
