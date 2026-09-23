import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { IconButton } from "./IconButton";
import { Kbd } from "./Kbd";
import { Separator } from "./Separator";
import { Tooltip, TooltipProvider } from "./Tooltip";

describe("Tooltip", () => {
  it("opens on keyboard focus, not only on hover", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip content="พอดีจอ">
          <IconButton name="fit" label="พอดีจอ" />
        </Tooltip>
      </TooltipProvider>,
    );

    await userEvent.tab();
    expect(screen.getByRole("button", { name: "พอดีจอ" })).toHaveFocus();
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeInTheDocument());
  });

  it("closes on Escape (WCAG 1.4.13 dismissible)", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip content="พอดีจอ">
          <IconButton name="fit" label="พอดีจอ" />
        </Tooltip>
      </TooltipProvider>,
    );

    await userEvent.tab();
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeInTheDocument());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });
});

describe("Separator and Kbd", () => {
  it("have no axe violations", async () => {
    const { container } = render(
      <div>
        <p>
          กด <Kbd>Ctrl</Kbd> + <Kbd>S</Kbd> เพื่อบันทึก
        </p>
        <Separator />
        <Separator orientation="vertical" />
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("hides a decorative separator from the accessibility tree", () => {
    render(<Separator data-testid="rule" />);
    expect(screen.getByTestId("rule")).toHaveAttribute("role", "none");
  });
});
