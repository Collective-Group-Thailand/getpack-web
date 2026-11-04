import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";

import deals from "@/i18n/messages/th/customer/deals.json";
import type { ApplicableCodes } from "@/features/shared/deals/types";

import { fixtureDeal } from "../../../../mocks/store/deals-fixtures";

import { CouponPicker } from "./CouponPicker";

const withMessages: Decorator = (Story) => (
  <NextIntlClientProvider locale="th" messages={{ deals }} timeZone="Asia/Bangkok">
    <div className="bg-surface border-border rounded-card max-w-[25rem] border p-5">
      <Story />
    </div>
  </NextIntlClientProvider>
);

const box10 = fixtureDeal("box10-corrugated");
const freeship = fixtureDeal("free-shipping-5000");
const label8 = fixtureDeal("label8-5000");

/** The mock's answer for a cart of corrugated boxes and labels (fake savings). */
const DATA: ApplicableCodes = {
  applicable: [
    {
      code: "FREESHIP",
      promotionId: freeship.id,
      headline: freeship.headline,
      benefitSummary: "ส่งฟรีทั่วประเทศ",
      saving: "250.00",
      stackGroup: "shipping",
      conflictsWith: [],
      best: false,
      stacking: "stackable",
      onCart: false,
    },
    {
      code: "LABEL8",
      promotionId: label8.id,
      headline: label8.headline,
      benefitSummary: "ลด 8% สติกเกอร์ฉลาก",
      saving: "340.00",
      stackGroup: "product",
      conflictsWith: ["BOX10"],
      best: false,
      stacking: "stackable",
      onCart: false,
    },
    {
      code: "BOX10",
      promotionId: box10.id,
      headline: box10.headline,
      benefitSummary: "ลด 10% กล่องลูกฟูก",
      saving: "1331.00",
      stackGroup: "product",
      conflictsWith: ["LABEL8"],
      best: true,
      stacking: "stackable",
      onCart: false,
    },
  ],
  notYet: [
    {
      code: "MATTEFREE",
      promotionId: "00000000-0000-4000-8000-000000000090",
      headline: "เคลือบด้านฟรี",
      reason: "min_quantity",
      reasonText: "สั่งกล่องเพิ่มอีก 1,000 ใบ",
    },
    {
      code: "WELCOME300",
      promotionId: "00000000-0000-4000-8000-000000000091",
      headline: "คำสั่งซื้อแรก ลด ฿300",
      reason: "first_order_only",
      reasonText: "ใช้ได้เฉพาะคำสั่งซื้อแรก",
    },
  ],
  maxCodes: 3,
};

const benefits = new Map([box10, freeship, label8].map((deal) => [deal.id, deal.benefit] as const));

const meta = {
  title: "Customer/Deals/CouponPicker",
  component: CouponPicker,
  decorators: [withMessages],
  parameters: {
    docs: {
      description: {
        component:
          "คูปองที่ใช้ได้กับตะกร้านี้ (loyalty P1.5, STITCH-NOTES §d): checkboxes up to maxCodes, the best saving first, " +
          "a conflict note, and the codes that are not usable yet with their reason.",
      },
    },
  },
  args: { data: DATA, held: ["BOX10", "FREESHIP"], benefits, onApply: () => undefined, onRemove: () => undefined },
  render: function Render(args) {
    const [held, setHeld] = useState<readonly string[]>(args.held);
    return (
      <CouponPicker
        {...args}
        held={held}
        onApply={(code) => setHeld((current) => [...current, code])}
        onRemove={(code) => setHeld((current) => current.filter((entry) => entry !== code))}
      />
    );
  },
} satisfies Meta<typeof CouponPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoChosen: Story = {};

export const NoneChosen: Story = { args: { held: [] } };

export const Full: Story = {
  name: "Full (max codes held)",
  args: { data: { ...DATA, maxCodes: 2 }, held: ["BOX10", "FREESHIP"] },
};

export const InASheet: Story = { args: { bare: true } };
