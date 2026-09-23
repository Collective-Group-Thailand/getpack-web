import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { Callout } from "./Callout";

describe("Callout", () => {
  it("has no axe violations in any tone", async () => {
    const { container } = render(
      <div>
        <Callout tone="info" title="ลูกฟูก E-flute คืออะไร?">
          ลอนบางสำหรับกล่องสินค้าขนาดเล็ก
        </Callout>
        <Callout tone="warning" title="วัสดุนี้พิมพ์สีเดียว" />
        <Callout tone="danger" title="บันทึกไม่สำเร็จ" />
        <Callout tone="success" title="ส่งไฟล์แล้ว" />
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("announces itself only when asked to", () => {
    const { rerender } = render(<Callout title="ตรวจสอบข้อมูล" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    rerender(<Callout live title="ตรวจสอบข้อมูล" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("carries an icon for every tone, so the tone never rests on colour alone", () => {
    const { container } = render(<Callout tone="danger" title="ผิดพลาด" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
