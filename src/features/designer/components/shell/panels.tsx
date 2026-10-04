"use client";

import dynamic from "next/dynamic";

import type { IconName } from "@/ui/icons";

import { ArrangePanel } from "../panels/ArrangePanel";

import { BoxPanel } from "../panels/BoxPanel";

import { LayersPanel } from "../panels/LayersPanel";
import { PropertiesPanel } from "../panels/PropertiesPanel";

import { TextPanel } from "../panels/TextPanel";
import { UploadsPanel } from "../panels/UploadsPanel";
import { useEditor } from "../../store/editor";

// The content tools load when first opened (U4.4): templates, elements and codes, brand, background.
const TemplatesPanel = dynamic(() => import("../panels/TemplatesPanel").then((m) => m.TemplatesPanel), { ssr: false });
const ElementsPanel = dynamic(() => import("../panels/ElementsPanel").then((m) => m.ElementsPanel), { ssr: false });
const BrandPanel = dynamic(() => import("../panels/BrandPanel").then((m) => m.BrandPanel), { ssr: false });
const BackgroundPanel = dynamic(() => import("../panels/BackgroundPanel").then((m) => m.BackgroundPanel), { ssr: false });

/** The left rail's tools, in order. */
export const RAIL = [
  { id: "box", icon: "box" },
  { id: "templates", icon: "sparkles" },
  { id: "elements", icon: "star" },
  { id: "text", icon: "text" },
  { id: "uploads", icon: "images" },
  { id: "brand", icon: "palette" },
  { id: "background", icon: "pattern" },
  { id: "layers", icon: "layers" },
] as const satisfies readonly { id: string; icon: IconName }[];

export type RailId = (typeof RAIL)[number]["id"];

export function RailPanel({
  id,
  onOpenSetup,
  onOpenRules,
}: {
  id: RailId;
  onOpenSetup: () => void;
  onOpenRules: () => void;
}) {
  switch (id) {
    case "box":
      return <BoxPanel onOpenSetup={onOpenSetup} onOpenRules={onOpenRules} />;
    case "templates":
      return <TemplatesPanel />;
    case "elements":
      return <ElementsPanel />;
    case "text":
      return <TextPanel />;
    case "uploads":
      return <UploadsPanel />;
    case "brand":
      return <BrandPanel />;
    case "background":
      return <BackgroundPanel />;
    case "layers":
      return <LayersPanel />;
  }
}

/** The selection's panel: one element's properties, or arranging several. */
export function SelectionPanel({ empty }: { empty: React.ReactNode }) {
  const selectedIds = useEditor((s) => s.selectedIds);
  const selectedId = useEditor((s) => s.selectedId);
  const el = useEditor((s) => s.content.elements.find((e) => e.id === s.selectedId));
  if (selectedIds.length > 1) return <ArrangePanel />;
  if (el && selectedId) {
    return (
      <div className="space-y-6">
        <PropertiesPanel el={el} />
        <div className="border-border border-t pt-4">
          <ArrangePanel />
        </div>
      </div>
    );
  }
  return <>{empty}</>;
}
