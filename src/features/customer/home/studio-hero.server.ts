import "server-only";

import { resolveStyleId } from "@packio/dieline";

import { publicApi } from "@/features/customer/catalog/api.server";
import { isApiError } from "@/lib/api/problem";

import {
  candidates,
  requestOf,
  selectionOfDefault,
  shapesOf,
  type HeroPriced,
  type HeroShapeView,
} from "./studio-hero";

/** Previews tried before the hero gives up on opening with a price (each is one engine run). */
const ATTEMPTS = 4;

/** One of the hero's shapes, as the catalogue backs it (D-310), with the studio style its dieline opens. */
export interface HeroShape extends HeroShapeView {
  /** The `@packio/dieline` style the studio opens on; null when the dieline has none. */
  styleId: string | null;
}

export interface StudioHero {
  shapes: HeroShape[];
  /** The priced selection the panel opens on; null when nothing could be priced. */
  initial: HeroPriced | null;
}

/** A failure the API may not repeat: a 5xx, a timeout, a dropped connection. */
const isServerFailure = (error: unknown) => !isApiError(error) || error.status >= 500;

/**
 * The homepage Studio hero (D-310): the presets packio-api reads from `catalog.hero_presets`
 * against the catalogue (`store.catalog.getHeroPresets`), and the first selection priced by
 * `store.quotes.preview` — the `store.quotes.calculate` path, so the price is the configurator's.
 *
 * It opens on the API's `default`, already the nearest offered selection when the owner's is not
 * (`defaultAdjusted`). Only a server failure (5xx) falls back to the next preset; a 4xx is the API
 * refusing a selection it offered itself, so it is logged and the panel opens without a price
 * rather than on another one.
 */
export async function getStudioHero(): Promise<StudioHero> {
  const presets = await (
    await publicApi("catalogue")
  )
    .GET("/v1/store/catalog/hero-presets")
    .then((response) => response.data ?? null)
    .catch((error: unknown) => {
      console.warn("home hero: presets unavailable", error);
      return null;
    });
  const shapes = shapesOf(presets).map((shape) => ({ ...shape, styleId: resolveStyleId(shape.dielineKey) }));
  const api = await publicApi("prices");
  for (const selection of candidates(selectionOfDefault(presets), shapes).slice(0, ATTEMPTS)) {
    const body = requestOf(selection, shapes);
    if (!body) break;
    try {
      const { data } = await api.POST("/v1/store/quotes/actions/preview", { body });
      if (data) return { shapes, initial: { selection, preview: data } };
    } catch (error) {
      if (!isServerFailure(error)) {
        console.error("home hero: the API refused a preset it offers", selection, error);
        break;
      }
      console.warn("home hero: preview failed, trying the next preset", selection, error);
    }
  }
  return { shapes, initial: null };
}
