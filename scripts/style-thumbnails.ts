/**
 * Draws every `@packio/dieline` style to `docs/design-tool/styles/<id>.png` — the thumbnails in
 * the style-mapping table (F4 Part E) — plus `styles/_sheet.png`, all of them on one page for a
 * quick visual review. Each is the style's first preset on its category's reference board, cut
 * in red, creases dashed blue, glue areas in amber, on a white sheet.
 *
 *   pnpm style:thumbnails
 *
 * Rendering goes through Playwright's Chromium (already installed for e2e) so the SVG export
 * itself is what is pictured.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "@playwright/test";

import {
  dielineToSvg,
  getStyle,
  REFERENCE_BY_CATEGORY,
  REFERENCE_MATERIALS,
  resolveValues,
  STYLES,
} from "@packio/dieline";

const OUT = new URL("../docs/design-tool/styles/", import.meta.url).pathname;
const SIZE = 480;

function svgFor(id: string): string {
  const style = getStyle(id);
  const material = REFERENCE_MATERIALS[REFERENCE_BY_CATEGORY[style.category][0]];
  const d = style.build(resolveValues(style, style.presets[0].values), material);
  // Thicker strokes so a 480 px picture of a 1 m blank still shows its lines.
  const stroke = Math.max(0.35, Math.max(d.width, d.height) / 450);
  return dielineToSvg(d, { margin: Math.max(d.width, d.height) * 0.04, strokeMm: stroke });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
  const cells: string[] = [];
  for (const style of STYLES) {
    const svg = svgFor(style.id).replace(/width="[^"]+mm" height="[^"]+mm"/, `width="${SIZE}" height="${SIZE}"`);
    await page.setContent(
      `<html><body style="margin:0;background:#fff;display:grid;place-items:center;width:${SIZE}px;height:${SIZE}px">${svg.replace(/<\?xml[^>]*>/, "")}</body></html>`,
    );
    const png = await page.screenshot({ type: "png" });
    writeFileSync(join(OUT, `${style.id}.png`), png);
    cells.push(
      `<figure style="margin:0;border:1px solid #ddd;padding:4px;background:#fff"><img src="data:image/png;base64,${png.toString("base64")}" width="220" height="220"/><figcaption style="font:12px sans-serif;text-align:center">${style.id}</figcaption></figure>`,
    );
    console.log(`drew ${style.id}`);
  }
  await page.setViewportSize({ width: 1200, height: 1600 });
  await page.setContent(
    `<html><body style="margin:8px;display:grid;grid-template-columns:repeat(5,1fr);gap:6px;background:#f4f4f4">${cells.join("")}</body></html>`,
  );
  writeFileSync(join(OUT, "_sheet.png"), await page.screenshot({ type: "png", fullPage: true }));
  await browser.close();
}

void main();
