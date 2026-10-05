import tuckEnd from "./overrides/tuck-end.json" with { type: "json" };
import reverseTuckEnd from "./overrides/reverse-tuck-end.json" with { type: "json" };
import snapLockBottom from "./overrides/snap-lock-bottom.json" with { type: "json" };
import crashLockBottom from "./overrides/crash-lock-bottom.json" with { type: "json" };
import sealEnd from "./overrides/seal-end.json" with { type: "json" };
import hangTabTuck from "./overrides/hang-tab-tuck.json" with { type: "json" };
import sleeve from "./overrides/sleeve.json" with { type: "json" };
import sleeveDrawer from "./overrides/sleeve-drawer.json" with { type: "json" };
import rsc from "./overrides/rsc.json" with { type: "json" };
import hsc from "./overrides/hsc.json" with { type: "json" };
import fol from "./overrides/fol.json" with { type: "json" };
import cssc from "./overrides/cssc.json" with { type: "json" };
import mailer from "./overrides/mailer.json" with { type: "json" };
import wrapAround from "./overrides/wrap-around.json" with { type: "json" };
import tray from "./overrides/tray.json" with { type: "json" };
import tray6Corner from "./overrides/tray-6-corner.json" with { type: "json" };
import doubleWallTray from "./overrides/double-wall-tray.json" with { type: "json" };
import telescope from "./overrides/telescope.json" with { type: "json" };
import pillow from "./overrides/pillow.json" with { type: "json" };
import hangTag from "./overrides/hang-tag.json" with { type: "json" };
import band from "./overrides/band.json" with { type: "json" };
import hexagonal from "./overrides/hexagonal.json" with { type: "json" };
import type { StyleRecipe } from "../types";

/**
 * Core styles as the style library extends them (U3.4): the same ids as `recipes/data/`, with the
 * master file's axes added (windows on the lid, inserts, joints, hand holes…) and the wave modules
 * they need. The main entry keeps the core versions the designer and configurator ship with; the
 * library entry (`ALL_RECIPES`, `registerLibrary()`) replaces them with these.
 */
export const OVERRIDE_RECIPES: readonly StyleRecipe[] = [
  tuckEnd,
  reverseTuckEnd,
  snapLockBottom,
  crashLockBottom,
  sealEnd,
  hangTabTuck,
  sleeve,
  sleeveDrawer,
  rsc,
  hsc,
  fol,
  cssc,
  mailer,
  wrapAround,
  tray,
  tray6Corner,
  doubleWallTray,
  telescope,
  pillow,
  hangTag,
  band,
  hexagonal,
] as unknown as StyleRecipe[];
