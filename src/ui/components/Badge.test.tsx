import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { Badge } from "./Badge";

const TONES = ["neutral", "primary", "success", "warning", "danger", "info"] as const;

describe("Badge", () => {
  it("has no axe violations across tones and appearances", async () => {
    const { container } = render(
      <div>
        {TONES.map((tone) => (
          <span key={tone}>
            <Badge tone={tone} icon="success">
              {tone}
            </Badge>
            <Badge tone={tone} appearance="solid" icon="success">
              {tone}
            </Badge>
          </span>
        ))}
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("keeps the label readable without its colour, per design-system.md §2", () => {
    // The words are the meaning; the icon and tone only reinforce it.
    render(
      <Badge tone="warning" icon="warning">
        รอตรวจ
      </Badge>,
    );
    expect(screen.getByText("รอตรวจ")).toBeInTheDocument();
  });

  it("hides the decorative icon from screen readers", () => {
    const { container } = render(
      <Badge tone="success" icon="success">
        สำเร็จ
      </Badge>,
    );
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
