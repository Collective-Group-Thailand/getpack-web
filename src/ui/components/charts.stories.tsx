import type { Meta, StoryObj } from "@storybook/react-vite";

import { Chart } from "./Chart";
import { Meter } from "./Meter";

const meta = {
  title: "Data display/Charts",
  parameters: {
    docs: {
      description: {
        component:
          "Bar and line charts on Recharts, coloured from the semantic tones, with the same figures " +
          "as a table (shown on request, always read by screen readers); and a meter with a " +
          "threshold marker (a campaign budget against its alert). The data is obviously fake.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const labels = { showTable: "Show as table", hideTable: "Show as chart" };
const funnel = [
  { step: "Visit", count: 10892 },
  { step: "Configure", count: 4575 },
  { step: "Quote", count: 1556 },
  { step: "Cart", count: 482 },
  { step: "Checkout", count: 342 },
  { step: "Paid", count: 251 },
];
const trend = Array.from({ length: 14 }, (_, i) => ({
  day: `Day ${i + 1}`,
  quotes: 40 + Math.round(18 * Math.sin(i / 2)),
  paid: 8 + Math.round(3 * Math.sin(i / 2.5)),
}));

export const Bars: Story = {
  render: () => (
    <div className="w-[36rem]">
      <Chart
        kind="bar"
        title="Funnel"
        data={funnel}
        index="step"
        indexLabel="Step"
        series={[{ key: "count", label: "Sessions" }]}
        formatValue={(value) => value.toLocaleString("en-US")}
        labels={labels}
      />
    </div>
  ),
};

export const HorizontalGrouped: Story = {
  render: () => (
    <div className="w-[36rem]">
      <Chart
        kind="bar"
        layout="vertical"
        title="Demand by province"
        data={[
          { province: "Bangkok", quotes: 330, paid: 48 },
          { province: "Nonthaburi", quotes: 102, paid: 14 },
          { province: "Chonburi", quotes: 79, paid: 10 },
        ]}
        index="province"
        indexLabel="Province"
        series={[
          { key: "quotes", label: "Quotes", tone: "info" },
          { key: "paid", label: "Paid orders", tone: "primary" },
        ]}
        height={220}
        labels={labels}
      />
    </div>
  ),
};

export const Lines: Story = {
  render: () => (
    <div className="w-[36rem]">
      <Chart
        kind="line"
        title="Daily trend"
        data={trend}
        index="day"
        indexLabel="Day"
        series={[
          { key: "quotes", label: "Quotes", tone: "info" },
          { key: "paid", label: "Paid orders", tone: "primary" },
        ]}
        labels={labels}
      />
    </div>
  ),
};

export const MeterWithThreshold: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-4">
      <Meter label="Under the alert" value={26} marker={80} valueText="฿21,450 of ฿80,000; alert at 80%" />
      <Meter
        label="Past the alert"
        value={84}
        marker={80}
        tone="warning"
        valueText="฿126,300 of ฿150,000; alert at 80%"
      />
      <Meter label="Exhausted" value={100} marker={80} tone="danger" valueText="฿50,000 of ฿50,000; alert at 80%" />
    </div>
  ),
};
