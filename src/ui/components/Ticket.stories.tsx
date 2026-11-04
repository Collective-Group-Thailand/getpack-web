import type { Meta, StoryObj } from "@storybook/react-vite";

import { Ticket } from "./Ticket";

const meta = {
  title: "Data/Ticket",
  component: Ticket,
  parameters: {
    docs: {
      description: {
        component:
          "The coupon ticket (loyalty P1.5, D-486): a stub and a body split by a perforation, notches and the stamp edge " +
          "cut with masks so they show whatever is behind — the page, a band, a scrim, the dark theme.",
      },
    },
  },
  args: {
    stub: <div className="p-4 text-[3.25rem] leading-none font-semibold tabular-nums">10%</div>,
    children: <div className="p-4 text-sm">Body</div>,
  },
} satisfies Meta<typeof Ticket>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Vertical: Story = { args: { className: "w-80" } };

export const Horizontal: Story = {
  args: { orientation: "horizontal", stubSize: 160, className: "w-[36rem] h-40" },
};

export const FeaturedStamp: Story = {
  name: "Featured (stamp edge)",
  args: {
    orientation: "horizontal",
    edge: "stamp",
    tone: "featured",
    stubSize: 248,
    className: "w-[48rem] h-56",
    stub: <div className="p-7 text-[5.25rem] leading-none font-bold tracking-tight tabular-nums">10%</div>,
  },
};

export const PhoneHero: Story = {
  args: { edge: "stamp", tone: "featured", stubSize: 150, className: "w-[22rem]" },
};

export const MiniStub: Story = {
  name: "Mini-stub (notch end)",
  args: {
    orientation: "horizontal",
    notch: "end",
    notchRadius: 6,
    shape: "control",
    className: "h-14 w-16",
    stub: <div className="grid h-full place-items-center text-xl font-semibold">10%</div>,
    children: undefined,
  },
};

export const Spent: Story = { args: { tone: "spent", className: "w-80" } };

export const OnABand: Story = {
  name: "On a tinted band (cut-outs show it)",
  args: { className: "w-80" },
  decorators: [
    (Story) => (
      <div className="bg-bg-subtle rounded-panel p-6">
        <Story />
      </div>
    ),
  ],
};
