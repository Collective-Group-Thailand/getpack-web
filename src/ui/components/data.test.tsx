import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { Combobox, type ComboboxOption } from "./Combobox";
import { DataTable, type DataTableColumn, type DataTableSort } from "./DataTable";
import { DescriptionList } from "./DescriptionList";
import { FileDropzone } from "./FileDropzone";
import { Meter } from "./Meter";
import { Pagination } from "./Pagination";
import { SlaTimer } from "./SlaTimer";
import { Timeline } from "./Timeline";
import { TooltipProvider } from "./Tooltip";

type Order = { id: string; code: string; total: string };

const ROWS: Order[] = [
  { id: "a", code: "PK-2569-00041", total: "฿1,200.00" },
  { id: "b", code: "PK-2569-00042", total: "฿980.00" },
];

const COLUMNS: DataTableColumn<Order>[] = [
  { id: "code", header: "รหัส", cell: (row) => row.code, sortable: true },
  { id: "total", header: "ยอดรวม", cell: (row) => row.total, numeric: true, sortable: true },
];

const LABELS = { selectAll: "เลือกทั้งหมด", selectRow: (name: string) => `เลือก ${name}`, sortBy: "เรียงตาม" };

function Harness({ onSort }: { onSort?: (sort: DataTableSort) => void }) {
  const [sort, setSort] = useState<DataTableSort | null>({ id: "code", desc: false });
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <>
      <DataTable
        caption="คำสั่งซื้อ"
        columns={COLUMNS}
        rows={ROWS}
        getRowId={(row) => row.id}
        getRowName={(row) => row.code}
        sort={sort}
        onSortChange={(next) => {
          setSort(next);
          onSort?.(next);
        }}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        labels={LABELS}
      />
      <output data-testid="selected">{selected.join(",")}</output>
    </>
  );
}

describe("DataTable", () => {
  it("is a captioned table with no axe violations", async () => {
    const { container } = render(<Harness />);
    expect(screen.getByRole("table", { name: "คำสั่งซื้อ" })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("marks the sorted column with aria-sort and asks the caller to re-sort", async () => {
    const onSort = vi.fn();
    render(<Harness onSort={onSort} />);

    expect(screen.getByRole("columnheader", { name: /รหัส/ })).toHaveAttribute("aria-sort", "ascending");
    await userEvent.click(screen.getByRole("button", { name: /ยอดรวม/ }));
    expect(onSort).toHaveBeenLastCalledWith(expect.objectContaining({ id: "total" }));
    expect(screen.getByRole("columnheader", { name: /ยอดรวม/ })).toHaveAttribute("aria-sort");
  });

  it("names each row's checkbox after the row, and selects all", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("checkbox", { name: "เลือก PK-2569-00042" }));
    expect(screen.getByTestId("selected")).toHaveTextContent("b");

    await userEvent.click(screen.getByRole("checkbox", { name: "เลือกทั้งหมด" }));
    expect(screen.getByTestId("selected")).toHaveTextContent("a,b");
  });

  it("shows the empty state, and holds the layout with skeletons while loading", () => {
    const { rerender, container } = render(
      <DataTable
        caption="ว่าง"
        columns={COLUMNS}
        rows={[]}
        getRowId={(row) => row.id}
        labels={LABELS}
        empty="ไม่มีรายการ"
      />,
    );
    expect(screen.getByText("ไม่มีรายการ")).toBeInTheDocument();

    rerender(
      <DataTable
        caption="ว่าง"
        columns={COLUMNS}
        rows={[]}
        getRowId={(row) => row.id}
        labels={LABELS}
        loading
        skeletonRows={3}
      />,
    );
    expect(container.querySelectorAll("tbody tr[aria-hidden]")).toHaveLength(3);
    expect(container.firstChild).toHaveAttribute("aria-busy", "true");
  });

  it("hides the columns it is told to, but never the first", () => {
    render(
      <DataTable
        caption="c"
        columns={COLUMNS}
        rows={ROWS}
        getRowId={(row) => row.id}
        labels={LABELS}
        hiddenColumns={["total"]}
      />,
    );
    expect(screen.queryByRole("columnheader", { name: /ยอดรวม/ })).not.toBeInTheDocument();
  });
});

describe("Pagination", () => {
  const labels = {
    nav: "เลื่อนหน้า",
    previous: "ก่อนหน้า",
    next: "ถัดไป",
    range: (from: number, to: number, total: number) => `${from}–${to} จาก ${total}`,
    pageOf: (page: number, pages: number) => `หน้า ${page}/${pages}`,
    perPage: "ต่อหน้า",
  };

  it("disables what cannot be done and announces the range", async () => {
    const onPage = vi.fn();
    const { container } = render(<Pagination page={1} perPage={25} total={60} onPageChange={onPage} labels={labels} />);
    expect(screen.getByRole("button", { name: "ก่อนหน้า" })).toBeDisabled();
    expect(screen.getByText("1–25 จาก 60")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    expect(onPage).toHaveBeenCalledWith(2);
    await expectNoA11yViolations(container);
  });

  it("reports an empty list as 0 of 0, not 1 of 0", () => {
    render(<Pagination page={1} perPage={25} total={0} onPageChange={() => {}} labels={labels} />);
    expect(screen.getByText("0–0 จาก 0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ถัดไป" })).toBeDisabled();
  });
});

describe("Combobox", () => {
  const OPTIONS: ComboboxOption[] = [
    { value: "u1", label: "สมชาย", description: "CS" },
    { value: "u2", label: "สมหญิง", description: "Finance" },
  ];

  function Picker({ onPick }: { onPick: (option: ComboboxOption | null) => void }) {
    const [value, setValue] = useState<ComboboxOption | null>(null);
    const [query, setQuery] = useState("");
    return (
      <Combobox
        aria-label="ผู้รับมอบหมาย"
        value={value}
        onValueChange={(option) => {
          setValue(option);
          onPick(option);
        }}
        query={query}
        onQueryChange={setQuery}
        options={OPTIONS.filter((option) => option.label.includes(query))}
        labels={{ loading: "กำลังค้นหา", empty: "ไม่พบ", clear: "ล้าง" }}
      />
    );
  }

  it("is operable by keyboard alone, with the active option announced", async () => {
    const onPick = vi.fn();
    const { container } = render(<Picker onPick={onPick} />);
    const input = screen.getByRole("combobox", { name: "ผู้รับมอบหมาย" });

    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(input.getAttribute("aria-activedescendant")).toContain("u2");
    await userEvent.keyboard("{Enter}");

    expect(onPick).toHaveBeenCalledWith(OPTIONS[1]);
    expect(input).toHaveValue("สมหญิง");
    await expectNoA11yViolations(container);
  });

  it("says so when nothing matches", async () => {
    render(<Picker onPick={() => {}} />);
    await userEvent.type(screen.getByRole("combobox"), "ไม่มีชื่อนี้");
    expect(within(screen.getByRole("listbox")).getByText("ไม่พบ")).toBeInTheDocument();
  });
});

describe("FileDropzone", () => {
  const labels = {
    prompt: "ลากไฟล์มาวาง หรือ",
    browse: "เลือกไฟล์",
    tooLarge: (name: string) => `${name} ใหญ่เกินไป`,
    wrongType: (name: string) => `${name} ไม่ใช่ไฟล์ที่รับ`,
  };

  it("accepts a picked file and refuses the wrong type with an alert", async () => {
    const onFiles = vi.fn();
    const { container } = render(<FileDropzone accept=".xlsx" maxBytes={1024} onFiles={onFiles} labels={labels} />);
    const input = container.querySelector("input[type=file]") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [new File(["x"], "stock.xlsx")] } });
    expect(onFiles).toHaveBeenCalledWith([expect.objectContaining({ name: "stock.xlsx" })]);

    fireEvent.change(input, { target: { files: [new File(["x"], "photo.png", { type: "image/png" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent("photo.png ไม่ใช่ไฟล์ที่รับ");

    fireEvent.change(input, { target: { files: [new File(["x".repeat(2048)], "big.xlsx")] } });
    expect(screen.getByRole("alert")).toHaveTextContent("big.xlsx ใหญ่เกินไป");
    await expectNoA11yViolations(container);
  });
});

describe("SlaTimer", () => {
  it("says overdue in words and an icon, not only in red", () => {
    vi.useFakeTimers({ now: Date.parse("2026-09-25T10:00:00+07:00") });
    const format = (ms: number, overdue: boolean) =>
      `${overdue ? "เกิน" : "เหลือ"} ${Math.round(Math.abs(ms) / 60_000)} นาที`;

    render(<SlaTimer dueAt="2026-09-25T09:30:00+07:00" format={format} />);
    expect(screen.getByText("เกิน 30 นาที")).toHaveClass("text-danger");

    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText("เกิน 31 นาที")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("trusts the API's state over the wall clock, and invents no at-risk threshold", () => {
    const format = () => "เหลือเวลา";
    const { rerender } = render(<SlaTimer dueAt="2099-01-01T00:00:00+07:00" format={format} />);
    expect(screen.getByText("เหลือเวลา")).toHaveClass("text-muted");
    rerender(<SlaTimer dueAt="2099-01-01T00:00:00+07:00" state="at_risk" format={format} />);
    expect(screen.getByText("เหลือเวลา")).toHaveClass("text-warning-subtle-fg");
  });
});

describe("DescriptionList, Timeline, Meter", () => {
  it("have no axe violations", async () => {
    const { container } = render(
      <TooltipProvider>
        <DescriptionList items={[{ term: "ลูกค้า", description: "ร้านตัวอย่าง" }]} />
        <Timeline
          label="ประวัติ"
          items={[{ id: "1", title: "สร้างคำสั่งซื้อ", time: "เมื่อสักครู่", actor: "สมชาย" }]}
        />
        <Meter value={82} label="งบแคมเปญ" valueText="ใช้ไป ฿82,000 จาก ฿100,000" tone="warning" />
      </TooltipProvider>,
    );
    expect(screen.getByRole("meter", { name: "งบแคมเปญ" })).toHaveAttribute(
      "aria-valuetext",
      "ใช้ไป ฿82,000 จาก ฿100,000",
    );
    await expectNoA11yViolations(container);
  });
});

describe("CommandPalette with grouped results", () => {
  it("puts only options and named groups in the listbox, and stays axe-clean", async () => {
    const { CommandPalette } = await import("./CommandPalette");
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        title="ค้นหาและสั่งงาน"
        placeholder="พิมพ์เพื่อค้นหา"
        loadingLabel="กำลังค้นหา"
        emptyLabel="ไม่พบ"
        value="สม"
        onValueChange={() => {}}
        items={[
          { id: "s1", label: "ภาพรวม", group: "หน้าจอ", onSelect: () => {} },
          { id: "s2", label: "ผู้ใช้และสิทธิ์", group: "หน้าจอ", onSelect: () => {} },
          { id: "u1", label: "สมชาย ตัวอย่าง", hint: "somchai@packio.invalid", group: "ผู้ใช้", onSelect: () => {} },
        ]}
      />,
    );

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByRole("group", { name: "หน้าจอ" })).toBeInTheDocument();
    expect(
      within(within(listbox).getByRole("group", { name: "ผู้ใช้" })).getByRole("option", { name: /สมชาย/ }),
    ).toBeInTheDocument();
    expect(within(listbox).getAllByRole("option")).toHaveLength(3);
    // Rendered into a portal, so scan the document rather than the container.
    await expectNoA11yViolations(document.body);
  });
});
