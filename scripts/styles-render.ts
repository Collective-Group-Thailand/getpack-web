/**
 * The style asset pipeline (U3.3 §3, ADR-0012): for every structural variant of every recipe, the
 * dieline SVG, a 2D thumbnail and 3D thumbnails on kraft and white board, drawn by the engine's own
 * rasteriser — no browser, no GPU, so the bytes are reproducible — plus a manifest with each
 * asset's sha256, the generated names and their review state.
 *
 *   pnpm styles:render           writes packages/dieline/generated/
 *   pnpm styles:render --check   renders to a temporary folder and fails if the manifest differs
 *
 * Only `generated/manifest.json` is committed; the images are build output, published with the
 * package and uploaded by the API's drawing service (U3.B5).
 */
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";

import {
  buildFromRecipe,
  defaultsOf,
  describeVariant,
  dielineToSvg,
  explain,
  inflatedPouch,
  presetsOf,
  recipeProcesses,
  RECIPES,
  REFERENCE_BY_CATEGORY,
  REFERENCE_MATERIALS,
  render2D,
  render3D,
  renderSurface,
  variantsOf,
  type Image,
  type StyleRecipe,
} from "@packio/dieline";

const PACKAGE = new URL("../packages/dieline/", import.meta.url).pathname;
const MANIFEST = join(PACKAGE, "generated", "manifest.json");
const SIZE = 320;
const check = process.argv.includes("--check");

/** PNG (8-bit RGBA, no filter) — enough for thumbnails, and deterministic. */
function png(img: Image): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(img.width, 0);
  header.writeUInt32BE(img.height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.alloc((img.width * 4 + 1) * img.height);
  for (let y = 0; y < img.height; y++) {
    rows[y * (img.width * 4 + 1)] = 0;
    rows.set(img.data.subarray(y * img.width * 4, (y + 1) * img.width * 4), y * (img.width * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const slug = (key: string) => key.replace(/=/g, "-").replace(/;/g, "__") || "standard";

function render(out: string) {
  const version = JSON.parse(readFileSync(join(PACKAGE, "package.json"), "utf8")).version as string;
  const entries = [];
  for (const recipe of RECIPES as readonly StyleRecipe[]) {
    const materialId = REFERENCE_BY_CATEGORY[recipe.category][0];
    const material = REFERENCE_MATERIALS[materialId];
    for (const variant of variantsOf(recipe)) {
      const words = describeVariant(recipe, variant);
      // The first preset this variant is makeable at (a window needs a panel wide enough).
      const preset = presetsOf(recipe).find(
        (p) => !explain(recipe, { ...p.values, ...variant.values }, material).some((x) => x.severity === "error"),
      );
      const entry = {
        style: recipe.id,
        base: recipe.base ?? null,
        variant: variant.key,
        axes: variant.axes,
        name: words.name,
        description: words.description,
        reviewStatus: words.reviewStatus,
        processes: recipeProcesses(recipe),
        recipeSha256: sha256(JSON.stringify(recipe)),
        material: materialId,
        preset: preset?.id ?? null,
        values: preset ? { ...defaultsOf(recipe), ...preset.values, ...variant.values } : null,
        assets: {} as Record<string, string>,
      };
      if (preset) {
        const values = entry.values!;
        const built = buildFromRecipe(recipe, values, material);
        const dir = join(out, recipe.id, slug(variant.key));
        mkdirSync(dir, { recursive: true });
        const files: Record<string, string | Buffer> = {
          "dieline.svg": dielineToSvg(built.dieline),
          "thumb-2d.png": png(render2D(built.dieline, "white", { size: SIZE })),
        };
        if (built.hinges) {
          files["thumb-3d-kraft.png"] = png(render3D(built.dieline, built.hinges, material, "kraft", { size: SIZE }));
          files["thumb-3d-white.png"] = png(render3D(built.dieline, built.hinges, material, "white", { size: SIZE }));
        } else if (recipe.body?.module === "pouchWeb") {
          const mesh = inflatedPouch(values);
          files["thumb-3d-kraft.png"] = png(renderSurface(mesh, "kraft", { size: SIZE }));
          files["thumb-3d-white.png"] = png(renderSurface(mesh, "white", { size: SIZE }));
        }
        for (const [name, data] of Object.entries(files)) {
          writeFileSync(join(dir, name), data);
          entry.assets[`${recipe.id}/${slug(variant.key)}/${name}`] = sha256(data);
        }
      }
      entries.push(entry);
      process.stdout.write(".");
    }
  }
  process.stdout.write("\n");
  const manifest = {
    $comment:
      "Generated by `pnpm styles:render` (U3.3, ADR-0012) — do not edit. Names are pending until approved (D-212).",
    engine: version,
    variants: entries.length,
    rendered: entries.filter((e) => e.preset).length,
    entries,
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

if (check) {
  const out = mkdtempSync(join(tmpdir(), "styles-render-"));
  try {
    const fresh = render(out);
    const committed = readFileSync(MANIFEST, "utf8");
    if (fresh !== committed) {
      console.error(
        "generated/manifest.json is out of date or the render is not reproducible — run pnpm styles:render.",
      );
      process.exit(1);
    }
    console.log("styles:render is reproducible and the manifest is current.");
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
} else {
  const out = join(PACKAGE, "generated");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const manifest = render(out);
  writeFileSync(MANIFEST, manifest);
  console.log(`wrote ${out}`);
}
