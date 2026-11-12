import type { Meta, StoryObj } from "@storybook/react-vite";

import { OfferTicket } from "./OfferTicket";

const meta = {
  title: "Partner/Co-funding/Offer ticket",
  component: OfferTicket,
  decorators: [
    (Story) => (
      <div className="bg-bg grid max-w-3xl gap-3 p-4 md:grid-cols-2">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Loyalty P4 (prototype p4-partner-cofunding.html): a co-funding offer as a horizontal ticket in system green — " +
          "the factory's share on the stub, the one amber badge only while it waits for an answer, a static respond-by date.",
      },
    },
  },
  args: {
    href: "/cofunding/o-1",
    share: "40%",
    shareUnit: "ของส่วนลดดีล",
    title: "กล่องลูกฟูก · 9 พ.ย. – 15 พ.ย.",
    meta: "ดีลลด 5% · สูงสุด ฿20,000",
    status: { label: "รอตอบรับ", tone: "accent" },
    waiting: "ตอบภายใน 7 พ.ย. 2569 23:59",
    linkLabel: "ดูข้อเสนอ",
  },
} satisfies Meta<typeof OfferTicket>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AwaitingAnswer: Story = {};
export const Accepted: Story = {
  args: {
    share: "฿150",
    shareUnit: "ต่อออเดอร์",
    title: "กล่องฝาพับ · 2 พ.ย. – 8 พ.ย.",
    meta: "ดีลลด 8% · สูงสุด ฿12,000",
    status: { label: "ตอบรับแล้ว", tone: "success" },
    waiting: undefined,
    use: { text: "฿4,320 จาก ฿12,000 · 9 ออเดอร์", pct: 36 },
  },
};
export const Declined: Story = {
  args: { share: "30%", status: { label: "ปฏิเสธแล้ว", tone: "neutral" }, waiting: undefined, closed: true },
};
