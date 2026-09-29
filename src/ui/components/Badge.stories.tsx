import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge } from "./Badge";
import { StatusBadge } from "./StatusBadge";

const meta = {
  title: "Foundations/Badge",
  component: Badge,
  parameters: {
    docs: {
      description: {
        component:
          "Tones come from the semantic tokens and always ship with an icon and words — " +
          "never colour alone (design-system.md §2). Status badges take a `StatusMeta` from " +
          "`src/domain/status`, so a status looks the same in all three zones.",
      },
    },
  },
  args: { children: "รอตรวจ" },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

const TONES = [
  { tone: "neutral", icon: "document", label: "ร่าง" },
  { tone: "primary", icon: "box", label: "กำลังออกแบบ" },
  // Promotions only (D-180): a real campaign from the promotions engine, never urgency (D-181).
  { tone: "accent", icon: "tag", label: "ราคาพิเศษ" },
  { tone: "info", icon: "package", label: "กำลังผลิต" },
  { tone: "success", icon: "success", label: "ส่งมอบแล้ว" },
  { tone: "warning", icon: "clock", label: "รอชำระเงิน" },
  { tone: "danger", icon: "error", label: "ยกเลิก" },
] as const;

export const Tones: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {TONES.map((t) => (
          <Badge key={t.tone} tone={t.tone} icon={t.icon}>
            {t.label}
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {TONES.map((t) => (
          <Badge key={t.tone} tone={t.tone} icon={t.icon} appearance="solid">
            {t.label}
          </Badge>
        ))}
      </div>
    </div>
  ),
};

export const Status: Story = {
  name: "StatusBadge (from src/domain/status)",
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StatusBadge meta={{ tone: "warning", icon: "clock", labelKey: "order.awaitingPayment" }} label="รอชำระเงิน" />
      <StatusBadge meta={{ tone: "info", icon: "package", labelKey: "order.inProduction" }} label="กำลังผลิต" />
      <StatusBadge meta={{ tone: "success", icon: "truck", labelKey: "order.delivered" }} label="ส่งมอบแล้ว" />
      <StatusBadge meta={{ tone: "neutral", icon: "help", labelKey: "unknown" }} label="ไม่ทราบสถานะ" />
    </div>
  ),
};

export const Greyscale: Story = {
  name: "Readable without colour",
  parameters: {
    docs: {
      description: { story: "The same badges with the hue removed: icon and words still carry the meaning." },
    },
  },
  render: () => (
    <div className="flex flex-wrap gap-2 grayscale">
      {TONES.map((t) => (
        <Badge key={t.tone} tone={t.tone} icon={t.icon}>
          {t.label}
        </Badge>
      ))}
    </div>
  ),
};
