import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { Skeleton } from "./Skeleton";
import { Spinner } from "./Spinner";

describe("EmptyState", () => {
  it("has no axe violations and offers one action", async () => {
    const { container } = render(
      <EmptyState
        title="ยังไม่มีงานออกแบบ"
        description="เริ่มออกแบบกล่องแรกของคุณ"
        action={<Button>เริ่มออกแบบ</Button>}
      />,
    );
    expect(screen.getByRole("button", { name: "เริ่มออกแบบ" })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});

describe("ErrorState", () => {
  it("announces the failure and shows a support code", async () => {
    const { container } = render(
      <ErrorState title="โหลดข้อมูลไม่สำเร็จ" description="ลองอีกครั้ง" code="PK-500-QUOTE" />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("โหลดข้อมูลไม่สำเร็จ");
    expect(screen.getByText("PK-500-QUOTE")).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});

describe("Spinner", () => {
  it("names itself for screen readers", () => {
    render(<Spinner label="กำลังโหลด" />);
    expect(screen.getByRole("status")).toHaveTextContent("กำลังโหลด");
  });

  it("stays silent when something nearby already said it", () => {
    render(<Spinner label={null} />);
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
});

describe("Skeleton", () => {
  it("is hidden from the accessibility tree", async () => {
    const { container } = render(<Skeleton lines={3} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    await expectNoA11yViolations(container);
  });
});
