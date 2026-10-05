import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Button } from "./Button";
import { CoachMarks } from "./CoachMarks";
import { PageSkeleton } from "./PageSkeleton";

const meta = {
  title: "Patterns/Guidance and loading",
  parameters: {
    docs: {
      description: {
        component:
          "First-run coach marks (at most three, never modal, re-openable) and route-level loading " +
          "shapes that look like the page they stand in for (U5.2, U5.7).",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function CoachDemo() {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col gap-6">
      <nav data-coach="demo-steps" className="border-border rounded-lg border p-3 text-sm">
        ① เลือกกล่อง → ② ออกแบบ → ③ ตรวจไฟล์ → ④ สั่งผลิต
      </nav>
      <section data-coach="demo-price" className="border-border w-60 rounded-lg border p-3 text-sm">
        ฿12.50 / ชิ้น
      </section>
      <Button data-coach="demo-help" variant="secondary" className="self-start" onClick={() => setOpen(true)}>
        ?
      </Button>
      <CoachMarks
        open={open}
        onClose={() => setOpen(false)}
        marks={[
          { target: '[data-coach="demo-steps"]', title: "ทำทีละขั้น", body: "กดขั้นที่ทำแล้วเพื่อย้อนกลับได้" },
          {
            target: '[data-coach="demo-price"]',
            title: "ราคาอัปเดตทันที",
            body: "เปลี่ยนจำนวนหรือกล่อง ราคาจะคำนวณใหม่",
          },
          { target: '[data-coach="demo-help"]', title: "เปิดคำแนะนำอีกครั้ง", body: "กดเครื่องหมายคำถามได้ตลอด" },
        ]}
        labels={{ next: "ถัดไป", done: "เข้าใจแล้ว", skip: "ข้าม", progress: (c, t) => `คำแนะนำ ${c} จาก ${t}` }}
      />
    </div>
  );
}

export const CoachMarksFirstRun: Story = { render: () => <CoachDemo /> };

export const Skeletons: Story = {
  render: () => (
    <div className="grid gap-10 md:grid-cols-2">
      <PageSkeleton shape="dashboard" label="กำลังโหลด" />
      <PageSkeleton shape="thread" label="กำลังโหลด" />
      <PageSkeleton shape="grid" label="กำลังโหลด" />
      <PageSkeleton shape="list" label="กำลังโหลด" />
    </div>
  ),
};
