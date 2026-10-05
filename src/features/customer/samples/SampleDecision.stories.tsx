import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { NextIntlClientProvider } from "next-intl";

import common from "@/i18n/messages/th/common/common.json";
import myOrders from "@/i18n/messages/th/customer/my-orders.json";

import { SampleDecision } from "./SampleDecision";

const withMessages: Decorator = (Story) => (
  <NextIntlClientProvider locale="th" messages={{ common, myOrders }} timeZone="Asia/Bangkok">
    <div className="bg-surface max-w-xl p-4">
      <Story />
    </div>
  </NextIntlClientProvider>
);

const meta = {
  title: "Customer/Samples",
  component: SampleDecision,
  decorators: [withMessages],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Deciding on a delivered sample (U2.F3): the checklist that gates approval, the note that " +
          "asking for changes or rejecting needs — the visual baseline of the approval screen.",
      },
    },
  },
  args: { busy: null, onDecide: () => undefined },
} satisfies Meta<typeof SampleDecision>;

export default meta;
type Story = StoryObj<typeof meta>;

/** As the customer first sees it: nothing ticked, approve disabled. */
export const Decision: Story = {};
