import { paperBag } from "./body/bag";
import { partitionSet } from "./body/partition";
import { polyMailer } from "./body/poly-mailer";
import { airplaneTuck, flipTop, fourFlapLock, openEnd, slitLock } from "./closure/wave-closures";
import { dieCutInsert, insertBody } from "./feature/insert";
import { displayHeader, lockCorners, telescopeLid } from "./feature/tray-features";
import { fingerNotch, vents } from "./feature/wave-features";
import type { ModuleDef } from "./types";

/** The modules the style library's waves add (U3.4) — registered by `@packio/dieline/library`. */
export const WAVE_MODULES: readonly ModuleDef[] = [
  insertBody,
  partitionSet,
  polyMailer,
  paperBag,
  airplaneTuck,
  fourFlapLock,
  flipTop,
  slitLock,
  openEnd,
  dieCutInsert,
  lockCorners,
  displayHeader,
  telescopeLid,
  vents,
  fingerNotch,
];
