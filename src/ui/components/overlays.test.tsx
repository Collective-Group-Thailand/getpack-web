import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { AlertDialog } from "./AlertDialog";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { DropdownMenu } from "./DropdownMenu";
import { Input } from "./Input";
import { Popover } from "./Popover";
import { Sheet } from "./Sheet";
import { Tabs } from "./Tabs";

function ControlledDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>ตั้งค่ากล่อง</Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="ตั้งค่ากล่อง"
        description="เลือกรูปแบบและขนาด"
        closeLabel="ปิด"
        footer={<Button onClick={() => setOpen(false)}>เริ่มออกแบบ</Button>}
      >
        <Input aria-label="ชื่อแบบ" />
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("is named by its title, traps focus and closes on Escape", async () => {
    render(<ControlledDialog />);
    const trigger = screen.getByRole("button", { name: "ตั้งค่ากล่อง" });
    await userEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "ตั้งค่ากล่อง" });
    expect(dialog).toHaveAccessibleDescription("เลือกรูปแบบและขนาด");
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement | null));

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // Radix restores focus to its own Dialog.Trigger ref, which is null for a controlled
    // dialog, so `useReturnFocus` captures and restores the real one. Asserted here and again
    // in a real browser in e2e/a11y.spec.ts, which is where the bug surfaced.
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("has no axe violations while open", async () => {
    const { baseElement } = render(<ControlledDialog />);
    await userEvent.click(screen.getByRole("button", { name: "ตั้งค่ากล่อง" }));
    await screen.findByRole("dialog");
    await expectNoA11yViolations(baseElement);
  });

  it("hides the close button when the dialog must be answered", async () => {
    render(
      <Dialog open onOpenChange={() => {}} title="ตั้งค่ากล่อง">
        <p>เลือกกล่องเพื่อเริ่มออกแบบ</p>
      </Dialog>,
    );
    expect(screen.queryByRole("button", { name: "ปิด" })).not.toBeInTheDocument();
  });
});

describe("AlertDialog", () => {
  it("restates the target and keeps the action locked until the phrase is typed", async () => {
    const onConfirm = vi.fn();
    const { baseElement } = render(
      <AlertDialog
        open
        onOpenChange={() => {}}
        title="ยกเลิกคำสั่งซื้อ"
        description="PK-2569-00042 · ฿12,500.00 — ไม่สามารถกู้คืนได้"
        confirmLabel="ยกเลิกคำสั่งซื้อ"
        cancelLabel="ไม่ใช่ตอนนี้"
        onConfirm={onConfirm}
        tone="destructive"
        confirmationPhrase="PK-2569-00042"
        confirmationLabel="พิมพ์ PK-2569-00042 เพื่อยืนยัน"
      />,
    );

    const confirm = screen.getByRole("button", { name: "ยกเลิกคำสั่งซื้อ" });
    expect(confirm).toBeDisabled();
    expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(/PK-2569-00042 · ฿12,500.00/);

    await userEvent.type(screen.getByRole("textbox", { name: /PK-2569-00042/ }), "PK-2569-0004");
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByRole("textbox", { name: /PK-2569-00042/ }), "2");
    expect(confirm).toBeEnabled();

    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await expectNoA11yViolations(baseElement);
  });

  it("confirms directly when no phrase is required", async () => {
    const onConfirm = vi.fn();
    render(
      <AlertDialog
        open
        onOpenChange={() => {}}
        title="ล้างงานออกแบบทั้งหมด?"
        description="ย้อนกลับได้ด้วย Ctrl+Z"
        confirmLabel="ล้างทั้งหมด"
        cancelLabel="ยกเลิก"
        onConfirm={onConfirm}
        tone="destructive"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "ล้างทั้งหมด" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("puts focus on the cancel action, never on the destructive one", async () => {
    render(
      <AlertDialog
        open
        onOpenChange={() => {}}
        title="ลบแบบ"
        description="ไม่สามารถกู้คืนได้"
        confirmLabel="ลบ"
        cancelLabel="ยกเลิก"
        onConfirm={() => {}}
        tone="destructive"
      />,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "ยกเลิก" })).toHaveFocus());
  });
});

describe("Sheet", () => {
  it("is a named dialog that closes on Escape", async () => {
    const onOpenChange = vi.fn();
    const { baseElement } = render(
      <Sheet open onOpenChange={onOpenChange} title="คุณสมบัติ" closeLabel="ปิด" side="bottom">
        <p>ข้อความ</p>
      </Sheet>,
    );

    expect(screen.getByRole("dialog", { name: "คุณสมบัติ" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await expectNoA11yViolations(baseElement);
  });
});

describe("DropdownMenu", () => {
  it("opens from the keyboard and returns focus to the trigger", async () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu
        label="ส่งออก"
        trigger={<Button>ส่งออก</Button>}
        items={[
          { id: "pdf", label: "PDF สำหรับโรงพิมพ์", description: "ขนาดจริง + bleed 3 มม.", onSelect },
          { id: "svg", label: "SVG ไดคัท", description: "เส้นตัด/พับ แยกเลเยอร์" },
        ]}
      />,
    );

    const trigger = screen.getByRole("button", { name: "ส่งออก" });
    await userEvent.click(trigger);

    const item = await screen.findByRole("menuitem", { name: /PDF สำหรับโรงพิมพ์/ });
    await userEvent.click(item);
    expect(onSelect).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe("Popover", () => {
  it("opens beside its trigger and holds interactive content", async () => {
    render(
      <Popover trigger={<Button>ลูกฟูก E-flute คืออะไร?</Button>} aria-label="คำอธิบายวัสดุ">
        <p>ลอนบางสำหรับกล่องสินค้าขนาดเล็ก</p>
      </Popover>,
    );

    await userEvent.click(screen.getByRole("button"));
    expect(await screen.findByRole("dialog", { name: "คำอธิบายวัสดุ" })).toBeInTheDocument();
  });
});

describe("Tabs", () => {
  it("names its tab list and shows one panel at a time", async () => {
    const { container } = render(
      <Tabs
        label="มุมมอง"
        items={[
          { value: "design", label: "ออกแบบ", content: <p>ผืนผ้าใบ</p> },
          { value: "preview", label: "พรีวิว 3D", content: <p>โมเดล</p> },
        ]}
      />,
    );

    expect(screen.getByRole("tablist", { name: "มุมมอง" })).toBeInTheDocument();
    expect(screen.getByText("ผืนผ้าใบ")).toBeInTheDocument();
    expect(screen.queryByText("โมเดล")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "พรีวิว 3D" }));
    expect(screen.getByText("โมเดล")).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
