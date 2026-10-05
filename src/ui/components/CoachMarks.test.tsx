import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { Button } from "./Button";
import { CoachMarks } from "./CoachMarks";

const LABELS = {
  next: "ถัดไป",
  done: "เข้าใจแล้ว",
  skip: "ข้าม",
  progress: (c: number, t: number) => `คำแนะนำ ${c} จาก ${t}`,
};

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <nav data-coach="one">ขั้นตอน</nav>
      <Button data-coach="two">ราคา</Button>
      <CoachMarks
        open={open}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
        labels={LABELS}
        marks={[
          { target: '[data-coach="one"]', title: "ทำทีละขั้น", body: "กดขั้นที่ทำแล้วเพื่อย้อนกลับ" },
          { target: '[data-coach="two"]', title: "ราคาอัปเดตทันที", body: "เปลี่ยนจำนวน ราคาเปลี่ยน" },
          { target: '[data-coach="missing"]', title: "สาม", body: "เป้าหมายไม่มี การ์ดยังอยู่มุมจอ" },
          { target: '[data-coach="one"]', title: "สี่", body: "ไม่ควรแสดง" },
        ]}
      />
    </>
  );
}

describe("CoachMarks (U5.2 §2)", () => {
  it("shows at most three, one at a time, and moves focus into the card without trapping it", async () => {
    render(<Harness />);
    const card = screen.getByRole("dialog", { name: "คำแนะนำ 1 จาก 3" });
    expect(card).toHaveAttribute("aria-modal", "false");
    expect(card).toHaveFocus();
    expect(screen.getByText("ทำทีละขั้น")).toBeInTheDocument();
    // The page behind stays usable.
    expect(screen.getByRole("button", { name: "ราคา" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    await userEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    expect(screen.getByRole("dialog", { name: "คำแนะนำ 3 จาก 3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "เข้าใจแล้ว" })).toBeInTheDocument();
    expect(screen.queryByText("สี่")).not.toBeInTheDocument();
    await expectNoA11yViolations(document.body);
  });

  it("closes on skip and on Escape", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
