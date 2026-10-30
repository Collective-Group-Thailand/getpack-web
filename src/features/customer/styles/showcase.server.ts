import "server-only";

import { listStyles } from "@/features/customer/catalog/api.server";
import { storeImageSrc } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import type { ShowcasePhoto } from "@/ui/components/HeroShowcase";

import { illustrationOf } from "./illustration";

/**
 * Three real product photos for a hero's showcase (owner direction 2026-10-30): the library's most popular styles
 * that have a photo, one per category where the list allows, so the composition shows a range of boxes. `from`
 * starts the pick further down the list, so two pages do not show the same three. A style without a photo, or an
 * API that does not answer, leaves its place to the thin-line drawing (`src: null`).
 */
export async function showcasePhotos(locale: string, from = 0): Promise<ShowcasePhoto[]> {
  const list = await listStyles({ sort: "popular", limit: 24 }).catch(() => null);
  const styles = (list?.data ?? []).slice(from).concat((list?.data ?? []).slice(0, from));
  const withPhoto = styles.filter((style) => storeImageSrc(style.thumbnailUrl, "full"));
  const picked: typeof styles = [];
  for (const style of withPhoto)
    if (picked.length < 3 && !picked.some((chosen) => chosen.category === style.category)) picked.push(style);
  for (const style of withPhoto) if (picked.length < 3 && !picked.includes(style)) picked.push(style);
  const photos: ShowcasePhoto[] = picked.map((style) => ({
    src: storeImageSrc(style.thumbnailUrl, "full"),
    alt: pick(locale, style.nameTh, style.nameEn),
    family: illustrationOf(style),
  }));
  // Fewer than three photos: the drawings of a shipping box, a carton and a rigid box fill the places.
  const families = ["shipping", "tuck", "rigid"] as const;
  while (photos.length < 3) photos.push({ src: null, alt: "", family: families[photos.length]! });
  return photos;
}
