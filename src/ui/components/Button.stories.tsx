import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";
import { IconButton } from "./IconButton";

const meta = {
  title: "Foundations/Button",
  component: Button,
  parameters: {
    docs: {
      description: {
        component:
          "One primary action per view (design-system.md §1.1). `primary` is that action; " +
          "`secondary` is the way back; `destructive` always pairs with an AlertDialog.",
      },
    },
  },
  args: { children: "บันทึก" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary">บันทึก</Button>
      <Button variant="secondary">ยกเลิก</Button>
      <Button variant="ghost">ปิด</Button>
      <Button variant="destructive">ลบแบบ</Button>
      <Button variant="link">ดูรายละเอียด</Button>
    </div>
  ),
};

export const Sizes: Story = {
  name: "Sizes (xl is the shop-floor size)",
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">เล็ก</Button>
      <Button size="md">กลาง</Button>
      <Button size="lg">ใหญ่</Button>
      <Button size="xl">สำหรับหน้างาน</Button>
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button iconStart="save">บันทึก</Button>
      <Button variant="secondary" iconEnd="download">
        ส่งออก
      </Button>
      <IconButton name="close" label="ปิด" />
      <IconButton name="trash" label="ลบ" variant="destructive" />
    </div>
  ),
};

export const LoadingAndDisabled: Story = {
  name: "Loading keeps its label",
  parameters: {
    docs: {
      description: {
        story:
          "Swapping the label for a spinner loses the accessible name and makes the button " +
          "jump, so the label stays and `aria-busy` carries the state.",
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button loading>กำลังบันทึก</Button>
      <Button disabled>บันทึก</Button>
      <IconButton name="save" label="บันทึก" loading />
    </div>
  ),
};
