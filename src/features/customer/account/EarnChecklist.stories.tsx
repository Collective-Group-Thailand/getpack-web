import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { NextIntlClientProvider } from "next-intl";

import account from "@/i18n/messages/th/customer/account.json";

import { buildLoyaltyTasks, REVIEW_TASK_STATES } from "../../../../mocks/store/loyalty-fixtures";

import { EarnBanner } from "./EarnBanner";
import { EarnChecklistView } from "./EarnChecklist";

const withMessages: Decorator = (Story) => (
  <NextIntlClientProvider locale="th" messages={{ account }} timeZone="Asia/Bangkok">
    <div className="bg-bg max-w-[60rem] p-4 sm:p-6">
      <Story />
    </div>
  </NextIntlClientProvider>
);

const review = buildLoyaltyTasks(REVIEW_TASK_STATES);
const allDone = buildLoyaltyTasks(
  Object.fromEntries(review.tasks.map((task) => [task.code, { status: "done", doneAt: "2026-11-01T03:00:00.000Z" }])),
);

const meta = {
  title: "Customer/Account/Earn checklist",
  component: EarnChecklistView,
  decorators: [withMessages],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "ทำสิ่งนี้รับแต้ม (loyalty P1): the API's list as it comes — the recommended task in the แนะนำถัดไป block, " +
          "todo and held rows, done rows muted — and the 12-month cap in the footer. Fixtures: mocks/store/loyalty-fixtures.ts.",
      },
    },
  },
  args: { data: review, state: "ready", variant: "full", lineOaId: "@getpack" },
} satisfies Meta<typeof EarnChecklistView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The review case: one held, three done. */
export const Held: Story = {};

/** Nothing earned yet. */
export const Fresh: Story = {
  args: { data: buildLoyaltyTasks({ signup: { status: "done", doneAt: "2026-11-04T02:00:00.000Z" } }) },
};

/** The 12-month activity cap is used up: no next step, the footer says why. */
export const CapReached: Story = { args: { data: buildLoyaltyTasks(REVIEW_TASK_STATES, { activityEarned12m: 600 }) } };

/** Every task done: one line. */
export const AllDone: Story = { args: { data: allDone } };

export const Loading: Story = { args: { data: undefined, state: "loading" } };

export const Failed: Story = { args: { data: undefined, state: "error", onRetry: () => undefined } };

/** `/liff/points`: five rows and a link to the rest. */
export const Compact: Story = {
  args: { variant: "compact" },
  decorators: [
    (Story) => (
      <div className="max-w-[24.375rem]">
        <Story />
      </div>
    ),
  ],
};

/** `/account`: the one-line banner (hidden when nothing is left to earn). */
export const AccountBanner: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <EarnBanner tasks={review} />
      <EarnBanner tasks={allDone} />
    </div>
  ),
};
