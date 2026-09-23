import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { AlertDialog } from "./AlertDialog";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { DropdownMenu } from "./DropdownMenu";
import { IconButton } from "./IconButton";
import { Input } from "./Input";
import { Field } from "./Field";
import { Popover } from "./Popover";
import { Sheet } from "./Sheet";
import { Tabs } from "./Tabs";
import { Toaster, toast } from "./Toast";

const meta = {
  title: "Overlays/Dialogs, sheets and menus",
  parameters: {
    docs: {
      description: {
        component:
          "Focus trapped and restored, Escape closes, the page behind goes `aria-hidden` — " +
          "all from Radix, none of it re-implemented per screen (ADR-0002).",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const BoxSetupDialog: Story = {
  render: function BoxSetup() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>ตั้งค่ากล่อง</Button>
        <Dialog
          open={open}
          onOpenChange={setOpen}
          title="ตั้งค่ากล่อง"
          description="เลือกรูปแบบ ขนาด และวัสดุ"
          closeLabel="ปิด"
          size="lg"
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                ยกเลิก
              </Button>
              <Button onClick={() => setOpen(false)}>เริ่มออกแบบ</Button>
            </>
          }
        >
          <Field label="ชื่อแบบ" hint="ใช้ค้นหาภายหลัง">
            <Input defaultValue="กล่องขนมปัง" />
          </Field>
        </Dialog>
      </>
    );
  },
};

export const TypedConfirmation: Story = {
  name: "AlertDialog — typed confirmation",
  parameters: {
    docs: {
      description: {
        story:
          "Master-plan §8: an irreversible action restates the target — order code and " +
          "amount — and stays locked until the user retypes the code. Used for refunds, " +
          "credit notes, payout approval, bank-account changes and period close.",
      },
    },
  },
  render: function Typed() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          ยกเลิกคำสั่งซื้อ
        </Button>
        <AlertDialog
          open={open}
          onOpenChange={setOpen}
          tone="destructive"
          title="ยกเลิกคำสั่งซื้อ"
          description="PK-2569-00042 · ฿12,500.00 — ยกเลิกแล้วไม่สามารถกู้คืนได้"
          confirmationPhrase="PK-2569-00042"
          confirmationLabel="พิมพ์ PK-2569-00042 เพื่อยืนยัน"
          confirmLabel="ยกเลิกคำสั่งซื้อ"
          cancelLabel="ไม่ใช่ตอนนี้"
          onConfirm={() => setOpen(false)}
        />
      </>
    );
  },
};

export const SimpleConfirmation: Story = {
  render: function Simple() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          ล้างทั้งหมด
        </Button>
        <AlertDialog
          open={open}
          onOpenChange={setOpen}
          tone="destructive"
          title="ล้างงานออกแบบทั้งหมด?"
          description="ลบทุกองค์ประกอบและลวดลายออกจากแผ่นคลี่ ย้อนกลับได้ด้วย Ctrl+Z"
          confirmLabel="ล้างทั้งหมด"
          cancelLabel="ยกเลิก"
          onConfirm={() => setOpen(false)}
        />
      </>
    );
  },
};

export const BottomSheet: Story = {
  render: function BottomSheetStory() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>คุณสมบัติ</Button>
        <Sheet open={open} onOpenChange={setOpen} title="คุณสมบัติ" closeLabel="ปิด" side="bottom">
          <Field label="ข้อความ">
            <Input defaultValue="ข้อความของคุณ" />
          </Field>
        </Sheet>
      </>
    );
  },
};

export const ExportMenu: Story = {
  render: () => (
    <DropdownMenu
      label="ส่งออก"
      trigger={
        <Button variant="secondary" iconEnd="chevron-down">
          ส่งออก
        </Button>
      }
      items={[
        { id: "pdf", label: "PDF สำหรับโรงพิมพ์", description: "ขนาดจริง + bleed 3 มม.", icon: "document" },
        { id: "png", label: "PNG งานพิมพ์ (300 dpi)", description: "ไม่มีเส้นไกด์", icon: "image" },
        { id: "svg", label: "SVG ไดคัท", description: "เส้นตัด/พับ แยกเลเยอร์", icon: "ruler" },
        { id: "delete", label: "ลบแบบนี้", icon: "trash", tone: "destructive", separatorBefore: true },
      ]}
    />
  ),
};

export const HelpPopover: Story = {
  render: () => (
    <Popover aria-label="คำอธิบายวัสดุ" trigger={<IconButton name="help" label="ลูกฟูก E-flute คืออะไร?" />}>
      <p className="font-medium">ลูกฟูก E-flute</p>
      <p className="text-muted mt-1">ลอนบางประมาณ 1.5 มม. ผิวเรียบพอสำหรับพิมพ์สี่สี เหมาะกับกล่องสินค้าขนาดเล็ก</p>
    </Popover>
  ),
};

export const TabbedViews: Story = {
  render: () => (
    <Tabs
      label="มุมมอง"
      items={[
        { value: "flat", label: "แผ่นคลี่", content: <p className="text-muted text-sm">ผืนผ้าใบไดคัท</p> },
        { value: "3d", label: "พรีวิว 3D", content: <p className="text-muted text-sm">โมเดลสามมิติ</p> },
        { value: "rules", label: "ข้อกำหนดงานพิมพ์", content: <p className="text-muted text-sm">bleed 3 มม.</p> },
      ]}
    />
  ),
};

export const Toasts: Story = {
  render: () => (
    <>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => toast.success("บันทึกแล้ว")}>บันทึก</Button>
        <Button
          variant="secondary"
          onClick={() => toast("ลบแบบแล้ว", { action: { label: "เลิกทำ", onClick: () => {} } })}
        >
          ลบพร้อมเลิกทำ
        </Button>
        <Button variant="secondary" onClick={() => toast.error("บันทึกไม่สำเร็จ — พื้นที่จัดเก็บเต็ม")}>
          ข้อผิดพลาด
        </Button>
      </div>
      <Toaster />
    </>
  ),
};
