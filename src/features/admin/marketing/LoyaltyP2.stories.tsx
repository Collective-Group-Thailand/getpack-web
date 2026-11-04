import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";

import marketing from "@/i18n/messages/th/admin/marketing.json";
import common from "@/i18n/messages/th/common/common.json";

import { audienceDraftOf } from "./audience";
import { MovementChart } from "./MovementChart";
import { SegmentPicker } from "./SegmentPicker";

const withMessages: Decorator = (Story) => (
  <NextIntlClientProvider locale="th" messages={{ marketing, common } as never} timeZone="Asia/Bangkok">
    <div className="bg-bg max-w-[60rem] p-4 sm:p-6">
      <Story />
    </div>
  </NextIntlClientProvider>
);

const MONTHS = [
  ["พ.ค.", 9600, 4100, 900],
  ["มิ.ย.", 11020, 4600, 980],
  ["ก.ค.", 11640, 5000, 1010],
  ["ส.ค.", 12120, 4800, 1060],
  ["ก.ย.", 12920, 5100, 1090],
  ["ต.ค.", 12940, 5200, 1120],
] as const;

const meta = {
  title: "Admin/Marketing/Loyalty P2",
  component: MovementChart,
  decorators: [withMessages],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Loyalty P2 admin pieces (prototypes p2-loyalty-analytics.html, p2-promotion-audience.html): the monthly " +
          "movement chart in the admin chart style (one green series, greys below the line) and the segment picker.",
      },
    },
  },
  args: {
    label: "ความเคลื่อนไหวรายเดือน",
    legend: { earned: "ได้รับ", redeemed: "ใช้", expired: "หมดอายุ" },
    formatValue: (value: number) => value.toLocaleString("th-TH"),
    bars: MONTHS.map(([label, earned, redeemed, expired]) => ({
      key: label,
      label,
      title: `${label} · ได้รับ ${earned} · ใช้ ${redeemed} · หมดอายุ ${expired}`,
      earned,
      redeemed,
      expired,
    })),
  },
} satisfies Meta<typeof MovementChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Movement: Story = {};

function Picker() {
  const [draft, setDraft] = useState(() =>
    audienceDraftOf({ tiers: ["silver", "gold"], orderedProductTypeCodes: ["corrugated"] }),
  );
  return (
    <SegmentPicker
      draft={draft}
      onChange={setDraft}
      productTypes={[
        { value: "corrugated", label: "กล่องลูกฟูก" },
        { value: "folding_carton", label: "กล่องกระดาษแข็ง" },
        { value: "label_sticker", label: "สติกเกอร์ฉลาก" },
      ]}
    />
  );
}

export const Audience: Story = { render: () => <Picker /> };
