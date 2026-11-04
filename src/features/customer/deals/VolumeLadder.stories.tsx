import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";

import deals from "@/i18n/messages/th/customer/deals.json";

import { VolumeLadder, type LadderRow } from "./VolumeLadder";

const withMessages: Decorator = (Story) => (
  <NextIntlClientProvider locale="th" messages={{ deals }} timeZone="Asia/Bangkok">
    <div className="bg-surface max-w-[28rem] p-5">
      <Story />
    </div>
  </NextIntlClientProvider>
);

/** The calculation's own tiers (fake figures, the shape the configurator returns). */
const ROWS: LadderRow[] = [
  { quantity: 300, unitPrice: "16.20", savingPct: null },
  { quantity: 500, unitPrice: "14.79", savingPct: 9 },
  { quantity: 1000, unitPrice: "13.31", savingPct: 18 },
  { quantity: 2000, unitPrice: "12.13", savingPct: 25 },
  { quantity: 5000, unitPrice: null, savingPct: null, quoteOnly: true },
];

const meta = {
  title: "Customer/Deals/VolumeLadder",
  component: VolumeLadder,
  decorators: [withMessages],
  parameters: {
    docs: {
      description: {
        component:
          "สั่งมากขึ้น ราคาต่อใบลดลง (loyalty P1.5, STITCH-NOTES §c): a table from 768 px whose rows set the quantity, " +
          "scrolling tiles with a กำหนดเอง tile below. Resize the viewport to see both.",
      },
    },
  },
  args: { rows: ROWS, selected: 500, unit: "ใบ", onSelect: () => undefined, customHref: "/configure/rsc-carton" },
  render: function Render(args) {
    const [selected, setSelected] = useState(args.selected);
    return <VolumeLadder {...args} selected={selected} onSelect={setSelected} />;
  },
} satisfies Meta<typeof VolumeLadder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {};

export const Phone: Story = { parameters: { viewport: { defaultViewport: "mobile1" } } };

export const Loading: Story = {
  args: { rows: ROWS.map((row) => ({ ...row, unitPrice: null, quoteOnly: false })), pending: true },
};
