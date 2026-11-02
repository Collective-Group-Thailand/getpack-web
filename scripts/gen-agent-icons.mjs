/**
 * getpack Agent's home-screen icons (D-467), drawn from the brand mark in `src/app/icon.svg` on the light theme's
 * primary green (`primary-600`, src/ui/tokens/primitives.ts). Run once after a brand change:
 *   node scripts/gen-agent-icons.mjs
 * `any` icons keep the mark's rounded tile; the maskable one and the apple-touch icon are full-bleed (the platform
 * draws the mask) with the mark inside the 80 % safe zone.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const PRIMARY = "#17573F";
const source = readFileSync(new URL("../src/app/icon.svg", import.meta.url), "utf8");
// The mark itself: the glyph group inside the 32 × 32 tile.
const mark = source.slice(source.indexOf("<g transform"), source.lastIndexOf("</svg>"));

function svg(size, { rounded, scale }) {
  const inset = (32 * (1 - scale)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">
  <rect width="32" height="32" ${rounded ? 'rx="7"' : ""} fill="${PRIMARY}"/>
  <g transform="translate(${inset} ${inset}) scale(${scale})">${mark}</g>
</svg>`;
}

const out = (name) => new URL(`../public/agent-app/${name}`, import.meta.url).pathname;
await sharp(Buffer.from(svg(192, { rounded: true, scale: 1 }))).png().toFile(out("icon-192.png"));
await sharp(Buffer.from(svg(512, { rounded: true, scale: 1 }))).png().toFile(out("icon-512.png"));
await sharp(Buffer.from(svg(512, { rounded: false, scale: 0.72 }))).png().toFile(out("icon-maskable-512.png"));
await sharp(Buffer.from(svg(180, { rounded: false, scale: 0.86 }))).png().toFile(out("apple-touch-icon.png"));
