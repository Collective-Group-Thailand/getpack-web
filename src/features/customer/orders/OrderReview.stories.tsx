import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { NextIntlClientProvider } from "next-intl";

import fulfilment from "@/i18n/messages/th/customer/fulfilment.json";
import myOrders from "@/i18n/messages/th/customer/my-orders.json";

import { OrderReview } from "./OrderReview";
import type { Review } from "./review";

const withMessages: Decorator = (Story) => (
  <NextIntlClientProvider locale="th" messages={{ myOrders, fulfilment }} timeZone="Asia/Bangkok">
    <div className="bg-bg max-w-[44rem] p-4 sm:p-6">
      <section className="border-border bg-surface rounded-panel flex flex-col gap-3.5 border p-4 sm:p-5">
        <h2 className="text-[1.0625rem] font-semibold">รีวิวคำสั่งซื้อนี้</h2>
        <Story />
      </section>
    </div>
  </NextIntlClientProvider>
);

const ORDER = "0192f3a0-7c1e-7d2a-9b1f-0000000b0011";
const review: Review = {
  id: "0192f3a0-7c1e-7d2a-9b1f-0000000b0010",
  orderId: ORDER,
  orderCode: "OR-2610-0042",
  productTypeCode: "corrugated",
  rating: 4,
  comment: "กล่องแข็งแรง สีโลโก้ตรงกับไฟล์ ส่งตรงวันที่นัด",
  status: "pending",
  reply: null,
  rewardPoints: 10,
  createdAt: "2026-11-04T10:00:00+07:00",
  photos: [],
  photoRewardPoints: 0,
};
// Neutral placeholder pictures (no customer artwork in the repo).
const swatch = (fill: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="${fill}"/><path d="M18 30l22-10 22 10v24L40 64 18 54z" fill="none" stroke="#5b6b62" stroke-width="2"/></svg>`)}`;

const meta = {
  title: "Customer/Orders/Review",
  component: OrderReview,
  decorators: [withMessages],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The review of a delivered order (D-135, loyalty P2 D-490): stars, an optional comment and up to four " +
          "photos. Reward figures are the API's `rewardPoints` only; ratings say ดาว, never แต้ม.",
      },
    },
  },
  args: { orderId: ORDER, initial: null },
} satisfies Meta<typeof OrderReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Form: Story = {};

/** Just sent: being checked, the review reward, and the invitation to add photos. */
export const Sent: Story = { args: { initial: review } };

/** Published with photos and getpack's reply; the cap refused the reward (no reward line at 0). */
export const PublishedWithReply: Story = {
  args: {
    initial: {
      ...review,
      rating: 5,
      status: "published",
      rewardPoints: 0,
      reply: { body: "ขอบคุณที่ไว้วางใจ getpack ครับ", repliedAt: "2026-11-05T10:00:00+07:00" },
      photos: [
        { id: "0192f3a0-7c1e-7d2a-9b1f-00000000f101", url: swatch("#e8efe9") },
        { id: "0192f3a0-7c1e-7d2a-9b1f-00000000f102", url: swatch("#f1ede4") },
      ],
    } as Review,
  },
};
