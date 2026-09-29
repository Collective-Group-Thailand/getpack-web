import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { SectionDivider } from "./SectionDivider";

describe("SectionDivider", () => {
  it("is hidden from assistive technology and has no axe violations", async () => {
    const { container } = render(
      <main>
        <SectionDivider />
        <SectionDivider direction="out-of" />
      </main>,
    );
    for (const svg of container.querySelectorAll("svg")) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveAttribute("focusable", "false");
    }
    await expectNoA11yViolations(container);
  });

  it("is one flat fill in the band colour, flipped for the way out of a band", () => {
    const { container, rerender } = render(<SectionDivider />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("fill-bg-subtle");
    expect(svg).not.toHaveClass("-scale-y-100");
    expect(container.querySelectorAll("path")).toHaveLength(1);

    rerender(<SectionDivider direction="out-of" />);
    expect(container.querySelector("svg")).toHaveClass("-scale-y-100");
  });
});
