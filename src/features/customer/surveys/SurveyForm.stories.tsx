import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { NextIntlClientProvider } from "next-intl";

import account from "@/i18n/messages/th/customer/account.json";

import { SURVEY_FIXTURE } from "./fixtures";
import { SurveyCard } from "./SurveyCard";
import { SurveyClosed, SurveyForm } from "./SurveyForm";

const withMessages: Decorator = (Story) => (
  <NextIntlClientProvider locale="th" messages={{ account }} timeZone="Asia/Bangkok">
    <div className="bg-bg max-w-[40rem] p-4 sm:p-6">
      <Story />
    </div>
  </NextIntlClientProvider>
);

const meta = {
  title: "Customer/Account/Survey",
  component: SurveyForm,
  decorators: [withMessages],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "In-app survey (loyalty P2, D-491; prototype p2-survey.html): every question from 768 px, one per step below " +
          "(resize the canvas). Ratings are a radiogroup of squares, not stars. The reward line is the API's figure.",
      },
    },
  },
  args: { survey: SURVEY_FIXTURE },
} satisfies Meta<typeof SurveyForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Form: Story = {};
export const NoReward: Story = { args: { survey: { ...SURVEY_FIXTURE, rewardPoints: 0 } } };
export const Closed: Story = { render: () => <SurveyClosed /> };
export const CardOnAccount: Story = { render: () => <SurveyCard survey={SURVEY_FIXTURE} /> };
export const CardOnOrder: Story = { render: () => <SurveyCard survey={SURVEY_FIXTURE} variant="order" /> };
export const CardOnLiff: Story = {
  render: () => (
    <div className="max-w-[23.4375rem]">
      <SurveyCard survey={SURVEY_FIXTURE} variant="liff" />
    </div>
  ),
};
