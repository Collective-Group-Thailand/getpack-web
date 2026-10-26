import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DesignThumb } from "./DesignThumb";

vi.mock("@/features/customer/files/files", () => ({ useFileUrl: () => null }));

describe("DesignThumb", () => {
  it("draws the API's signed thumbnailUrl", () => {
    const { container } = render(<DesignThumb url="https://files.test/t.png" empty="ยังไม่มีภาพตัวอย่าง" />);
    expect(container.querySelector("img")).toHaveAttribute("src", "https://files.test/t.png");
  });

  it("shows the words instead of a broken image when the image fails", () => {
    const { container } = render(<DesignThumb url="https://files.test/gone.png" empty="ยังไม่มีภาพตัวอย่าง" />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("ยังไม่มีภาพตัวอย่าง")).toBeInTheDocument();
  });

  it("shows the words when there is no thumbnail at all", () => {
    render(<DesignThumb url={null} empty="ยังไม่มีภาพตัวอย่าง" />);
    expect(screen.getByText("ยังไม่มีภาพตัวอย่าง")).toBeInTheDocument();
  });
});
