import { paperBag } from "./body/bag";
import { partitionSet } from "./body/partition";
import { polyMailer } from "./body/poly-mailer";
import { easel, envelope, foldedCard, paperTube, presentationFolder, pyramid, shrinkSleeve } from "./body/wave2-bodies";
import { coverFlaps, displayTop, osc, petal } from "./closure/wave2-closures";
import { floorDisplay, rigidCase, shoulderNeck } from "./pieceSet/wave2-piece-sets";
import {
  adhesiveStrip,
  bookletHinge,
  dispenser,
  neckHole,
  neckLock,
  partitionInsert,
  securityCuts,
  tamperTuck,
  tearLine,
  tearStrip,
  trayWindow,
} from "./feature/wave2-features";
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
  osc,
  trayWindow,
  securityCuts,
  neckHole,
  tearStrip,
  adhesiveStrip,
  dispenser,
  tearLine,
  tamperTuck,
  partitionInsert,
  foldedCard,
  displayTop,
  neckLock,
  presentationFolder,
  envelope,
  paperTube,
  coverFlaps,
  rigidCase,
  shoulderNeck,
  bookletHinge,
  shrinkSleeve,
  pyramid,
  petal,
  easel,
  floorDisplay,
];
