import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { AppShell } from "./AppShell";
import { Avatar } from "./Avatar";
import { Breadcrumbs } from "./Breadcrumbs";
import { Button } from "./Button";
import { CommandPalette } from "./CommandPalette";
import { IconButton } from "./IconButton";
import { KEYCAP, Kbd } from "./Kbd";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { Icon } from "../icons";

const meta = {
  title: "Navigation/Shell furniture",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The pieces the three zone shells are assembled from (F1 1.3). The shells themselves " +
          "live in `src/features/<zone>/shell` — they read entitlements and messages, which is " +
          "why they are not in the design system.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** The back-office frame: collapsible sidebar, topbar, breadcrumbs, content. */
export const WorkspaceShell: Story = {
  render: function Workspace() {
    const [collapsed, setCollapsed] = useState(false);

    return (
      <AppShell
        skipLabel="ข้ามไปที่เนื้อหา"
        sidebarLabel="เมนูหลัก"
        sidebarCollapsed={collapsed}
        header={
          <header className="border-border bg-surface flex h-16 items-center gap-2 border-b px-3">
            <IconButton
              name="sidebar"
              size="sm"
              label={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((value) => !value)}
            />
            <span className="font-display font-semibold">getpack</span>
            <Button variant="secondary" size="sm" className="text-muted mx-auto w-80 justify-start font-normal">
              <Icon name="search" size={16} />
              <span className="flex-1 text-start">ค้นหาคำสั่งซื้อ ลูกค้า โรงงาน</span>
              <Kbd>{KEYCAP.ctrl}</Kbd>
              <Kbd>{KEYCAP.k}</Kbd>
            </Button>
            <Avatar name="สมชาย ใจดี" />
          </header>
        }
        sidebar={
          <ul className="flex flex-col gap-0.5 px-2">
            {[
              { key: "ภาพรวม", icon: "pattern", current: true },
              { key: "คำสั่งซื้อ", icon: "package", current: false },
              { key: "โรงงานพาร์ตเนอร์", icon: "factory", current: false },
              { key: "การเงิน", icon: "wallet", current: false },
            ].map((item) => (
              <li key={item.key}>
                <a
                  href="#main"
                  aria-current={item.current ? "page" : undefined}
                  className={[
                    "flex h-10 items-center gap-3 rounded-lg px-3 text-sm",
                    collapsed ? "justify-center px-0" : "",
                    item.current ? "bg-primary-subtle text-primary-subtle-fg font-medium" : "text-muted",
                  ].join(" ")}
                >
                  <Icon name={item.icon as "package"} size={18} />
                  <span className={collapsed ? "sr-only" : "truncate"}>{item.key}</span>
                </a>
              </li>
            ))}
          </ul>
        }
      >
        <div className="p-6">
          <Breadcrumbs
            label="เส้นทางหน้า"
            items={[{ label: "ภาพรวม", href: "#" }, { label: "คำสั่งซื้อ", href: "#" }, { label: "PK-2569-00042" }]}
          />
          <h1 className="mt-4 text-2xl font-semibold">PK-2569-00042</h1>
          <p className="text-muted mt-2 text-sm">เนื้อหาของหน้าจะอยู่ตรงนี้</p>
        </div>
      </AppShell>
    );
  },
};

/** ⌘K: a combobox in a modal — focus stays in the input, the list is pointed at by id. */
export const Palette: Story = {
  render: function PaletteStory() {
    const [open, setOpen] = useState(true);
    const [value, setValue] = useState("");

    const items = [
      { id: "1", label: "PK-2569-00042", hint: "ร้านกาแฟบ้านสวน", group: "คำสั่งซื้อ", icon: "package" as const },
      { id: "2", label: "PK-2569-00041", hint: "บริษัท ตัวอย่าง จำกัด", group: "คำสั่งซื้อ", icon: "package" as const },
      { id: "3", label: "โรงพิมพ์ตัวอย่าง", hint: "นครปฐม", group: "โรงงาน", icon: "factory" as const },
    ].filter((item) => item.label.includes(value) || item.hint.includes(value));

    return (
      <div className="min-h-dvh p-6">
        <Button onClick={() => setOpen(true)}>เปิดการค้นหา</Button>
        <CommandPalette
          open={open}
          onOpenChange={setOpen}
          title="ค้นหาและสั่งงาน"
          placeholder="พิมพ์เพื่อค้นหา"
          loadingLabel="กำลังค้นหา"
          emptyLabel="ไม่พบผลลัพธ์"
          value={value}
          onValueChange={setValue}
          items={items.map((item) => ({ ...item, onSelect: () => undefined }))}
          footer={
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> เลือก · <Kbd>{KEYCAP.enter}</Kbd> เปิด · <Kbd>{KEYCAP.esc}</Kbd> ปิด
            </span>
          }
        />
      </div>
    );
  },
};

/** The `?` overlay — a keyboard-first workspace whose shortcuts nobody can find has none. */
export const Shortcuts: Story = {
  render: function ShortcutsStory() {
    const [open, setOpen] = useState(true);

    return (
      <div className="min-h-dvh p-6">
        <Button onClick={() => setOpen(true)}>ปุ่มลัด</Button>
        <ShortcutsOverlay
          open={open}
          onOpenChange={setOpen}
          title="ปุ่มลัด"
          closeLabel="ปิด"
          shortcuts={[
            { keys: [KEYCAP.ctrl, KEYCAP.k], description: "ค้นหาและสั่งงาน", group: "ทั่วไป" },
            { keys: [KEYCAP.question], description: "ปุ่มลัด", group: "ทั่วไป" },
            { keys: [KEYCAP.esc], description: "ปิดหน้าต่างที่เปิดอยู่", group: "ทั่วไป" },
          ]}
        />
      </div>
    );
  },
};

/** Initials work in both scripts; two at most, and never sliced mid-glyph. */
export const Avatars: Story = {
  render: () => (
    <div className="flex items-center gap-4 p-6">
      <Avatar name="สมชาย ใจดี" size="sm" />
      <Avatar name="สมหญิง รักดี" />
      <Avatar name="Alex Fernandez" size="lg" />
    </div>
  ),
};
