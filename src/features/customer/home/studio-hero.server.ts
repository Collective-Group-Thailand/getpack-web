import "server-only";

import { resolveStyleId } from "@packio/dieline";

import { getConfigurator, listProducts, type Configurator } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { groupsOf, isProcessInk, sizeKindOf } from "@/features/customer/configurator/model";

import type { IsoShape } from "./iso-box";

/** How many shapes, sizes, boards and quantities the hero panel offers (the "Main" board). */
const SHAPES = 3;
const SIZES = 3;
const MATERIALS = 3;
const QUANTITIES = 4;

/**
 * One of the hero panel's shapes: a catalogue product priced online, with the presets its own
 * configurator publishes (`store.catalog.getConfigurator` — the endpoint `/configure` reads). The
 * CMS has no say in any of it (Phase 4 review): shapes, sizes, boards, inks and quantities are
 * the catalogue's.
 */
export interface HeroShapeSetup {
  productSlug: string;
  name: string;
  /** How the drawing tells it apart: a mailer's seam, a lid's rim, a tuck end. */
  drawing: IsoShape;
  configurator: Configurator;
  /** The `@packio/dieline` style the studio opens on, from the product's first pattern. */
  styleId: string | null;
  /** The product's standard sizes, in mm (inside size, D-182). */
  sizes: { code: string; l: number; w: number; d: number }[];
  materials: { id: string; name: string; tint: "kraft350" | "art350" | "corrE"; isDefault: boolean }[];
  /** Front inks for "1 colour" and "full colour", as option ids; null when the product has none. */
  inks: { one: string[] | null; full: string[] | null };
  quantities: number[];
}

/**
 * The hero panel's shapes: the first box products the catalogue prices online and gives standard
 * sizes, in the catalogue's own order. An empty list when there are none — the panel then only
 * points to the studio.
 */
export async function getStudioHeroSetup(locale: string): Promise<HeroShapeSetup[]> {
  const products = await listProducts({ perPage: 48 }).catch(() => null);
  const candidates = (products?.data ?? []).filter((product) => product.availability !== "rfq");
  const configurators = await Promise.all(
    candidates.slice(0, 12).map((product) => getConfigurator(product.slug).catch(() => null)),
  );
  const shapes: HeroShapeSetup[] = [];
  candidates.slice(0, 12).forEach((product, index) => {
    const configurator = configurators[index];
    if (shapes.length >= SHAPES || !configurator?.instant) return;
    if (sizeKindOf(configurator) !== "box" || configurator.standardSizes.length === 0) return;
    const groups = groupsOf(configurator);
    const materials = groups.find((group) => group.kind === "material")?.options ?? [];
    const inks = groups.find((group) => group.kind === "print_front")?.options ?? [];
    const one = inks.find((option) => !isProcessInk(option) && option.isDefault) ?? inks.find((o) => !isProcessInk(o));
    const full = inks.find(isProcessInk);
    const { min, max, presets } = configurator.quantity;
    const corrugated = configurator.calculator === "corrugate";
    shapes.push({
      productSlug: product.slug,
      name: pick(locale, product.nameTh, product.nameEn),
      drawing: corrugated ? "mailer" : product.productTypeCode === "rigid_box" ? "lid" : "tuck",
      configurator,
      styleId: resolveStyleId(configurator.patterns[0]?.dielineKey),
      sizes: configurator.standardSizes
        .slice(0, SIZES)
        .map((size) => ({ code: size.code, l: size.lengthMm, w: size.widthMm, d: size.heightMm })),
      materials: materials.slice(0, MATERIALS).map((option) => ({
        id: option.id,
        name: pick(locale, option.nameTh, option.nameEn),
        tint: corrugated ? "corrE" : /kraft/i.test(option.code) ? "kraft350" : "art350",
        isDefault: option.isDefault,
      })),
      inks: { one: one ? [one.id] : null, full: full ? [full.id] : null },
      quantities: presets
        .filter((quantity) => (min === null || quantity >= min) && (max === null || quantity <= max))
        .slice(0, QUANTITIES),
    });
  });
  return shapes;
}
