import { groupsOf, isProcessInk, optionsById, type Configurator, type StoreOption } from "@/features/customer/configurator/model";
import { isCorrugate, normaliseCorrugateSide } from "@/features/customer/configurator/print-model";
import { initialState, NO_DIMS, type ConfiguratorState } from "@/features/customer/configurator/state";
import { insideSize } from "@/features/designer/document";
import type { DesignContent, DesignSpec, StudioChoices } from "@/features/designer/types";

/**
 * What the artwork needs printed, read from the design (F4 C.4): nothing when the sheet is
 * blank, one colour per distinct flat colour, full colour (4) once there is a photo or more than
 * three colours.
 */
export function inferPrint(content: DesignContent): { printed: boolean; colours: number } {
  const colours = new Set<string>();
  let photo = false;
  for (const el of content.elements) {
    if (el.type === "image") photo = true;
    else if (el.type === "text") colours.add(el.fill.toLowerCase());
    else if (el.type === "code") {
      colours.add(el.fill.toLowerCase());
      colours.add(el.background.toLowerCase());
    } else {
      colours.add(el.fill.toLowerCase());
      if (el.strokeWidth > 0) colours.add(el.stroke.toLowerCase());
    }
  }
  if (content.pattern.kind === "solid") colours.add(content.pattern.color.toLowerCase());
  else if (content.pattern.kind !== "none")
    colours.add(content.pattern.color.toLowerCase()).add(content.pattern.background.toLowerCase());
  colours.delete("#ffffff");
  const printed = photo || colours.size > 0;
  return { printed, colours: photo || colours.size > 3 ? 4 : colours.size };
}

/** The distinct flat colours of the artwork (flexo spot mode counts them against its limit). */
export function artworkColours(content: DesignContent): number {
  return inferPrint(content).colours;
}

/**
 * The inks a side is printed with, by the print method chosen in ② (U4.2):
 * - `none` — nothing;
 * - `digital` / `offset` — the process (CMYK) ink, laid as one four-colour pass by the builder;
 * - `flexo` — spot inks, one per artwork colour, never more than the flexo limit Prepress set
 *   (`spot_colour_count.maxColours`, D-278) nor than the product offers;
 * - not chosen (`null`) — what the artwork needs, as the F4 designer inferred it.
 * A method chosen on purpose is priced as printed even before the artwork is placed.
 */
export function inksFor(
  inks: StoreOption[],
  content: DesignContent,
  method: StudioChoices["printMethod"],
  maxSpot: number | null,
): string[] {
  const need = inferPrint(content);
  const process = inks.find((ink) => isProcessInk(ink));
  const spots = inks.filter((ink) => !isProcessInk(ink));
  if (method === "none") return [];
  if (method === "digital" || method === "offset") return process ? [process.id] : spots.slice(0, 1).map((i) => i.id);
  if (method === "flexo") {
    const count = Math.max(1, need.colours);
    return spots.slice(0, maxSpot === null ? count : Math.min(count, maxSpot)).map((ink) => ink.id);
  }
  if (!need.printed) return [];
  if (need.colours >= 4 && process) return [process.id];
  const picked = spots.slice(0, need.colours).map((ink) => ink.id);
  return picked.length === 0 && process ? [process.id] : picked;
}

/**
 * The configurator's state for this design: its pattern, inside size and material, the inks of
 * each side by the studio's print method and sides, the coating and finishes chosen in ②, and the
 * quantity chosen on the dock. Everything else stays at the product's defaults. Pure, for tests.
 */
export function stateForDesign(
  configurator: Configurator,
  spec: DesignSpec,
  content: DesignContent,
  quantity: number,
  maxSpot: number | null = null,
): ConfiguratorState {
  const base = initialState(configurator);
  const size = insideSize(spec);
  const choices = { ...base.choices };
  const groups = groupsOf(configurator);
  const group = (kind: string) => groups.find((g) => g.kind === kind);
  const studio = spec.studio ?? {};
  const material = group("material")?.options.find((o) => o.id === spec.materialId);
  if (material) choices.material = [material.id];
  const inks = group("print_front")?.options ?? [];
  if (inks.length > 0) {
    const printed = inksFor(inks, content, studio.printMethod ?? null, maxSpot);
    const sides = studio.printSides ?? "outside";
    choices.print_front = sides === "outside" || sides === "both" ? printed : [];
    const backInks = group("print_back")?.options ?? [];
    if (backInks.length > 0)
      choices.print_back =
        sides === "inside" || sides === "both" ? inksFor(backInks, content, studio.printMethod ?? null, maxSpot) : [];
  }
  if (isCorrugate(configurator)) {
    // D-443: a corrugate side is one valid choice of the product's print model (what the artwork
    // needs beyond it is the team's to settle), so a design never asks for a refused combination.
    const byId = optionsById(configurator);
    for (const kind of ["print_front", "print_back"] as const)
      if (choices[kind]) choices[kind] = normaliseCorrugateSide(configurator, byId, kind, choices[kind]!);
  }
  const coating = group("coating_front")?.options.find((o) => o.id === studio.coatingId);
  if (studio.coatingId !== undefined) choices.coating_front = coating ? [coating.id] : [];
  const finishes = group("finish")?.options ?? [];
  if (studio.finishIds) choices.finish = studio.finishIds.filter((id) => finishes.some((o) => o.id === id));
  const pattern = configurator.patterns.find((p) => p.id === spec.patternId) ?? configurator.patterns[0];
  return {
    ...base,
    patternId: pattern?.id ?? null,
    sizeMode: "custom",
    standardSizeCode: null,
    dims: { ...NO_DIMS, l: size.length || null, w: size.width || null, d: size.height || null },
    // The engine draws the inside of the box (F4); the basis entered is kept for the record.
    basis: "internal",
    choices,
    quantities: [quantity],
    quantity,
    // Handed to the design service (U4.8): priced with the graphic design fee (D-286).
    designOption:
      studio.designService && configurator.design.options.includes("hired_design")
        ? "hired_design"
        : configurator.design.options.includes("online_designer")
          ? "online_designer"
          : base.designOption,
  };
}
