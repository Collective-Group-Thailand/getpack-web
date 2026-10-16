"use client";

import { createContext, useContext } from "react";
import type Konva from "konva";

import type { Dieline } from "@getpack/dieline";

import type { DesignerCatalog } from "../data/api";
import type { Persistence, PersistenceMode } from "../data/persistence";

/**
 * What a component placed into the designer's top bar by a zone (the customer's price and
 * "order this", prepress's "make a copy") may reach: the canvas, the dieline, and saving. The
 * designer stays zone-free; the zone's own component does the zone's calls.
 */
export interface DesignerHandle {
  stage: () => Konva.Stage | null;
  dieline: Dieline | null;
  save: Persistence["save"];
  serverId: () => string | null;
  /** The sheet point new elements are centred on: the middle of the view, or of the focused face. */
  center: () => { x: number; y: number };
  catalog: DesignerCatalog | null;
  mode: PersistenceMode;
}

export const DesignerContext = createContext<DesignerHandle | null>(null);

export function useDesigner(): DesignerHandle {
  const handle = useContext(DesignerContext);
  if (!handle) throw new Error("useDesigner must be used inside the designer");
  return handle;
}
