import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REFERENCE_MATERIALS, SPEC_VERSION } from "@getpack/dieline";

import common from "@/i18n/messages/th/common/common.json";
import designer from "@/i18n/messages/th/customer/designer.json";
import { expectNoA11yViolations } from "@/ui/test/axe";

import { DEFAULT_PATTERN } from "../../catalog";
import { dielineOf } from "../../document";
import { newText } from "../../lib/create";
import { useEditor } from "../../store/editor";
import type { DesignSpec } from "../../types";
import { DesignerContext, type DesignerHandle } from "../DesignerContext";
import { EasyInspector } from "./EasyInspector";
import { ModeSwitch, StepNav } from "./TopBarParts";
import { WelcomeDialog } from "./WelcomeDialog";

// jsdom has no canvas to measure text with: a text's box is its characters × its size.
vi.mock("../../lib/measure", () => ({
  measureText: (el: { text: string; fontSize: number }) => ({
    width: el.text.length * el.fontSize * 0.6,
    height: el.fontSize * 1.25,
  }),
}));

const SPEC: DesignSpec = {
  specVersion: SPEC_VERSION,
  styleId: "rsc",
  values: { length: 150, width: 100, height: 80 },
  material: REFERENCE_MATERIALS["board-350"],
  materialId: null,
};
const handle: DesignerHandle = {
  stage: () => null,
  dieline: dielineOf(SPEC),
  save: async () => true,
  serverId: () => null,
  center: () => ({ x: 120, y: 90 }),
  catalog: null,
  mode: "admin",
};
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const mount = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="th" messages={{ common, designer }} timeZone="Asia/Bangkok">
        <DesignerContext.Provider value={handle}>{ui}</DesignerContext.Provider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  useEditor
    .getState()
    .load({ id: "d1", name: "แบบ", spec: SPEC, content: { elements: [], pattern: { ...DEFAULT_PATTERN } } });
});

describe("first-open chooser (C8 Phase 1 item 5)", () => {
  it("offers getpack's design team only where the product does, its revisions from the setting", async () => {
    const onPick = vi.fn();
    const { unmount } = mount(<WelcomeDialog open onPick={onPick} onClose={() => {}} designService={null} />);
    expect(screen.queryByText("ให้ทีม getpack ออกแบบให้")).toBeNull();
    unmount();
    mount(<WelcomeDialog open onPick={onPick} onClose={() => {}} designService={{ freeRevisions: 3 }} />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("แก้ไขฟรี 3 ครั้ง")).toBeTruthy();
    await userEvent.click(within(dialog).getByRole("button", { name: /โหมดมืออาชีพ/ }));
    expect(onPick).toHaveBeenCalledWith("pro");
    await userEvent.click(within(dialog).getByRole("button", { name: "อัปโหลดไฟล์ PDF หรือ .ai" }));
    expect(onPick).toHaveBeenCalledWith("file");
    await expectNoA11yViolations(dialog);
  });

  it("omits the revision count when the setting is unset", () => {
    mount(<WelcomeDialog open onPick={() => {}} onClose={() => {}} designService={{ freeRevisions: null }} />);
    expect(screen.queryByText(/แก้ไขฟรี/)).toBeNull();
  });
});

describe("top bar parts", () => {
  it("switches the mode as a radio group", async () => {
    const onMode = vi.fn();
    mount(<ModeSwitch mode="easy" onMode={onMode} />);
    expect(screen.getByRole("radio", { name: /ง่าย/ }).getAttribute("aria-checked")).toBe("true");
    await userEvent.click(screen.getByRole("radio", { name: /มืออาชีพ/ }));
    expect(onMode).toHaveBeenCalledWith("pro");
  });

  it("badges the check step red with must-fix findings, amber with advice only", () => {
    const { rerender } = mount(<StepNav step="design" onStep={() => {}} blocking={2} advice={1} />);
    expect(screen.getByText("ต้องแก้ 2 จุด")).toBeTruthy();
    rerender(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="th" messages={{ common, designer }} timeZone="Asia/Bangkok">
          <StepNav step="check" onStep={() => {}} blocking={0} advice={1} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText("ข้อแนะนำ 1 ข้อ")).toBeTruthy();
    expect(screen.getByRole("button", { current: "step" }).textContent).toContain("ตรวจงาน");
  });
});

describe("easy inspector (C8 Phase 2 items 2–3)", () => {
  const actions = { rail: vi.fn(), checks: vi.fn(), mockup: vi.fn() };

  it("guides in 4 steps with progress, each step a jump", async () => {
    mount(<EasyInspector issues={[]} actions={actions} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
    await userEvent.click(screen.getByRole("button", { name: /ใส่โลโก้ของคุณ/ }));
    expect(actions.rail).toHaveBeenCalledWith("brand");
    await userEvent.click(screen.getByRole("button", { name: /ตรวจงานและสั่งผลิต/ }));
    expect(actions.checks).toHaveBeenCalled();
  });

  it("edits a selected text in points and places it with the 9-cell grid inside its panel", async () => {
    useEditor.getState().addElement(newText({ x: 120, y: 90 }, "ขนมอบ", "subheading"));
    const el = useEditor.getState().content.elements[0]!;
    mount(<EasyInspector issues={[]} actions={actions} />);
    // 7 mm = 19.8 pt, shown as 20 pt
    expect(screen.getByText("20 pt")).toBeTruthy();
    const grid = screen.getByRole("group", { name: "วางตำแหน่งในแผง" });
    await userEvent.click(within(grid).getByRole("button", { name: "บนซ้าย" }));
    const moved = useEditor.getState().content.elements[0]!;
    expect(moved.x).not.toBe(el.x);
  });
});
