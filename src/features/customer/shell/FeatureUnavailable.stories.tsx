import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { NextIntlClientProvider } from "next-intl";

import account from "@/i18n/messages/th/customer/account.json";
import storefront from "@/i18n/messages/th/customer/storefront.json";

import { buildLoyaltyTasks, REVIEW_TASK_STATES } from "../../../../mocks/store/loyalty-fixtures";
import { EarnChecklistView } from "../account/EarnChecklist";
import { FeatureUnavailable } from "./FeatureUnavailable";

const withMessages: Decorator = (Story) => (
  <NextIntlClientProvider locale="th" messages={{ storefront, account }} timeZone="Asia/Bangkok">
    <div className="bg-bg max-w-[60rem] p-4 sm:p-6">
      <Story />
    </div>
  </NextIntlClientProvider>
);

const meta = {
  title: "Customer/Loyalty/P4 states",
  component: FeatureUnavailable,
  decorators: [withMessages],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Loyalty P4 (prototype p4-customer-states.html): the calm page of a closed loyalty surface (never says why) " +
          "and the checklist row of a one-off the customer's company already earned.",
      },
    },
  },
  args: { signedIn: true },
} satisfies Meta<typeof FeatureUnavailable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedIn: Story = {};
export const Guest: Story = { args: { signedIn: false } };
export const Liff: Story = {
  args: { liff: true, pointsHref: "/liff/points" },
  decorators: [(Story) => <div className="max-w-sm">{Story()}</div>],
};

const base = buildLoyaltyTasks(REVIEW_TASK_STATES);
const claimed = {
  ...base,
  tasks: [
    ...base.tasks.filter((task) => !["tax_profile", "brand_kit"].includes(task.code)),
    ...base.tasks
      .filter((task) => ["tax_profile", "brand_kit"].includes(task.code))
      .map((task) => ({ ...task, status: "claimed_by_company" as never, recommended: false })),
  ],
};
claimed.tasks.forEach((task, index) => (task.recommended = index === 0 && task.status === "todo"));

export const ChecklistClaimedByCompany: Story = {
  render: () => <EarnChecklistView data={claimed} lineOaId="@getpack" />,
};
