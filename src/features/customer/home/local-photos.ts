import type { HomePhoto, HomePhotos } from "./content.server";

/**
 * The dev-only home-photo fallback (`HOME_PHOTOS_LOCAL_MANIFEST=1`): local stacks run packio-api with
 * fake, in-memory file storage, so the CMS cannot serve photos there. The same media manifest
 * packio-api's `pnpm cms:home-photos` uploads in UAT and production names each photo's place by
 * `position`; this maps those positions to `/media/home/*` and fills only the slots the CMS left empty.
 * The production build refuses these files (`build-checks/no-untracked-third-party-assets.mjs`) and the
 * env schema refuses the flag in production.
 */

export interface LocalManifestAsset {
  file: string;
  position: string;
  /** For `template-<name>` positions: the style code the photo shows. */
  styleCode?: string;
  altTh: string;
  altEn?: string;
  captionTh?: string;
  captionEn?: string;
}

const STYLE_CODE = /^PK-[A-Z0-9]{2,8}-[0-9]{2,3}$/;
const MOSAIC_SIZE = 5;

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

function photo(locale: string, base: string, asset: LocalManifestAsset): HomePhoto | null {
  const alt = (locale === "en" ? text(asset.altEn) : null) ?? text(asset.altTh);
  if (!alt || !text(asset.file)) return null;
  const caption = (locale === "en" ? text(asset.captionEn) : null) ?? text(asset.captionTh);
  return { src: `${base}/${encodeURIComponent(asset.file)}`, alt, caption };
}

/** The manifest's photos in the page's shape (positions as in packio-api's `home-photos.ts`). */
export function photosFromManifest(locale: string, assets: LocalManifestAsset[], base = "/media/home"): HomePhotos {
  const photos: HomePhotos = {
    hero: null,
    mosaic: null,
    process: { sample: null, packing: null },
    quality: null,
    templates: new Map(),
  };
  const mosaic: (HomePhoto | null)[] = Array.from({ length: MOSAIC_SIZE }, () => null);
  for (const asset of assets) {
    const found = photo(locale, base, asset);
    if (!found) continue;
    const position = asset.position;
    const tile = /^mosaic-([1-5])$/.exec(position);
    if (position === "hero") photos.hero = found;
    else if (position === "sage") photos.quality = found;
    else if (position === "frame-4") photos.process.sample = found;
    else if (position === "frame-9") photos.process.packing = found;
    else if (tile) mosaic[Number(tile[1]) - 1] = found;
    else if (position.startsWith("template-")) {
      const name = position.slice("template-".length);
      const code = STYLE_CODE.test(name) ? name : asset.styleCode;
      if (code && STYLE_CODE.test(code)) photos.templates.set(code, found);
    }
  }
  photos.mosaic = mosaic.every(Boolean) ? (mosaic as HomePhoto[]) : null;
  return photos;
}

/** `cms` with every empty slot filled from `local`; a CMS photo always wins. */
export function fillEmptySlots(cms: HomePhotos, local: HomePhotos): HomePhotos {
  const templates = new Map(local.templates);
  for (const [code, value] of cms.templates) templates.set(code, value);
  return {
    hero: cms.hero ?? local.hero,
    mosaic: cms.mosaic ?? local.mosaic,
    process: {
      sample: cms.process.sample ?? local.process.sample,
      packing: cms.process.packing ?? local.process.packing,
    },
    quality: cms.quality ?? local.quality,
    templates,
  };
}
