import ftCrash from "./data/ft-crash.json" with { type: "json" };
import ftFourflap from "./data/ft-fourflap.json" with { type: "json" };
import ftSeal from "./data/ft-seal.json" with { type: "json" };
import ftSnap from "./data/ft-snap.json" with { type: "json" };
import ftTuck from "./data/ft-tuck.json" with { type: "json" };
import teAirplaneCrash from "./data/te-airplane-crash.json" with { type: "json" };
import teAirplaneFourflap from "./data/te-airplane-fourflap.json" with { type: "json" };
import teAirplaneSeal from "./data/te-airplane-seal.json" with { type: "json" };
import teAirplaneSnap from "./data/te-airplane-snap.json" with { type: "json" };
import teAirplaneTuck from "./data/te-airplane-tuck.json" with { type: "json" };
import teReverseCrash from "./data/te-reverse-crash.json" with { type: "json" };
import teReverseFourflap from "./data/te-reverse-fourflap.json" with { type: "json" };
import teReverseSeal from "./data/te-reverse-seal.json" with { type: "json" };
import teReverseSnap from "./data/te-reverse-snap.json" with { type: "json" };
import teSealCrash from "./data/te-seal-crash.json" with { type: "json" };
import teSealSnap from "./data/te-seal-snap.json" with { type: "json" };
import teSealTuck from "./data/te-seal-tuck.json" with { type: "json" };
import teStraightFourflap from "./data/te-straight-fourflap.json" with { type: "json" };
import teStraightSeal from "./data/te-straight-seal.json" with { type: "json" };
import te2Airplane from "./data/te2-airplane.json" with { type: "json" };
import te2Reverse from "./data/te2-reverse.json" with { type: "json" };
import te2Straight from "./data/te2-straight.json" with { type: "json" };
import type { StyleRecipe } from "../types";

/**
 * The style library's recipes (U3.4 waves): every base structure beyond the core styles the
 * designer and configurator ship with (`recipes/index.ts`). Kept out of the package's main entry
 * — imported as `@packio/dieline/library` — so a page that only draws the core styles does not
 * carry the library's data (U3.1 follow-up). In the catalogue's reading order: category, then base.
 */
export const WAVE_RECIPES: readonly StyleRecipe[] = [
  ftCrash,
  ftFourflap,
  ftSeal,
  ftSnap,
  ftTuck,
  teAirplaneCrash,
  teAirplaneFourflap,
  teAirplaneSeal,
  teAirplaneSnap,
  teAirplaneTuck,
  teReverseCrash,
  teReverseFourflap,
  teReverseSeal,
  teReverseSnap,
  teSealCrash,
  teSealSnap,
  teSealTuck,
  teStraightFourflap,
  teStraightSeal,
  te2Airplane,
  te2Reverse,
  te2Straight,
] as unknown as StyleRecipe[];
