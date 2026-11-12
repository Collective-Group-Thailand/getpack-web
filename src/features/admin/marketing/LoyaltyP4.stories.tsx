import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";

import approvals from "@/i18n/messages/th/admin/approvals.json";
import console_ from "@/i18n/messages/th/admin/console.json";
import marketing from "@/i18n/messages/th/admin/marketing.json";
import common from "@/i18n/messages/th/common/common.json";
import type { LoyaltyRollout, ProgrammeBudget } from "@/features/shared/loyalty-p4/types";

import { FundingSplitBlock } from "./Cofunding";
import { FundingSplitTable } from "./FundingSplit";
import { CohortResult, GateCard, RolloutStageCard } from "./LoyaltyRollout";
import { BudgetBannerView, BudgetUse } from "./ProgrammeBudget";

const client = new QueryClient();
const withMessages: Decorator = (Story) => (
  <QueryClientProvider client={client}>
    <NextIntlClientProvider
      locale="th"
      messages={{ marketing, approvals, common, console: console_ } as never}
      timeZone="Asia/Bangkok"
    >
      <div className="bg-bg max-w-[72rem] p-4 sm:p-6">
        <Story />
      </div>
    </NextIntlClientProvider>
  </QueryClientProvider>
);

const ID = "0192f3a0-7c1e-7d2a-9b1f-0000000f7001";
const BUDGET: ProgrammeBudget = {
  month: "2026-11",
  budget: { monthlyBaht: "200000.00", override: "250000.00", effective: "250000.00", settingVersionId: ID },
  spent: {
    points: "121400.00",
    discounts: "78250.00",
    tierPerks: "16900.00",
    factoryShare: "6550.00",
    total: "210000.00",
  },
  usedPct: "84.00",
  state: "warning",
  alertPcts: [80, 100],
  alerts: [{ thresholdPct: 80, firedAt: "2026-11-21T10:15:00+07:00", budget: "250000.00", spent: "200410.00" }],
  pendingOverride: null,
  asOf: "2026-11-22T09:15:00+07:00",
  currency: "THB",
};
const EXHAUSTED: ProgrammeBudget = {
  ...BUDGET,
  budget: { ...BUDGET.budget, override: null, effective: "200000.00" },
  spent: { ...BUDGET.spent, points: "115700.00", total: "204300.00" },
  usedPct: "102.15",
  state: "exhausted",
};
const ROLLOUT: LoyaltyRollout = {
  current: {
    stage: "percent",
    percent: 10,
    allowlistCompanyIds: [ID],
    allowlistUserIds: [],
    settingVersionId: ID,
    effectiveFrom: "2026-11-20T09:00:00+07:00",
  },
  cohort: { companies: 41, companiesTotal: 402, usersWithoutCompany: 318, usersWithoutCompanyTotal: 3120 },
  gates: [
    { metric: "redemption_rate", value: "18.40", target: "15.00", direction: "min", status: "pass", window: "3m" },
    {
      metric: "points_liability",
      value: "412800.00",
      target: "500000.00",
      direction: "max",
      status: "pass",
      window: "now",
    },
    {
      metric: "margin_after_promotions",
      value: "17.10",
      target: "18.00",
      direction: "min",
      status: "attention",
      window: "3m",
    },
    { metric: "budget_use", value: null, target: "100.00", direction: "max", status: "unknown", window: "month" },
  ],
  pendingAdvance: null,
  history: [
    {
      settingVersionId: ID,
      stage: "percent",
      percent: 10,
      kind: "advance",
      reason: "ผ่านเกณฑ์ UAT สองสัปดาห์",
      by: { id: ID, displayName: "มาลี ส." },
      approvedBy: { id: ID, displayName: "สมชาย ก." },
      effectiveFrom: "2026-11-20T09:00:00+07:00",
    },
  ],
};

const meta = {
  title: "Admin/Marketing/Loyalty P4",
  decorators: [withMessages],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Loyalty P4 (prototypes p4-admin-budget.html, p4-admin-rollout.html): the programme budget and its shell banner, " +
          "the rollout stage and gates, the funding split of a capacity deal and in analytics. Figures are API-CHANGES-P4's samples.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const BudgetAt84: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <BudgetBannerView data={BUDGET} onDismiss={() => undefined} />
      <BudgetUse data={BUDGET} />
    </div>
  ),
};

export const BudgetExhausted: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <BudgetBannerView data={EXHAUSTED} onDismiss={() => undefined} />
      <BudgetUse data={EXHAUSTED} />
    </div>
  ),
};

export const RolloutStageAndGates: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <RolloutStageCard data={ROLLOUT} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ROLLOUT.gates.map((gate) => (
          <GateCard key={gate.metric} gate={gate} />
        ))}
      </div>
      <div className="max-w-md">
        <CohortResult
          name="บริษัท กล่องดี จำกัด"
          data={{ key: "company", keyId: ID, bucket: 37, inCohort: false, reason: "bucket_above_percent" }}
        />
      </div>
    </div>
  ),
};

export const ApprovalFundingSplit: Story = {
  render: () => (
    <div className="border-border bg-surface rounded-panel max-w-xl border p-6">
      <FundingSplitBlock
        funding={{
          defaultFunder: "getpack",
          offers: [
            {
              offerId: ID,
              factoryName: "โรงงาน ตัวอย่าง B",
              status: "accepted",
              termsText: "40 % ของส่วนลดดีล สูงสุด ฿2,000",
              capAmount: "2000.00",
              accruedAmount: "840.00",
            },
            {
              offerId: `${ID.slice(0, -1)}2`,
              factoryName: "โรงงานกล่องไทย",
              status: "proposed",
              termsText: "40 % ของส่วนลดดีล สูงสุด ฿20,000",
              capAmount: "20000.00",
              accruedAmount: "0.00",
            },
          ],
          acceptedCount: 1,
          factoryShareSoFar: "840.00",
        }}
      />
    </div>
  ),
};

export const AnalyticsFundingSplit: Story = {
  render: () => (
    <FundingSplitTable
      data={{
        data: [
          {
            promotionId: ID,
            name: "สั่งกล่องลูกฟูกสัปดาห์นี้ ลด 5%",
            productTypeName: "กล่องลูกฟูก",
            weekStart: "2026-11-09",
            orders: 31,
            discountTotal: "38750.00",
            factoryShare: "4320.00",
            getpackShare: "34430.00",
            reversed: "960.00",
            factoryCount: 1,
            offersAccepted: 1,
          },
        ],
        meta: {
          page: 1,
          perPage: 50,
          total: 1,
          totals: { discountTotal: "38750.00", factoryShare: "4320.00", getpackShare: "34430.00" },
        },
        asOf: "2026-11-22T09:15:00+07:00",
        currency: "THB",
      }}
    />
  ),
};
