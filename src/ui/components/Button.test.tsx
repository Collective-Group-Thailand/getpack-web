import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

/**
 * What a server component's `<Link>` looks like by the time it reaches a client `asChild`
 * button: an RSC lazy reference over an already-streamed chunk — here nested, as seen on the
 * storefront header — rather than an element.
 */
function rscLazy(value: ReactNode): ReactNode {
  const chunk = Object.assign(Promise.resolve(value), { status: "fulfilled", value });
  return { $$typeof: Symbol.for("react.lazy"), _payload: chunk } as unknown as ReactNode;
}

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

  it("renders as its child, with icons, without breaking Radix Slot", () => {
    // Regression: with asChild, Slot needs to know which child to merge into. Without
    // <Slottable> around the label it saw three children and threw at render — a failure
    // jsdom-free component tests missed until the e2e server crashed on the home page.
    render(
      // A plain <a> rather than next/link: this is about Slot merging, and the real
      // next/link case is exercised end to end in the e2e suite.
      <Button asChild iconStart="save" iconEnd="chevron-right">
        <a href="https://packio.example/design">เริ่มออกแบบ</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "เริ่มออกแบบ" });
    expect(link).toHaveAttribute("href", "https://packio.example/design");
    expect(link.querySelectorAll("svg")).toHaveLength(2);
    // The rendered element is the child's, so no nested button appears.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("slots onto a child that arrives as a lazy reference from a server component", () => {
    // Regression: Radix Slot unwraps one lazy level only, so a nested one threw
    // "Slot failed to slot onto its `Slottable`" and took down every page with the header.
    render(<Button asChild>{rscLazy(rscLazy(<a href="https://packio.example/products">สินค้า</a>))}</Button>);

    expect(screen.getByRole("link", { name: "สินค้า" })).toHaveAttribute("href", "https://packio.example/products");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
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

  it("slots onto a child that arrives as a lazy reference from a server component", () => {
    // Without resolving the lazy first it was not a valid element, so Slot merged onto the
    // <svg> instead and the link — href and all — silently disappeared.
    render(
      <IconButton asChild name="cart" label="ตะกร้า">
        {rscLazy(<a href="https://packio.example/cart" />)}
      </IconButton>,
    );

    const link = screen.getByRole("link", { name: "ตะกร้า" });
    expect(link).toHaveAttribute("href", "https://packio.example/cart");
    expect(link.querySelector("svg")).toBeInTheDocument();
  });
});
