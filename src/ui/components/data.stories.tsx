import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Badge } from "./Badge";
import { Button } from "./Button";
import { ColumnToggle } from "./ColumnToggle";
import { Combobox, type ComboboxOption } from "./Combobox";
import { DataTable, type DataTableColumn, type DataTableSort } from "./DataTable";
import { DescriptionList } from "./DescriptionList";
import { EmptyState } from "./EmptyState";
import { FileDropzone } from "./FileDropzone";
import { JsonView } from "./JsonView";
import { Meter } from "./Meter";
import { PageHeader, Toolbar } from "./PageHeader";
import { Pagination } from "./Pagination";
import { SearchInput } from "./SearchInput";
import { SlaTimer } from "./SlaTimer";
import { Stat } from "./Stat";
import { Timeline } from "./Timeline";

const meta = {
  title: "Data display/Back office",
  parameters: {
    docs: {
      description: {
        component:
          "The building blocks of a back-office list and detail page (F2 §2): a server-driven " +
          "table, its toolbar and pagination, queue cards, SLA timers, timelines and label/value " +
          "detail. Every piece of copy is a prop — the data here is obviously fake.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type Row = { id: string; code: string; customer: string; total: string; dueAt: string; tone?: "danger" | "warning" };

const now = Date.parse("2026-09-25T10:00:00+07:00");
const ROWS: Row[] = [
  {
    id: "1",
    code: "PK-2569-00041",
    customer: "ร้านกาแฟตัวอย่าง",
    total: "฿12,480.00",
    dueAt: new Date(now - 45 * 60_000).toISOString(),
    tone: "danger",
  },
  {
    id: "2",
    code: "PK-2569-00042",
    customer: "บริษัท ตัวอย่างขนม จำกัด",
    total: "฿86,400.00",
    dueAt: new Date(now + 90 * 60_000).toISOString(),
    tone: "warning",
  },
  {
    id: "3",
    code: "PK-2569-00043",
    customer: "แบรนด์สกินแคร์ตัวอย่าง",
    total: "฿4,210.00",
    dueAt: new Date(now + 26 * 3_600_000).toISOString(),
  },
];

const sla = (ms: number, overdue: boolean) => `${overdue ? "เกิน" : "เหลือ"} ${Math.round(Math.abs(ms) / 60_000)} นาที`;

const COLUMNS: DataTableColumn<Row>[] = [
  { id: "code", header: "รหัส", cell: (row) => <span className="font-mono">{row.code}</span>, sortable: true },
  { id: "customer", header: "ลูกค้า", cell: (row) => row.customer },
  { id: "total", header: "ยอดรวม", cell: (row) => row.total, numeric: true, sortable: true },
  { id: "sla", header: "SLA", cell: (row) => <SlaTimer dueAt={row.dueAt} format={sla} /> },
];

const LABELS = { selectAll: "เลือกทั้งหมด", selectRow: (name: string) => `เลือก ${name}`, sortBy: "เรียงตาม" };

function ListPage({ loading = false, empty = false }: { loading?: boolean; empty?: boolean }) {
  const [sort, setSort] = useState<DataTableSort | null>({ id: "code", desc: true });
  const [selected, setSelected] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="คำสั่งซื้อ"
        description="คิวงานของฝ่ายบริการลูกค้า"
        meta={<Badge tone="warning">3 เกินกำหนด</Badge>}
        actions={<Button iconStart="plus">สร้างคำสั่งซื้อ</Button>}
      />
      <Toolbar label="ตัวกรอง">
        <SearchInput
          value={q}
          onValueChange={setQ}
          clearLabel="ล้างคำค้น"
          aria-label="ค้นหา"
          placeholder="รหัส ชื่อ เบอร์โทร"
          className="w-72"
        />
        <div className="ms-auto">
          <ColumnToggle
            label="คอลัมน์"
            columns={COLUMNS.map((column) => ({ id: column.id, label: String(column.header) }))}
            hidden={hidden}
            onHiddenChange={setHidden}
          />
        </div>
      </Toolbar>
      {selected.length > 0 ? (
        <div className="bg-primary-subtle flex items-center gap-3 rounded-lg px-3 py-2 text-sm">
          <span>เลือก {selected.length} รายการ</span>
          <Button size="sm" variant="secondary">
            ส่งข้อความเตือน
          </Button>
        </div>
      ) : null}
      <DataTable
        caption="คำสั่งซื้อ"
        columns={COLUMNS}
        rows={empty || loading ? [] : ROWS}
        getRowId={(row) => row.id}
        getRowName={(row) => row.code}
        sort={sort}
        onSortChange={setSort}
        hiddenColumns={hidden}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        loading={loading}
        labels={LABELS}
        rowTone={(row) => row.tone}
        skeletonRows={3}
        empty={<EmptyState icon="inbox" title="ไม่มีคำสั่งซื้อในคิวนี้" description="งานใหม่จะขึ้นที่นี่ทันที" />}
      />
      <Pagination
        page={page}
        perPage={25}
        total={empty ? 0 : 63}
        onPageChange={setPage}
        onPerPageChange={() => {}}
        labels={{
          nav: "เลื่อนหน้า",
          previous: "ก่อนหน้า",
          next: "ถัดไป",
          range: (from, to, total) => `แสดง ${from}–${to} จาก ${total} รายการ`,
          pageOf: (current, pages) => `หน้า ${current} จาก ${pages}`,
          perPage: "รายการต่อหน้า",
        }}
      />
    </div>
  );
}

export const ServerList: Story = { render: () => <ListPage /> };
export const Loading: Story = { render: () => <ListPage loading /> };
export const Empty: Story = { render: () => <ListPage empty /> };

export const QueueCards: Story = {
  render: () => (
    <div className="grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
      <Stat label="รอตรวจสลิป" value="12" hint="3 เกินกำหนด" icon="receipt" tone="danger" as="a" href="#" />
      <Stat label="รอไฟล์" value="7" hint="ถัดไปครบใน 2 ชม." icon="upload" tone="warning" as="a" href="#" />
      <Stat label="รอเริ่มผลิต" value="4" icon="factory" as="a" href="#" />
    </div>
  ),
};

export const Detail: Story = {
  render: () => (
    <div className="grid max-w-4xl gap-6 md:grid-cols-[1fr_18rem]">
      <div className="space-y-4">
        <DescriptionList
          items={[
            { term: "ลูกค้า", description: "บริษัท ตัวอย่างขนม จำกัด" },
            { term: "ยอดรวม", description: "฿86,400.00" },
            {
              term: "ที่อยู่จัดส่ง",
              description: "99/1 ถนนตัวอย่าง แขวงตัวอย่าง เขตตัวอย่าง กรุงเทพฯ 10110",
              wide: true,
            },
          ]}
        />
        <div>
          <p className="mb-2 text-sm font-medium">งบแคมเปญ</p>
          <Meter value={82} tone="warning" label="งบแคมเปญ" valueText="ใช้ไป ฿82,000 จาก ฿100,000" />
        </div>
        <JsonView label="ข้อมูลที่บันทึก" value={{ key: "discounts.cs_limit_pct", from: "5", to: "5" }} />
      </div>
      <Timeline
        label="ประวัติ"
        items={[
          { id: "1", title: "สร้างคำสั่งซื้อ", time: "10:02", actor: "สมชาย", icon: "plus" },
          { id: "2", title: "ชำระมัดจำแล้ว", time: "10:40", actor: "ระบบ", icon: "wallet", tone: "success" },
          { id: "3", title: "ขอให้แก้ไขไฟล์", time: "11:15", actor: "ฝ่ายเตรียมพิมพ์", icon: "edit", tone: "warning" },
        ]}
      />
    </div>
  ),
};

const PEOPLE: ComboboxOption[] = [
  { value: "1", label: "สมชาย ตัวอย่าง", description: "CS" },
  { value: "2", label: "สมหญิง ตัวอย่าง", description: "Finance" },
  { value: "3", label: "สมศักดิ์ ตัวอย่าง", description: "Director" },
];

function PickerDemo() {
  const [value, setValue] = useState<ComboboxOption | null>(null);
  const [query, setQuery] = useState("");
  return (
    <div className="flex max-w-md flex-col gap-6">
      <Combobox
        aria-label="ผู้รับมอบหมาย"
        value={value}
        onValueChange={setValue}
        query={query}
        onQueryChange={setQuery}
        options={PEOPLE.filter((person) => person.label.includes(query))}
        placeholder="พิมพ์ชื่อเพื่อค้นหา"
        labels={{ loading: "กำลังค้นหา", empty: "ไม่พบรายชื่อ", clear: "ล้าง" }}
      />
      <FileDropzone
        accept=".xlsx"
        maxBytes={10 * 1024 * 1024}
        onFiles={() => {}}
        labels={{
          prompt: "ลากไฟล์มาวางที่นี่ หรือ",
          browse: "เลือกไฟล์",
          hint: "xlsx ไม่เกิน 10 MB",
          tooLarge: (name) => `${name} ใหญ่เกิน 10 MB`,
          wrongType: (name) => `${name} ไม่ใช่ไฟล์ xlsx`,
        }}
      />
    </div>
  );
}

export const Pickers: Story = { render: () => <PickerDemo /> };
