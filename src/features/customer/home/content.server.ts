import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { getHomeSections, type HomeSection } from "@/features/customer/catalog/api.server";
import { storeImageSrc } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import { homePhotosLocalManifest } from "@/lib/env/lazy-server";

import { fillEmptySlots, type LocalManifestAsset, photosFromManifest } from "./local-photos";

/**
 * The home page's CMS content (Phase 4, the V4 "Main" board), from the back office's home
 * sections (`/admin/cms/home-sections`). The contract leaves a section's `config` to the
 * storefront ("interpreted by the storefront"), so two `custom` sections carry the page's
 * editorial content — photos, captions, customer stories — and nothing on the page is invented
 * when one is missing. Everything priced or configurable (the hero panel's shapes, sizes, boards,
 * inks and quantities) is the catalogue's, never the CMS's (`studio-hero.server.ts`):
 *
 * - `home-photos` — every photo on the page, each with its alt text and a caption that describes
 *   the object only: `{ hero, mosaic: [5], process: [sample, packing], quality, templates: { <style code>: photo } }`.
 *   A block whose photos are missing is left out (the mosaic needs all five).
 * - `customer-cases` — customer stories: `{ cases: [{ approved, image, brand, province, item, quantity, days, quote }] }`.
 *   The section shows only when at least three are approved; never a placeholder.
 *
 * CONTRACT-REQUEST store.home-content — typed DTOs for these two would let the API validate
 * what an editor saves (docs/contract-requests.md); until then a malformed entry is skipped here.
 */

export interface HomePhoto {
  src: string;
  alt: string;
  caption: string | null;
}

export interface HomePhotos {
  hero: HomePhoto | null;
  mosaic: HomePhoto[] | null;
  process: { sample: HomePhoto | null; packing: HomePhoto | null };
  quality: HomePhoto | null;
  templates: Map<string, HomePhoto>;
}

export interface CustomerCase {
  image: HomePhoto;
  brand: string;
  province: string | null;
  item: string;
  quantity: number | null;
  days: number | null;
  quote: string;
}

/** How many approved cases the section needs before it shows (Phase 4 §4.2.6). */
export const MIN_CASES = 3;

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);
const count = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;

/** A localised field: `{ th, en }` or a plain string. */
function localised(locale: string, value: unknown): string | null {
  const both = record(value);
  if (both) return text(pick(locale, text(both.th) ?? "", text(both.en))) ?? text(both.th);
  return text(value);
}

/**
 * A photo the API serves (`/v1/store/catalog/images/…` or an absolute URL from the media store).
 * No alt text, no photo: a picture on this page always says what it shows.
 */
function photo(locale: string, value: unknown): HomePhoto | null {
  const entry = record(value);
  const src = storeImageSrc(text(entry?.url) ?? text(entry?.src));
  const alt = localised(locale, entry?.alt);
  if (!entry || !src || !alt) return null;
  return { src, alt, caption: localised(locale, entry.caption) };
}

function section(sections: HomeSection[], slug: string): Record<string, unknown> | null {
  const found = sections.find((candidate) => candidate.kind === "custom" && candidate.slug === slug);
  return found ? record(found.config) : null;
}

export interface HomeContent {
  photos: HomePhotos;
  cases: CustomerCase[];
}

/** The page's CMS content. A failed read is an empty page of extras, never a failed page. */
export async function getHomeContent(locale: string): Promise<HomeContent> {
  const sections = await getHomeSections().catch(() => [] as HomeSection[]);
  const photos = photosOf(locale, section(sections, "home-photos"));
  return {
    photos: (await homePhotosLocalManifest()) ? fillEmptySlots(photos, await localPhotos(locale)) : photos,
    cases: casesOf(locale, section(sections, "customer-cases")),
  };
}

let warned = false;

/** Dev only (`HOME_PHOTOS_LOCAL_MANIFEST=1`, refused in production): see `local-photos.ts`. */
async function localPhotos(locale: string): Promise<HomePhotos> {
  if (!warned) {
    warned = true;
    console.warn("home photos: local manifest fallback");
  }
  const manifest = await readFile(join(process.cwd(), "public", "media", "home", "manifest.json"), "utf8")
    .then((body) => JSON.parse(body) as { assets?: LocalManifestAsset[] })
    .catch(() => ({ assets: [] }));
  return photosFromManifest(locale, manifest.assets ?? []);
}

export function photosOf(locale: string, config: Record<string, unknown> | null): HomePhotos {
  const mosaic = Array.isArray(config?.mosaic) ? config.mosaic.map((item) => photo(locale, item)) : [];
  const process = record(config?.process);
  const templates = new Map<string, HomePhoto>();
  for (const [code, value] of Object.entries(record(config?.templates) ?? {})) {
    const found = photo(locale, value);
    if (found) templates.set(code, found);
  }
  return {
    hero: photo(locale, config?.hero),
    // Five or nothing: the board's grid is one tall picture and four beside it.
    mosaic: mosaic.length >= 5 && mosaic.slice(0, 5).every(Boolean) ? (mosaic.slice(0, 5) as HomePhoto[]) : null,
    process: { sample: photo(locale, process?.sample), packing: photo(locale, process?.packing) },
    quality: photo(locale, config?.quality),
    templates,
  };
}

export function casesOf(locale: string, config: Record<string, unknown> | null): CustomerCase[] {
  if (!Array.isArray(config?.cases)) return [];
  const cases = config.cases.flatMap((value): CustomerCase[] => {
    const entry = record(value);
    // Only a case the customer agreed to, with a photo of the real job and their own words.
    if (!entry || entry.approved !== true) return [];
    const image = photo(locale, entry.image);
    const brand = text(entry.brand);
    const item = localised(locale, entry.item);
    const quote = localised(locale, entry.quote);
    if (!image || !brand || !item || !quote) return [];
    return [
      {
        image,
        brand,
        province: localised(locale, entry.province),
        item,
        quantity: count(entry.quantity),
        days: count(entry.days),
        quote,
      },
    ];
  });
  return cases.length >= MIN_CASES ? cases : [];
}
