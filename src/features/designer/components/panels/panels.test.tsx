import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it } from "vitest";
import { REFERENCE_MATERIALS, SPEC_VERSION } from "@packio/dieline";

import common from "@/i18n/messages/th/common/common.json";
import designer from "@/i18n/messages/th/customer/designer.json";
import { expectNoA11yViolations } from "@/ui/test/axe";

import { DEFAULT_PATTERN } from "../../catalog";
import { dielineOf } from "../../document";
import type { DesignIssue } from "../../lib/checks";
import { newCode, newShape, newText } from "../../lib/create";
import { useEditor } from "../../store/editor";
import type { DesignElement, DesignSpec } from "../../types";
import { DesignerContext, type DesignerHandle } from "../DesignerContext";
import { ArrangePanel } from "./ArrangePanel";
import { ChecksPanel } from "./ChecksPanel";
import { LayersPanel } from "./LayersPanel";
import { PropertiesPanel } from "./PropertiesPanel";

const SPEC: DesignSpec = {
  specVersion: SPEC_VERSION,
  styleId: "tuck-end",
  values: { length: 120, width: 60, height: 150 },
  material: REFERENCE_MATERIALS["board-350"],
  materialId: null,
};

const handle: DesignerHandle = {
  stage: () => null,
  dieline: dielineOf(SPEC),
  save: async () => true,
  serverId: () => null,
  center: () => ({ x: 60, y: 120 }),
  catalog: null,
  mode: "local",
};

function mount(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="th" messages={{ common, designer }} timeZone="Asia/Bangkok">
      <DesignerContext.Provider value={handle}>{ui}</DesignerContext.Provider>
    </NextIntlClientProvider>,
  );
}

const s = () => useEditor.getState();

beforeEach(() => {
  const elements = [
    { ...newShape({ x: 40, y: 120 }, "rect"), id: "a" },
    { ...newShape({ x: 80, y: 120 }, "circle"), id: "b" },
    { ...newShape({ x: 120, y: 120 }, "rect"), id: "c" },
    { ...newText({ x: 60, y: 100 }, "ชาไทย"), id: "t", fill: "#00c2ff" },
    { ...newCode({ x: 60, y: 160 }, "ean13", "885000000001"), id: "q" },
  ] as DesignElement[];
  s().load({ id: "t", name: "test", spec: SPEC, content: { elements, pattern: { ...DEFAULT_PATTERN } } });
});

describe("layers panel", () => {
  const tree = () => screen.getByRole("tree", { name: "ชั้นขององค์ประกอบ บนสุดก่อน" });

  it("is a tree of the sides and their elements, topmost first, with the selection's lock", async () => {
    const { container } = mount(<LayersPanel />);
    const items = within(tree()).getAllByRole("treeitem");
    expect(items).toHaveLength(6);
    expect(items[0]).toHaveTextContent("ด้านนอก (5)");
    expect(items[2]).toHaveTextContent("ชาไทย");

    await userEvent.click(items[2]!);
    await userEvent.click(screen.getByRole("button", { name: "ล็อก ชาไทย" }));
    expect(s().content.elements.find((e) => e.id === "t")!.locked).toBe(true);
    expect(screen.getByRole("button", { name: "ปลดล็อก ชาไทย" })).toHaveAttribute("aria-pressed", "true");
    await expectNoA11yViolations(container);
  });

  it("moves by arrow keys, selects with Enter, Shift adding to the selection", async () => {
    mount(<LayersPanel />);
    const user = userEvent.setup();
    const [side, top] = within(tree()).getAllByRole("treeitem");
    side!.focus();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(top).toHaveFocus();
    expect(s().selectedIds).toEqual(["q"]);
    await user.keyboard("{ArrowDown}{Shift>}{Enter}{/Shift}");
    expect(s().selectedIds).toEqual(["q", "t"]);
    expect(within(tree()).getAllByRole("treeitem", { selected: true })).toHaveLength(2);
    await user.keyboard("{ArrowLeft}");
    expect(side).toHaveFocus();
  });
});

describe("checks panel", () => {
  it("says what is wrong in words and selects the element", async () => {
    const issues: DesignIssue[] = [
      { code: "low_resolution", severity: "error", elementId: "a", data: { dpi: 127, min: 300 } },
      { code: "crosses_fold", severity: "warning", elementId: "t" },
    ];
    const { container } = mount(<ChecksPanel issues={issues} />);
    expect(screen.getByRole("status")).toHaveTextContent("ต้องแก้ 1 รายการ · ควรตรวจ 1 รายการ");
    await userEvent.click(screen.getByRole("button", { name: /127 dpi ต่ำกว่า 300 dpi/ }));
    expect(s().selectedIds).toEqual(["a"]);
    await expectNoA11yViolations(container);
  });

  it("says so when there is nothing to fix", () => {
    mount(<ChecksPanel issues={[]} />);
    expect(screen.getByText("ไม่พบปัญหางานพิมพ์")).toBeInTheDocument();
  });
});

describe("arrange panel", () => {
  it("aligns a multi-selection to its left edge as one undo step, and groups it", async () => {
    s().selectMany(["a", "b", "c"]);
    mount(<ArrangePanel />);
    await userEvent.click(screen.getByRole("button", { name: "ชิดซ้าย" }));
    const xs = s()
      .content.elements.filter((e) => ["a", "b", "c"].includes(e.id))
      .map((e) => e.x);
    expect(new Set(xs).size).toBe(1);
    s().undo();
    expect(
      new Set(
        s()
          .content.elements.slice(0, 3)
          .map((e) => e.x),
      ).size,
    ).toBe(3);

    // Undo clears the selection; pick the three again to group them.
    act(() => s().selectMany(["a", "b", "c"]));
    await userEvent.click(screen.getByRole("button", { name: "จัดกลุ่ม" }));
    const groups = new Set(
      s()
        .content.elements.slice(0, 3)
        .map((e) => e.groupId),
    );
    expect(groups.size).toBe(1);
    expect([...groups][0]).toBeDefined();
  });
});

describe("properties panel", () => {
  it("warns about a colour that prints duller than on screen", () => {
    s().select("t");
    mount(<PropertiesPanel el={s().content.elements.find((e) => e.id === "t")!} />);
    expect(screen.getByText("สีนี้อาจพิมพ์ออกมาหม่นกว่าบนจอ")).toBeInTheDocument();
  });

  it("disables editing a locked element until it is unlocked", async () => {
    s().setLocked(["q"], true);
    const { rerender } = mount(<PropertiesPanel el={s().content.elements.find((e) => e.id === "q")!} />);
    expect(screen.getByText("ล็อกอยู่ — ปลดล็อกเพื่อย้ายหรือแก้ไข")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ลบ (Delete)" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "ปลดล็อก" }));
    expect(s().content.elements.find((e) => e.id === "q")!.locked).toBe(false);
    rerender(
      <NextIntlClientProvider locale="th" messages={{ common, designer }} timeZone="Asia/Bangkok">
        <DesignerContext.Provider value={handle}>
          <PropertiesPanel el={s().content.elements.find((e) => e.id === "q")!} />
        </DesignerContext.Provider>
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: "ลบ (Delete)" })).toBeEnabled();
  });

  it("is accessible for a barcode, with its check digit added", async () => {
    const el = s().content.elements.find((e) => e.id === "q")!;
    // 8·1 + 8·3 + 5·1 + 1·3 = 40 → check digit 0.
    expect(el.type === "code" && el.value).toBe("8850000000010");
    const { container } = mount(<PropertiesPanel el={el} />);
    expect(screen.getByRole("heading", { name: "บาร์โค้ด EAN-13" })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
