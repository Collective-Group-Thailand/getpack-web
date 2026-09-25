import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Chart } from "./Chart";

const data = [
  { step: "visit", count: 1200 },
  { step: "quote", count: 300 },
  { step: "paid", count: 42 },
];

describe("Chart", () => {
  it("is a named figure whose figures are readable as a table", () => {
    render(
      <Chart
        kind="bar"
        title="Funnel"
        data={data}
        index="step"
        indexLabel="Step"
        series={[{ key: "count", label: "Sessions" }]}
        formatValue={(value) => value.toLocaleString("en-US")}
        labels={{ showTable: "Show as table", hideTable: "Show as chart" }}
      />,
    );
    const figure = screen.getByRole("figure", { name: "Funnel" });
    const table = within(figure).getByRole("table", { name: "Funnel" });
    expect(within(table).getByRole("rowheader", { name: "visit" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "1,200" })).toBeInTheDocument();
  });

  it("swaps the drawing for the table on request", () => {
    render(
      <Chart
        kind="line"
        title="Trend"
        data={data}
        index="step"
        indexLabel="Step"
        series={[{ key: "count", label: "Sessions" }]}
        labels={{ showTable: "Show as table", hideTable: "Show as chart" }}
      />,
    );
    const toggle = screen.getByRole("button", { name: "Show as table" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Show as chart" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("table", { name: "Trend" }).parentElement).not.toHaveClass("sr-only");
  });
});
