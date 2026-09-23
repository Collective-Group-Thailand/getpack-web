import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

describe("Button", () => {
  it("has no axe violations in any variant", async () => {
    const { container } = render(
      <div>
        <Button>บันทึก</Button>
        <Button variant="secondary" iconStart="download">
          ส่งออก
        </Button>
        <Button variant="destructive">ลบ</Button>
        <Button variant="ghost" disabled>
          ปิด
        </Button>
        <Button loading>กำลังบันทึก</Button>
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("defaults to type=button so a toolbar button never submits a form by accident", () => {
    render(<Button>บันทึก</Button>);
    expect(screen.getByRole("button", { name: "บันทึก" })).toHaveAttribute("type", "button");
  });

  it("keeps its label while loading, and reports being busy", () => {
    render(<Button loading>บันทึก</Button>);
    const button = screen.getByRole("button", { name: "บันทึก" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
  });

  it("is reachable and activated by keyboard", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>บันทึก</Button>);

    await userEvent.tab();
    expect(screen.getByRole("button", { name: "บันทึก" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("does not fire while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        บันทึก
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"), { pointerEventsCheck: 0 });
    expect(onClick).not.toHaveBeenCalled();
  });

  it("lets a caller override a conflicting utility", () => {
    render(<Button className="rounded-full">บันทึก</Button>);
    const className = screen.getByRole("button").className;
    expect(className).toContain("rounded-full");
    expect(className).not.toContain("rounded-md");
  });
});

describe("IconButton", () => {
  it("cannot exist without an accessible name", async () => {
    const { container } = render(<IconButton name="close" label="ปิด" />);
    expect(screen.getByRole("button", { name: "ปิด" })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
