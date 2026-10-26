import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StepCard } from "./StepCard";
import { StepChips, type StepChip } from "./StepChips";

const chips: StepChip[] = [
  { id: "step-size", label: "ขนาด", state: "done", srLabel: "เรียบร้อยแล้ว" },
  { id: "step-material", label: "วัสดุ", state: "default", stateLabel: "ค่าเริ่มต้น" },
  { id: "step-delivery", label: "การจัดส่ง", state: "todo", srLabel: "ยังต้องระบุ" },
];

function page() {
  return (
    <>
      <StepChips aria-label="ขั้นตอน" chips={chips} />
      {chips.map((chip, index) => (
        <StepCard key={chip.id} id={chip.id} number={index + 1} title={chip.label} hint="คำใบ้">
          เนื้อหา
        </StepCard>
      ))}
    </>
  );
}

afterEach(() => vi.restoreAllMocks());

describe("StepChips", () => {
  it("says each state in words, not colour alone", () => {
    render(page());
    expect(screen.getByRole("link", { name: /ขนาด.*เรียบร้อยแล้ว/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /วัสดุ.*ค่าเริ่มต้น/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /การจัดส่ง.*ยังต้องระบุ/ })).toBeInTheDocument();
  });

  it("scrolls to the step and moves focus there, instantly under reduced motion", () => {
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} });
    render(page());
    fireEvent.click(screen.getByRole("link", { name: /การจัดส่ง/ }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    expect(document.getElementById("step-delivery")).toHaveFocus();
  });

  it("numbers each card and gives it its title and hint", () => {
    render(page());
    expect(screen.getByRole("heading", { name: /การจัดส่ง/ })).toBeInTheDocument();
    expect(screen.getAllByText("คำใบ้")).toHaveLength(3);
  });
});
