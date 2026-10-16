import { band, cone, flatShape } from "./body/flat";
import { pillowTube } from "./body/pillow";
import { pouchWeb } from "./body/pouch";
import { tray } from "./body/tray";
import { tube } from "./body/tube";
import { hingedLid } from "./closure/tray-closures";
import {
  crashLock,
  cssc,
  endFlaps,
  fol,
  gableHandle,
  polygonTuckLid,
  rsc,
  seal,
  snapLock123,
  tuck,
} from "./closure/tube-closures";
import { handHoles, hangHole, hangTab, rollOverWalls, thumbNotch, windowFeature } from "./feature/features";
import { lidAndBase, sleeveAndDrawer } from "./pieceSet/piece-sets";
import { PLANNED_MODULES } from "./planned";
import type { ModuleDef } from "./types";

/** Every module, implemented first (body, closure, feature, piece set), then the planned ones. */
export const MODULES: ModuleDef[] = [
  tube,
  tray,
  pillowTube,
  flatShape,
  band,
  cone,
  pouchWeb,
  tuck,
  rsc,
  fol,
  cssc,
  endFlaps,
  seal,
  snapLock123,
  crashLock,
  gableHandle,
  polygonTuckLid,
  hingedLid,
  windowFeature,
  thumbNotch,
  hangTab,
  handHoles,
  rollOverWalls,
  hangHole,
  lidAndBase,
  sleeveAndDrawer,
  ...PLANNED_MODULES,
];

const BY_ID = new Map(MODULES.map((m) => [m.id, m]));

/**
 * Adds modules after load — the style library's (`@getpack/dieline/library`), kept out of the main
 * entry with the recipes that use them (U3.4). A module declared `planned` is replaced.
 */
export function registerModules(defs: readonly ModuleDef[]): void {
  for (const def of defs) {
    const at = MODULES.findIndex((m) => m.id === def.id);
    if (at >= 0) MODULES[at] = def;
    else MODULES.push(def);
    BY_ID.set(def.id, def);
  }
}

export function getModule(id: string): ModuleDef | undefined {
  return BY_ID.get(id);
}

export * from "./types";
