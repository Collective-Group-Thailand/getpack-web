import type { MaterialSpec } from "@packio/dieline";

import type { Schemas } from "@/lib/api/types";

/*
 * The designer's view of a product's catalogue (`store.designer.getCatalog`, U-B0.1), read from the
 * published `DesignerCatalogDto` in one place, so the engine and the panels keep the units they
 * work in: a material's caliper in mm (the API sends microns), its kind as the engine names it,
 * the flute allowances as panel / flap / depth, a pattern's materials as ids. Nothing is computed
 * that the API does not send; what it does not send is left empty.
 */

type Dto = Schemas["DesignerCatalogDto"];

export interface DesignerMaterial {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string | null;
  kind: MaterialSpec["kind"];
  caliperMm: number;
  flute: string | null;
  allowances: { panel: number | null; flap: number | null; depth: number | null } | null;
  /** The board's own colour; the catalogue does not send one, so the engine's kind colour is used. */
  swatchHex: string | null;
}

export interface DesignerPattern {
  id: string;
  code: string;
  name: string;
  dielineKey: string | null;
  rules: {
    minLengthMm: number | null;
    maxLengthMm: number | null;
    minWidthMm: number | null;
    maxWidthMm: number | null;
    minHeightMm: number | null;
    maxHeightMm: number | null;
    lengthMustExceedWidth: boolean;
  };
  /** The corrugated boards this style is made in (by material id); empty = any. */
  materialIds: string[];
}

export type DesignerTemplate = Dto["templates"][number];

export interface DesignerCatalog {
  product: Dto["product"];
  patterns: DesignerPattern[];
  materials: DesignerMaterial[];
  templates: DesignerTemplate[];
  /** The palette of the product's semi-designs, as swatches. */
  colours: { hex: string; name: string }[];
  fonts: { id: string; family: string; fileUrl: string | null }[];
  /** Artwork rules (D-070), in the numbers the checks take. */
  rules: { bleedMm: number; safeMarginMm: number; minDpi: number };
  /** What an image upload accepts (`design_asset`). */
  assets: { accept: string[]; maxBytes: number; purpose: string };
}

/** The engine's material kind for a catalogue kind; corrugated whenever the board has a flute. */
function kindOf(material: Dto["materials"][number]): MaterialSpec["kind"] {
  if (material.flute) return "corrugated";
  const kind = material.kind.toLowerCase();
  if (["film", "foil", "flexible", "plastic"].includes(kind)) return "flexible";
  if (["label", "label_stock", "sticker"].includes(kind)) return "label";
  if (["rigid", "greyboard", "chipboard"].includes(kind)) return "rigid";
  return "paperboard";
}

/** A decimal string the API sends for a length, as the number the checks compare with. */
const mm = (value: string) => Number(value);

export function toCatalogView(dto: Dto): DesignerCatalog {
  const materials: DesignerMaterial[] = dto.materials.map((material) => ({
    id: material.id,
    code: material.code,
    nameTh: material.nameTh,
    nameEn: material.nameEn || null,
    kind: kindOf(material),
    // Microns, as the catalogue keeps `materials.micron`; a board without one is drawn by its kind.
    caliperMm: material.micron !== null ? material.micron / 1000 : 0.45,
    flute: material.flute?.code ?? null,
    allowances: material.flute
      ? { panel: material.flute.allowanceAMm, flap: material.flute.allowanceCMm, depth: material.flute.allowanceDdMm }
      : null,
    swatchHex: null,
  }));
  const colours = [...new Set(dto.templates.flatMap((template) => template.colours))];
  return {
    product: dto.product,
    materials,
    patterns: dto.patterns.map((pattern) => ({
      id: pattern.id,
      code: pattern.code,
      name: pattern.name,
      dielineKey: pattern.dielineKey,
      rules: {
        minLengthMm: pattern.rules.minLMm,
        maxLengthMm: pattern.rules.maxLMm,
        minWidthMm: pattern.rules.minWMm,
        maxWidthMm: pattern.rules.maxWMm,
        minHeightMm: pattern.rules.minHMm,
        maxHeightMm: pattern.rules.maxHMm,
        lengthMustExceedWidth: pattern.rules.lengthMustExceedWidth,
      },
      materialIds: materials
        .filter((material) =>
          dto.materials.some(
            (source) => source.id === material.id && source.flute && pattern.fluteTypeIds.includes(source.flute.id),
          ),
        )
        .map((material) => material.id),
    })),
    templates: dto.templates,
    colours: colours.map((hex) => ({ hex, name: hex })),
    fonts: dto.fonts.map((font) => ({ id: font.id, family: font.name, fileUrl: font.url })),
    rules: {
      bleedMm: mm(dto.rules.bleedMm),
      safeMarginMm: mm(dto.rules.safeZoneMm),
      minDpi: dto.rules.minEffectivePpi,
    },
    assets: { accept: dto.rules.assetAccept, maxBytes: dto.rules.assetMaxBytes, purpose: dto.rules.assetPurpose },
  };
}
