import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { NextIntlClientProvider } from "next-intl";

import account from "@/i18n/messages/th/customer/account.json";
import checkout from "@/i18n/messages/th/customer/checkout.json";

import { DataRefreshBanner } from "./DataRefreshBanner";
import { PointsBreakdown } from "./PointsBreakdown";
import { ReorderBonusBadge } from "./ReorderBonusBadge";
import { WinbackBanner } from "./WinbackBanner";

const withMessages: Decorator = (Story) => (
  <NextIntlClientProvider locale="th" messages={{ account, checkout }} timeZone="Asia/Bangkok">
    <div className="bg-bg flex max-w-[48rem] flex-col gap-4 p-4 sm:p-6">
      <Story />
    </div>
  </NextIntlClientProvider>
);

const meta = {
  title: "Customer/Loyalty/Lifecycle",
  component: ReorderBonusBadge,
  decorators: [withMessages],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Reorder bonus, win-back and checkout points (loyalty P2, prototype p2-lifecycle.html). Static dates only " +
          "(D-481); the win-back words never mention absence.",
      },
    },
  },
  args: { multiplier: "1.50", endsAt: "2026-11-12T09:40:00+07:00" },
} satisfies Meta<typeof ReorderBonusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReorderBonus: Story = {};
export const ReorderBonusLine: Story = { args: { size: "sm" } };
export const Winback: Story = {
  render: () => <WinbackBanner lots={[{ points: 40, reason: "winback", expiresAt: "2026-12-04T23:59:59+07:00" }]} />,
};
export const WinbackLiff: Story = {
  render: () => (
    <div className="max-w-[23.4375rem]">
      <WinbackBanner
        variant="liff"
        lots={[{ points: 40, reason: "winback", expiresAt: "2026-12-04T23:59:59+07:00" }]}
      />
    </div>
  ),
};
export const CheckoutPoints: Story = {
  render: () => (
    <PointsBreakdown
      toEarn={22}
      p2={{
        multipliers: {
          tier: "1.25",
          paymentMethod: "1.00",
          reorderCampaign: "1.50",
          promotion: "1.00",
          campaign: "1.00",
          anniversary: "1.00",
          earlyPay: "1.00",
          combined: "1.88",
          capped: false,
        },
        paymentBonus: { multiplier: "1.20", methods: ["scb_qr", "scb_qr_cross_bank", "bank_transfer_slip"] },
        toEarnWithPaymentBonus: 27,
      }}
    />
  ),
};

/** The yearly data confirmation on /account, once it is due again (the first one is a checklist task). */
export const DataRefreshDue: Story = {
  render: () => (
    <DataRefreshBanner
      refresh={{
        due: true,
        lastConfirmedAt: "2025-11-02T10:00:00+07:00",
        nextDueAt: null,
        rewardPoints: 12,
        company: null,
        taxProfiles: [],
        addresses: [],
      }}
    />
  ),
};
