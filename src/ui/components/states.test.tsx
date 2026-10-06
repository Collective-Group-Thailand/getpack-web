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
      <ErrorState
        title="โหลดข้อมูลไม่สำเร็จ"
        description="ลองอีกครั้ง"
        code="5fe1ecce-1234-4abc-8def-2fb5e788f013"
        codeLabels={{ label: "รหัสอ้างอิง", copy: "คัดลอกรหัสอ้างอิง", copied: "คัดลอกแล้ว" }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("โหลดข้อมูลไม่สำเร็จ");
    // The short reference, never the UUID (UX audit Flow 1); the copy button carries the full id.
    expect(screen.getByText("PK-88F013")).toBeInTheDocument();
    expect(screen.queryByText(/5fe1ecce/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "คัดลอกรหัสอ้างอิง" })).toBeInTheDocument();
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

describe("Avatar initials", () => {
  it("skips a parenthetical, so a note after the name is not an initial", async () => {
    const { initialsOf } = await import("./Avatar");
    expect(initialsOf("ผู้อำนวยการ ตัวอย่าง (ข้อมูลจำลอง)")).toBe("ผต");
    expect(initialsOf("Somchai Jaidee")).toBe("SJ");
    expect(initialsOf("(ข้อมูลจำลอง)")).toBe("");
  });
});
