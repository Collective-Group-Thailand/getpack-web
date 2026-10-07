import "server-only";

import { resolveStyleId } from "@packio/dieline";

import {
  getConfigurator,
  getProduct,
  getProductTypes,
  type Configurator,
} from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { rfqHref } from "@/features/customer/catalog/paths";
import { groupsOf, isProcessInk } from "@/features/customer/configurator/model";

import {
  HERO_MATERIALS,
  HERO_SHAPES,
  type HeroMaterial,
  type HeroShape,
  type StudioHeroConfig,
} from "./content.server";

/** One of the panel's shapes, resolved against the catalogue product the CMS names for it. */
export interface HeroShapeSetup {
  key: HeroShape;
  productSlug: string;
  /**
   * The product's configurator — the very one `/configure/<slug>` prices with. `null` when the
   * product is quoted by hand (D-043): the panel then offers the request-for-quote path instead.
   */
  configurator: Configurator | null;
  /** Where "request a quote" goes when there is no instant price. */
  rfqHref: string;
  /** The `@packio/dieline` style the studio opens on, from the product's first pattern. */
  styleId: string | null;
  /** Each material chip as this product offers it — its option id and its own name — or absent. */
  materials: Partial<Record<HeroMaterial, { id: string; name: string }>>;
  /** Front inks for "1 colour" and "full colour", as option ids; absent when the product has none. */
  inks: { one: string[] | null; full: string[] | null };
}

/**
 * The hero panel's catalogue, from the `studio-hero` home section: each shape's product and its
 * configurator, and each chip's option on that product. A chip whose option the product does not
 * offer is left out for that shape — the panel disables it rather than price something else.
 */
export async function getStudioHeroSetup(config: StudioHeroConfig, locale: string): Promise<HeroShapeSetup[]> {
  const shapes = HERO_SHAPES.flatMap((key) => (config.shapes[key] ? [{ key, slug: config.shapes[key] }] : []));
  const types = await getProductTypes().catch(() => []);
  return Promise.all(
    shapes.map(async ({ key, slug }): Promise<HeroShapeSetup> => {
      const [configurator, product] = await Promise.all([
        getConfigurator(slug).catch(() => null),
        getProduct(slug).catch(() => null),
      ]);
      const groups = configurator ? groupsOf(configurator) : [];
      const materialOptions = groups.find((group) => group.kind === "material")?.options ?? [];
      const inkOptions = groups.find((group) => group.kind === "print_front")?.options ?? [];
      const byCode = (codes: string[] | undefined, options: typeof materialOptions) =>
        (codes ?? []).map((code) => options.find((option) => option.code === code)).find(Boolean) ?? null;

      const materials: HeroShapeSetup["materials"] = {};
      for (const material of HERO_MATERIALS) {
        const option = byCode(config.materials[material], materialOptions);
        if (option) materials[material] = { id: option.id, name: pick(locale, option.nameTh, option.nameEn) };
      }
      // "Full colour" is the process ink when the CMS names none; "1 colour" must be named.
      const one = byCode(config.prints.one, inkOptions);
      const full = byCode(config.prints.full, inkOptions) ?? inkOptions.find(isProcessInk) ?? null;
      const type = types.find((candidate) => candidate.code === product?.productTypeCode);
      return {
        key,
        productSlug: slug,
        configurator: configurator?.instant ? configurator : null,
        rfqHref: `${rfqHref(type?.categoryCode ?? product?.productTypeCode ?? "")}?from=${encodeURIComponent(slug)}`,
        styleId: resolveStyleId(configurator?.patterns[0]?.dielineKey),
        materials,
        inks: { one: one ? [one.id] : null, full: full ? [full.id] : null },
      };
    }),
  );
}
