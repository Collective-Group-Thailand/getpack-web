import "server-only";

import { resolveStyleId } from "@packio/dieline";

import { serverRequests } from "@/lib/api/requests/server";
import type { HeroPreview, HeroShapePreset } from "@/lib/api/requests/store-hero";

import { candidates, pricedStep } from "./studio-hero";

/** Previews tried before the hero gives up on opening with a price (each is one engine run). */
const ATTEMPTS = 4;

/** One of the hero's shapes, as the catalogue backs it (D-310), with the studio style its dieline opens. */
export interface HeroShape extends HeroShapePreset {
  /** The `@packio/dieline` style the studio opens on; null when the dieline has none. */
  styleId: string | null;
}

export interface StudioHero {
  shapes: HeroShape[];
  /** The priced selection the panel opens on; null only when no preset prices at all. */
  initial: HeroPreview | null;
}

/**
 * The homepage Studio hero (Main board review, item 1): the presets packio-api reads from
 * `catalog.hero_presets` against the catalogue (`store.catalog.heroPresets`), and the first
 * selection priced by `store.quotes.preview` — the `store.quotes.calculate` path, so the price is
 * the configurator's. It opens on the API's `default`; when that preview fails it is logged and the
 * nearest quotable preset is tried, so the panel never opens on "no instant price".
 */
export async function getStudioHero(): Promise<StudioHero> {
  const api = await serverRequests("customer");
  const presets = await api.call("GET /v1/store/catalog/hero-presets").catch((error: unknown) => {
    console.warn("home hero: presets unavailable", error);
    return null;
  });
  const shapes = (presets?.shapes ?? []).map((shape) => ({ ...shape, styleId: resolveStyleId(shape.dielineKey) }));
  for (const selection of candidates(presets?.default ?? null, shapes).slice(0, ATTEMPTS)) {
    const preview = await api
      .call("POST /v1/store/quotes/actions/preview", { body: selection })
      .catch((error: unknown) => {
        console.warn("home hero: preview failed, trying the next preset", selection, error);
        return null;
      });
    if (preview && pricedStep(preview)) return { shapes, initial: preview };
    if (preview) console.warn("home hero: preset has no instant price, trying the next", selection);
  }
  return { shapes, initial: null };
}
