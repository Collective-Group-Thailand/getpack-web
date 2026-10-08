/**
 * `no-untracked-third-party-assets` — every image under `public/media/` is listed in the
 * `manifest.json` of its folder with a licence we can name (CLAUDE.md: never copy third-party
 * assets without a record). An unlisted image, or one whose `source` is not a known licence
 * (`interim-unverified`, missing), fails a production build; `next.config.ts` runs this check.
 *
 * Manifest shape (shared with packio-api's `pnpm cms:home-photos`):
 * `{ assets: [{ file, position, source, altTh, captionTh? }] }`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** Sources a production build accepts: free-commercial-use libraries and Packio's own photos. */
export const ALLOWED_SOURCES = ["pexels", "unsplash", "packio"];

const IMAGE = /\.(jpe?g|png|webp|avif|gif|svg)$/i;

function folders(dir) {
  if (!existsSync(dir)) return [];
  return [
    dir,
    ...readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? folders(path) : [];
    }),
  ];
}

/** The problems under `<root>/public/media`, one line each; empty when every image is tracked. */
export function checkThirdPartyAssets(root = process.cwd()) {
  const media = join(root, "public", "media");
  const problems = [];
  for (const dir of folders(media)) {
    const images = readdirSync(dir).filter((name) => IMAGE.test(name));
    if (images.length === 0) continue;
    const where = relative(root, dir);
    const manifestPath = join(dir, "manifest.json");
    let assets = [];
    if (existsSync(manifestPath)) {
      try {
        assets = JSON.parse(readFileSync(manifestPath, "utf8")).assets ?? [];
      } catch {
        problems.push(`${where}/manifest.json: not valid JSON`);
        continue;
      }
    }
    for (const image of images) {
      const entries = assets.filter((asset) => asset?.file === image);
      if (entries.length === 0) {
        problems.push(`${where}/${image}: not listed in ${where}/manifest.json`);
        continue;
      }
      const bad = entries.find((asset) => !ALLOWED_SOURCES.includes(asset.source));
      if (bad) {
        problems.push(
          `${where}/${image}: source "${bad.source ?? "(none)"}" is not one of ${ALLOWED_SOURCES.join(", ")}`,
        );
      }
    }
  }
  return problems;
}

/** Throws with every problem listed — for the production build. */
export function assertThirdPartyAssets(root = process.cwd()) {
  const problems = checkThirdPartyAssets(root);
  if (problems.length > 0) {
    throw new Error(
      `no-untracked-third-party-assets: ${problems.length} image(s) under public/media cannot ship:\n` +
        problems.map((line) => `  - ${line}`).join("\n"),
    );
  }
}
