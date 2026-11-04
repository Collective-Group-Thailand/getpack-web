import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { NextIntlClientProvider } from "next-intl";

import account from "@/i18n/messages/th/customer/account.json";
import deals from "@/i18n/messages/th/customer/deals.json";

import {
  BLOCKED_REWARDS,
  GOLD,
  GOLD_POINTS,
  PLATINUM,
  SAMPLE_LIST,
  SAMPLE_PREVIEW,
  SAMPLE_NOW,
  SAMPLE_POINTS,
  SAMPLE_REDEMPTIONS,
  SAMPLE_REWARDS,
} from "./fixtures";
import { MyRewardCoupons } from "./MyRewardCoupons";
import { RedeemSheet } from "./RedeemSheet";
import { RewardCard } from "./RewardCard";
import { RewardsTab } from "./RewardsTab";
import { TierPerks } from "./TierPerks";

const withMessages: Decorator = (Story) => (
  <NextIntlClientProvider locale="th" messages={{ account, deals }} timeZone="Asia/Bangkok">
    <div className="bg-bg flex max-w-[60rem] flex-col gap-4 p-4 sm:p-6">
      <Story />
    </div>
  </NextIntlClientProvider>
);

const meta = {
  title: "Customer/Loyalty/Rewards",
  component: RewardCard,
  decorators: [withMessages],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The reward catalogue (loyalty P3, prototypes p3-redeem.html, p3-deals-points.html, p3-tier-perks.html): the " +
          "stub is the points cost, the body the reward; a blocked reward shows its reason instead of the action.",
      },
    },
  },
  args: { item: SAMPLE_REWARDS[2]!, onRedeem: () => undefined },
} satisfies Meta<typeof RewardCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Card: Story = { render: (args) => <div className="max-w-[18rem]">{<RewardCard {...args} />}</div> };

export const Grid: Story = {
  render: () => (
    <ul className="m-0 grid list-none grid-cols-3 gap-4 p-0">
      {[...SAMPLE_REWARDS, ...BLOCKED_REWARDS].map((item) => (
        <li key={item.id} className="flex">
          <RewardCard item={item} onRedeem={() => undefined} />
        </li>
      ))}
    </ul>
  ),
};

export const Rows: Story = {
  render: () => (
    <ul className="border-border bg-surface rounded-card divide-border m-0 max-w-[24rem] list-none divide-y border p-0">
      {[...SAMPLE_REWARDS, BLOCKED_REWARDS[0]!].map((item) => (
        <li key={item.id}>
          <RewardCard item={item} variant="row" onRedeem={() => undefined} />
        </li>
      ))}
    </ul>
  ),
};

export const ConfirmSheet: Story = {
  render: () => (
    <RedeemSheet
      item={SAMPLE_REWARDS[2]!}
      onOpenChange={() => undefined}
      onRedeemed={() => undefined}
      initialPreview={SAMPLE_PREVIEW}
    />
  ),
};

export const SuccessSheet: Story = {
  render: () => (
    <RedeemSheet
      item={SAMPLE_REWARDS[2]!}
      onOpenChange={() => undefined}
      onRedeemed={() => undefined}
      initialResult={{ ...SAMPLE_REDEMPTIONS[0]!, balanceAfter: 1190 }}
    />
  ),
};

export const MyCoupons: Story = {
  render: () => <MyRewardCoupons redemptions={SAMPLE_REDEMPTIONS} now={SAMPLE_NOW} />,
};

export const TierPerksPlatinum: Story = {
  render: () => <TierPerks points={SAMPLE_POINTS} loyalty={PLATINUM} />,
};

export const TierPerksGold: Story = {
  render: () => <TierPerks points={GOLD_POINTS} loyalty={GOLD} />,
};

export const DealsPointsTab: Story = {
  render: () => <RewardsTab list={SAMPLE_LIST} signedIn />,
};

export const DealsPointsTabGuest: Story = {
  render: () => <RewardsTab list={{ ...SAMPLE_LIST, balance: null }} signedIn={false} />,
};
