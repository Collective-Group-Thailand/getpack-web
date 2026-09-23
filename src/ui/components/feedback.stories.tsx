import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";
import { Callout } from "./Callout";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "./Card";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { Kbd } from "./Kbd";
import { Separator } from "./Separator";
import { Skeleton } from "./Skeleton";
import { Spinner } from "./Spinner";
import { Tooltip } from "./Tooltip";

const meta = {
  title: "Foundations/Feedback and surfaces",
  parameters: {
    docs: {
      description: {
        component:
          "States a screen owes the user: loading that does not shift the layout, empty that " +
          "explains the value, errors that are recoverable and carry a support code " +
          "(design-system.md §4).",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Callouts: Story = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-3">
      <Callout tone="info" title="ลูกฟูก E-flute คืออะไร?">
        ลอนบาง ผิวเรียบ เหมาะกับกล่องสินค้าขนาดเล็กที่ต้องพิมพ์สี่สี
      </Callout>
      <Callout tone="warning" title="วัสดุนี้พิมพ์ได้สีเดียว">
        คราฟท์ลูกฟูกเหมาะกับการพิมพ์โลโก้สีเดียว (flexo) เท่านั้น
      </Callout>
      <Callout tone="danger" title="บันทึกไม่สำเร็จ">
        พื้นที่จัดเก็บของเบราว์เซอร์เต็ม ลองลดขนาดรูปภาพในงานออกแบบ
      </Callout>
      <Callout tone="success" title="ส่งไฟล์ให้โรงพิมพ์แล้ว" />
    </div>
  ),
};

export const Surfaces: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>กล่องฝาชน (RSC)</CardTitle>
            <CardDescription>กล่องลูกฟูกมาตรฐานสำหรับขนส่ง</CardDescription>
          </div>
        </CardHeader>
        <p className="text-muted text-sm">150×100×80 มม. · คราฟท์ 3 ชั้น</p>
        <CardFooter>
          <Button size="sm">เปิดแบบ</Button>
          <Button size="sm" variant="ghost">
            ทำสำเนา
          </Button>
        </CardFooter>
      </Card>
      <Card elevation="raised">
        <CardTitle as="h4">ทางลัด</CardTitle>
        <p className="text-muted mt-2 text-sm">
          กด <Kbd>Ctrl</Kbd> + <Kbd>S</Kbd> เพื่อบันทึก · <Kbd>Delete</Kbd> เพื่อลบองค์ประกอบ
        </p>
        <Separator className="my-3" />
        <Tooltip content="ปรับมุมมองให้พอดีจอ">
          <Button size="sm" variant="secondary" iconStart="fit">
            พอดีจอ
          </Button>
        </Tooltip>
      </Card>
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-4">
      <Spinner label="กำลังโหลด" />
      <Card>
        <Skeleton className="mb-3 aspect-[4/3] w-full" />
        <Skeleton lines={3} />
      </Card>
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div className="max-w-xl">
      <EmptyState
        title="ยังไม่มีงานออกแบบ"
        description="เริ่มออกแบบกล่องแรกของคุณ แล้วบันทึกไว้เปิดต่อได้ทุกเมื่อ"
        action={<Button>เริ่มออกแบบกล่องแรก</Button>}
      />
    </div>
  ),
};

export const Failed: Story = {
  render: () => (
    <div className="max-w-xl">
      <ErrorState
        title="โหลดรายการแบบไม่สำเร็จ"
        description="การเชื่อมต่อขาดหาย ลองอีกครั้งได้เลย"
        action={
          <Button variant="secondary" iconStart="reset">
            ลองอีกครั้ง
          </Button>
        }
        code="PK-503-DESIGNS"
      />
    </div>
  ),
};
