import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { NextIntlClientProvider } from "next-intl";
import { faceBounds, findFace, REFERENCE_MATERIALS, SPEC_VERSION } from "@packio/dieline";

import common from "@/i18n/messages/th/common/common.json";
import designer from "@/i18n/messages/th/customer/designer.json";

import { DEFAULT_PATTERN } from "../../catalog";
import { dielineOf } from "../../document";
import { newCode, newShape, newText } from "../../lib/create";
import { useDesignIssues } from "../../lib/useIssues";
import { useEditor } from "../../store/editor";
import type { DesignElement, DesignSpec, ImageElement } from "../../types";
import { DesignerContext, type DesignerHandle } from "../DesignerContext";
import { ArrangePanel } from "./ArrangePanel";
import { BoxPanel } from "./BoxPanel";
import { ChecksPanel } from "./ChecksPanel";
import { ElementsPanel } from "./ElementsPanel";
import { LayersPanel } from "./LayersPanel";
import { PropertiesPanel } from "./PropertiesPanel";

/*
 * The designer's panels in fixed states, for the visual regression suite (F4 Part E): a known box,
 * known elements, no canvas. Each story loads the editor store itself, so a story never depends on
 * the one before it.
 */

const SPEC: DesignSpec = {
  specVersion: SPEC_VERSION,
  styleId: "tuck-end",
  values: { length: 120, width: 60, height: 150 },
  material: REFERENCE_MATERIALS["board-350"],
  materialId: null,
  materialName: "อาร์ตการ์ด 350 แกรม",
  boardColour: "#ffffff",
};
const DIELINE = dielineOf(SPEC);
/** The front panel: the sample artwork sits on it, so the checks describe the artwork, not the sheet. */
const FRONT = faceBounds(findFace(DIELINE, "front")!);
const at = (fx: number, fy: number) => ({ x: FRONT.x + FRONT.width * fx, y: FRONT.y + FRONT.height * fy });

/** A 400 px wide photo shown 80 mm wide: 127 dpi, below the 300 dpi rule. */
const PHOTO: Omit<ImageElement, "id"> = {
  type: "image",
  src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='400' height='300' fill='%230f5f58'/></svg>",
  naturalWidth: 400,
  naturalHeight: 300,
  x: FRONT.x + 4,
  y: FRONT.y + 4,
  width: 80,
  height: 60,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  crop: { x: 0.1, y: 0, width: 0.8, height: 1 },
};

function elements(): DesignElement[] {
  const heading = { ...newText(at(0.5, 0.55), "ชาไทยโบราณ"), id: "heading", name: "ชื่อสินค้า" };
  const small = { ...newText(at(0.5, 0.72), "ส่วนประกอบ: ใบชา 100%", "body"), id: "small", fontSize: 1.6 };
  const vivid = { ...newShape(at(0.5, 0.85), "rect"), id: "badge", fill: "#00c2ff" };
  const qr = { ...newCode(at(0.5, 0.97), "qr", "https://packio.example/p/123"), id: "qr", locked: true };
  const photo = { ...PHOTO, id: "photo" };
  return [heading, small, vivid, qr, photo] as DesignElement[];
}

const handle: DesignerHandle = {
  stage: () => null,
  dieline: DIELINE,
  save: async () => true,
  serverId: () => null,
  center: () => at(0.5, 0.5),
  catalog: null,
  mode: "local",
};

/** Loads the editor with the sample design and a selection, before the story renders. */
const load =
  (selected: string[] = []) =>
  () => {
    useEditor.getState().load({
      id: "story",
      name: "กล่องชา",
      spec: SPEC,
      content: { elements: elements(), pattern: { ...DEFAULT_PATTERN } },
    });
    useEditor.getState().selectMany(selected);
  };

const withDesigner: Decorator = (Story) => (
  <NextIntlClientProvider locale="th" messages={{ common, designer }} timeZone="Asia/Bangkok">
    <DesignerContext.Provider value={handle}>
      <div className="bg-surface w-80 p-4">
        <Story />
      </div>
    </DesignerContext.Provider>
  </NextIntlClientProvider>
);

const meta = {
  title: "Designer/Panels",
  decorators: [withDesigner],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The online designer's side panels (F4 Part D) in fixed states — the visual baseline for " +
          "the editor. Live in `src/features/designer`, not the design system: they read the editor store and messages.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const selectedElement = (id: string) => useEditor.getState().content.elements.find((e) => e.id === id)!;

export const TextProperties: Story = {
  beforeEach: load(["small"]),
  render: () => <PropertiesPanel el={selectedElement("small")} />,
};

export const ImageProperties: Story = {
  beforeEach: load(["photo"]),
  render: () => <PropertiesPanel el={selectedElement("photo")} />,
};

export const ShapeProperties: Story = {
  beforeEach: load(["badge"]),
  render: () => <PropertiesPanel el={selectedElement("badge")} />,
};

export const LockedCode: Story = {
  beforeEach: load(["qr"]),
  render: () => <PropertiesPanel el={selectedElement("qr")} />,
};

export const Arrange: Story = {
  beforeEach: load(["heading", "small", "badge"]),
  render: () => <ArrangePanel />,
};

function Checks() {
  const issues = useDesignIssues(DIELINE, null);
  return <ChecksPanel issues={issues} />;
}

export const PrintChecks: Story = {
  beforeEach: load(),
  render: () => <Checks />,
};

export const Layers: Story = {
  beforeEach: load(["heading"]),
  render: () => <LayersPanel />,
};

export const Box: Story = {
  beforeEach: load(),
  render: () => <BoxPanel onOpenSetup={() => undefined} onOpenRules={() => undefined} />,
};

export const Elements: Story = {
  beforeEach: load(),
  render: () => <ElementsPanel />,
};
