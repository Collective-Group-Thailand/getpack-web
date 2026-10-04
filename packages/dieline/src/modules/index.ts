import { band, cone, flatShape } from "./body/flat";
import { pillowTube } from "./body/pillow";
import { pouchWeb } from "./body/pouch";
import { tray } from "./body/tray";
import { tube } from "./body/tube";
import { hingedLid } from "./closure/tray-closures";
import { airplaneTuck, flipTop, fourFlapLock, slitLock } from "./closure/wave-closures";
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
import { dieCutInsert } from "./feature/insert";
import { lidAndBase, sleeveAndDrawer } from "./pieceSet/piece-sets";
import { PLANNED_MODULES } from "./planned";
import type { ModuleDef } from "./types";

/** Every module, implemented first (body, closure, feature, piece set), then the planned ones. */
export const MODULES: readonly ModuleDef[] = [
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
  airplaneTuck,
  fourFlapLock,
  flipTop,
  slitLock,
  windowFeature,
  thumbNotch,
  hangTab,
  handHoles,
  rollOverWalls,
  hangHole,
  dieCutInsert,
  lidAndBase,
  sleeveAndDrawer,
  ...PLANNED_MODULES,
];

const BY_ID = new Map(MODULES.map((m) => [m.id, m]));

export function getModule(id: string): ModuleDef | undefined {
  return BY_ID.get(id);
}

export * from "./types";
