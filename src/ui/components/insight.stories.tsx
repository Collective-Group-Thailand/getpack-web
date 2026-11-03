import type { Meta, StoryObj } from "@storybook/react-vite";

import { BridgeChart } from "./BridgeChart";
import { BarList, ColumnChart } from "./DataBars";
import { FigureTip } from "./FigureTip";
import { TooltipProvider } from "./Tooltip";

const meta = {
  title: "Data display/Insight charts",
  decorators: [(Story) => <TooltipProvider delayDuration={0}>{Story()}</TooltipProvider>],
  parameters: {
    docs: {
      description: {
        component:
          "The sales desk's charts (D-469, D-470): a vertical bridge (waterfall) with a threshold line and a viewer " +
          "watermark, ranked horizontal bars, columns over time, and a figure that explains itself on hover and focus. " +
          "Every number is a string the page formatted; the numbers here are obviously fake.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const labels = { showTable: "Show as table", hideTable: "Show as chart", step: "Line", amount: "Amount", share: "Share" };

export const Bridge: Story = {
  render: () => (
    <div className="w-[44rem]">
      <BridgeChart
        title="From list price to contribution after commission"
        labels={labels}
        watermark="Viewer Example (fake)"
        threshold={{ value: 940, label: "Dashed line = floor, 10% of net revenue" }}
        steps={[
          { key: "list", label: "Revenue at list price", kind: "total", value: 10000, display: "฿10,000.00" },
          { key: "discount", label: "Discount", kind: "delta", value: -600, display: "− ฿600.00", share: "6%" },
          { key: "net", label: "Net revenue", kind: "total", value: 9400, display: "฿9,400.00" },
          { key: "cost", label: "Factory cost", kind: "delta", value: -7400, display: "− ฿7,400.00" },
          { key: "ship", label: "Shipping difference", kind: "delta", value: 40, display: "+ ฿40.00" },
          { key: "gross", label: "Gross margin", kind: "total", value: 2040, display: "฿2,040.00", share: "21.7%" },
          { key: "commission", label: "Commission", kind: "delta", value: -470, display: "− ฿470.00", share: "5%" },
          { key: "credit", label: "Credit cost", kind: "delta", value: -62, display: "− ฿62.00", note: "Estimate" },
          { key: "contribution", label: "Contribution after commission", kind: "total", value: 1508, display: "฿1,508.00", share: "16.0%", emphasis: true },
        ]}
      />
    </div>
  ),
};

export const RankedBars: Story = {
  render: () => (
    <div className="w-[32rem]">
      <BarList
        title="Leads by stage"
        data={[
          { key: "new", label: "New", value: 120, display: "120" },
          { key: "contacted", label: "Contacted", value: 92, display: "92", aside: "−23.3%" },
          { key: "quoted", label: "Quoted", value: 61, display: "61", aside: "−33.7%" },
          { key: "won", label: "Won", value: 19, display: "19", aside: "−44.1%" },
        ]}
      />
    </div>
  ),
};

export const Columns: Story = {
  render: () => (
    <div className="w-[28rem]">
      <ColumnChart
        title="Won per month"
        data={["Aug", "Sep", "Oct", "Nov"].map((month, at) => ({
          key: month,
          label: month,
          value: 4 + at * 2,
          display: String(4 + at * 2),
        }))}
      />
    </div>
  ),
};

export const ExplainedFigure: Story = {
  render: () => (
    <p className="text-sm">
      Win rate{" "}
      <FigureTip
        definition="Share of closed deals that were won"
        formula="Won ÷ (won + lost)"
        source={{ label: "Sales dashboard" }}
        asOf="3 Nov 2026 14:00"
        labels={{ formula: "Worked out as", source: "Source", asOf: "As of" }}
        className="font-semibold"
      >
        31.7%
      </FigureTip>
    </p>
  ),
};
