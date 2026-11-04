import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";

import companies from "@/i18n/messages/th/admin/companies.json";
import console_ from "@/i18n/messages/th/admin/console.json";
import finance from "@/i18n/messages/th/admin/finance.json";
import marketing from "@/i18n/messages/th/admin/marketing.json";
import common from "@/i18n/messages/th/common/common.json";
import type { RewardCatalogItem } from "@/features/shared/loyalty-p3/types";
import type { Schemas } from "@/lib/api/types";

import { CreditUpliftPanel } from "../companies/CreditUplift";
import { LoyaltyCampaignForm } from "./LoyaltyCampaigns";
import { RewardItemForm } from "./RewardItemForm";

const client = new QueryClient();
const withMessages: Decorator = (Story) => (
  <QueryClientProvider client={client}>
    <NextIntlClientProvider
      locale="th"
      messages={{ marketing, finance, companies, common, console: console_ } as never}
      timeZone="Asia/Bangkok"
    >
      <div className="bg-bg max-w-[72rem] p-4 sm:p-6">
        <Story />
      </div>
    </NextIntlClientProvider>
  </QueryClientProvider>
);

const TYPES = [
  { value: "corrugated_rsc", label: "กล่องลูกฟูก" },
  { value: "folding_carton", label: "กล่องพับ" },
  { value: "rigid_box", label: "กล่องแข็ง" },
  { value: "label", label: "ฉลาก" },
];

const ITEM: RewardCatalogItem = {
  id: "0192f3a0-7c1e-7d2a-9b1f-0000000e0007",
  code: "print_upgrade",
  kind: "free_addon",
  name: { th: "อัปเกรดเคลือบ Spot UV", en: "Spot UV upgrade" },
  description: { th: "ใช้กับกล่องพิมพ์ที่เลือก Spot UV", en: "For printed boxes with Spot UV selected" },
  costPoints: 100,
  value: { type: "free_addon", addonCode: "spot_uv", maxAmount: "1500.00" },
  valueTextTh: "อัปเกรดงานพิมพ์ฟรี: Spot UV",
  constraints: { minOrderValue: null, productTypeCodes: ["folding_carton"], perUserEveryMonths: null },
  tierRequired: null,
  validityDays: 90,
  activeFrom: "2026-12-01T00:00:00+07:00",
  activeTo: null,
  sortOrder: 70,
  status: "active",
  promotionId: "0192f3a0-7c1e-7d2a-9b1f-0000000f0207",
  redemptions30d: 4,
  updatedAt: "2026-10-25T10:00:00+07:00",
};

const CREDIT = (mode: "auto" | "frozen") =>
  ({
    limitAmount: "1000000.00",
    pendingRequest: null,
    versions: [],
    uplift: {
      mode,
      modeReason: mode === "frozen" ? "รอตรวจงบการเงินปี 2569 ก่อนปรับวงเงิน" : null,
      baseLimit: "600000.00",
      companyTier: "platinum",
      companySpend12m: "612400.00",
      target: "1200000.00",
      capped: true,
      aboveCapTarget: "1200000.00",
    },
  }) as unknown as Schemas["AdminCompanyCreditDto"];

const meta = {
  title: "Admin/Marketing/Loyalty P3",
  component: RewardItemForm,
  decorators: [withMessages],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Loyalty P3 back office: the reward catalogue editor (kind-specific fields, the ticket preview in the aside), " +
          "the admin points campaign form (the promotion editor's audience picker, Platinum included) and the credit " +
          "uplift panel of a company's credit tab (figures are the API's; the mode asks for a reason).",
      },
    },
  },
  args: { item: null, editable: true, productTypes: TYPES, onSaved: () => undefined },
} satisfies Meta<typeof RewardItemForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewReward: Story = {};
export const ActiveReward: Story = { args: { item: ITEM } };
export const CampaignForm: Story = {
  render: () => (
    <div className="max-w-[36rem]">
      <LoyaltyCampaignForm campaign={null} productTypes={TYPES} onCancel={() => undefined} onSaved={() => undefined} />
    </div>
  ),
};
export const CreditUpliftCapped: Story = {
  render: () => (
    <CreditUpliftPanel
      companyId="c1"
      credit={CREDIT("auto")}
      canManage
      onRequestFull={() => undefined}
      onChanged={() => undefined}
    />
  ),
};
export const CreditUpliftFrozen: Story = {
  render: () => (
    <CreditUpliftPanel
      companyId="c1"
      credit={CREDIT("frozen")}
      canManage
      onRequestFull={() => undefined}
      onChanged={() => undefined}
    />
  ),
};
