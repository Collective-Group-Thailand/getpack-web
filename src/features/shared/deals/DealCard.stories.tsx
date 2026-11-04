import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { NextIntlClientProvider } from "next-intl";

import deals from "@/i18n/messages/th/customer/deals.json";

import { DealCard } from "./DealCard";
import { fixtureDeal } from "../../../../mocks/store/deals-fixtures";

const withMessages: Decorator = (Story) => (
  <NextIntlClientProvider locale="th" messages={{ deals }} timeZone="Asia/Bangkok">
    <div className="bg-bg max-w-[23rem] p-4">
      <Story />
    </div>
  </NextIntlClientProvider>
);

const NOW = Date.parse("2026-11-04T10:30:00+07:00");

const meta = {
  title: "Customer/Deals/DealCard",
  component: DealCard,
  decorators: [withMessages],
  parameters: {
    docs: {
      description: {
        component:
          "A deal as a coupon ticket (loyalty P1.5, prototype p15-deal-card.html): the six states of the grid ticket, " +
          "the compact row, and the featured ticket. Fixtures: mocks/store/deals-fixtures.ts.",
      },
    },
  },
  args: {
    deal: fixtureDeal("box10-corrugated"),
    signedIn: true,
    now: NOW,
    typeName: "กล่องลูกฟูก",
    onSave: () => undefined,
  },
} satisfies Meta<typeof DealCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 01 · not signed in: copy the code, or sign in to keep it. */
export const Guest: Story = { args: { deal: fixtureDeal("box10-corrugated", null, false), signedIn: false } };

/** 02 · signed in, not kept yet: the outline "เก็บโค้ด". */
export const Claimable: Story = { args: { deal: fixtureDeal("free-shipping-5000"), typeName: null } };

/** 03 · kept: "เก็บแล้ว" and the way to the wallet. */
export const Saved: Story = { args: { deal: fixtureDeal("box10-corrugated", "saved") } };

/** 04 · used: the stub turns neutral and every word subtle. */
export const Used: Story = { args: { deal: fixtureDeal("matte-free-2000", "used"), typeName: "กล่องกระดาษแข็ง" } };

/** 05 · not eligible: the reason as text, no action. */
export const NotEligible: Story = { args: { deal: fixtureDeal("welcome-300", "not_eligible"), typeName: null } };

/** 06 · ending soon: "เหลือ n วัน" in warning — a static label, never a countdown. */
export const EndingSoon: Story = { args: { deal: fixtureDeal("label8-5000"), typeName: "สติกเกอร์ฉลาก" } };

/** No code: the discount is taken off in the cart; nothing to keep. */
export const Automatic: Story = { args: { deal: fixtureDeal("rigid-box-5", null), typeName: "กล่องกระดาษแข็ง" } };

export const Compact: Story = {
  args: { variant: "compact", href: "/deals/box10-corrugated" },
  decorators: [
    (Story) => (
      <div className="border-border bg-surface rounded-card overflow-hidden border">
        <Story />
      </div>
    ),
  ],
};

export const CompactRows: Story = {
  name: "Compact rows (one container)",
  render: (args) => (
    <ul className="border-border bg-surface rounded-card divide-border m-0 list-none divide-y overflow-hidden border p-0">
      {(
        [
          ["box10-corrugated", "claimable"],
          ["label8-5000", "claimable"],
          ["reorder-points-x2", "saved"],
          ["rigid-box-5", null],
          ["matte-free-2000", "used"],
        ] as const
      ).map(([slug, status]) => (
        <li key={slug}>
          <DealCard {...args} variant="compact" deal={fixtureDeal(slug, status)} href={`/deals/${slug}`} />
        </li>
      ))}
    </ul>
  ),
};

export const Featured: Story = {
  args: { variant: "featured", showBadge: true, href: "/deals/box10-corrugated", headingLevel: "h2" },
  decorators: [
    (Story) => (
      <div className="w-[60rem]">
        <Story />
      </div>
    ),
  ],
};

export const PhoneHero: Story = { args: { variant: "hero", showBadge: true, headingLevel: "h2" } };
