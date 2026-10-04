import { dielineLines } from "../lines";
import { bleedOutline } from "../offset";
import { arcToBeziers, round3 } from "../path";
import type { Dieline, Edge, EdgeRole } from "../types";
import { LAYER_OF, LAYER_ORDER, LAYER_STYLE, type LayerName } from "./layers";

/** A raster placed under the dieline, e.g. one tile of the artwork. JPEG only (DCTDecode). */
export interface PdfImage {
  /** Baseline JPEG bytes. */
  jpeg: Uint8Array;
  widthPx: number;
  heightPx: number;
  /** Placement in sheet millimetres (y down, like the dieline). */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A finish (foil, spot UV, emboss, window) as its own separation page: a 1-bit stencil over the
 * sheet (`1` = finish), painted in a spot colour of its name, with the die lines for registration.
 * `flate` says the bits are zlib-compressed (FlateDecode).
 */
export interface PdfFinish {
  /** The spot colour and layer name, e.g. `Foil`, `SpotUV`. */
  name: string;
  /** The tint a viewer shows the spot in. */
  cmyk: [number, number, number, number];
  mask: { bits: Uint8Array; widthPx: number; heightPx: number; flate?: boolean; x: number; y: number; width: number; height: number };
}

export interface PdfOptions {
  /** Paper around the trim, mm. Default 10 (room for bleed and marks). */
  margin?: number;
  /** Bleed beyond the cut, mm: sets the BleedBox and draws a BLEED layer when > 0. */
  bleedMm?: number;
  /** Artwork under the die lines, drawn first on an "Artwork" layer. */
  images?: PdfImage[];
  /** Which line roles to draw. Default: all die layers (not bleed). */
  roles?: EdgeRole[];
  title?: string;
  /** Stroke width in mm. Default 0.25. */
  strokeMm?: number;
  /** Finishes, each on a page of its own after the artwork's (U4.4). */
  finishes?: PdfFinish[];
}

const PT_PER_MM = 72 / 25.4;
const n = (v: number) => String(round3(v));

/** PDF text string for any Unicode title: UTF-16BE with BOM, hex encoded. */
function pdfText(s: string): string {
  let hex = "FEFF";
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (code > 0xffff) {
      const v = code - 0x10000;
      hex += (0xd800 + (v >> 10)).toString(16).padStart(4, "0") + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, "0");
    } else hex += code.toString(16).padStart(4, "0");
  }
  return `<${hex.toUpperCase()}>`;
}

function pathOps(e: Edge): string {
  const start = `${n(e.from[0])} ${n(e.from[1])} m`;
  if (e.kind === "line") return `${start} ${n(e.to[0])} ${n(e.to[1])} l S`;
  const curves = e.kind === "arc" ? arcToBeziers(e) : [e];
  return `${start} ${curves.map((c) => `${n(c.c1[0])} ${n(c.c1[1])} ${n(c.c2[0])} ${n(c.c2[1])} ${n(c.to[0])} ${n(c.to[1])} c`).join(" ")} S`;
}

/**
 * The dieline as a vector PDF at true size: each die layer stroked in its own **spot colour**
 * (Separation `CutContour`, `Crease`, `Perforation`, `HalfCut`, `Glue`) with overprint, inside an
 * optional-content layer of the same name, so RIPs and prepress tools separate the die from the
 * print. Optional JPEG tiles are placed underneath on an "Artwork" layer — that is how the
 * designer composes a print file. TrimBox is the dieline; BleedBox adds `bleedMm`.
 *
 * Pure: returns the file's bytes, runs in the browser and in Node.
 */
export function dielineToPdf(d: Dieline, opts: PdfOptions = {}): Uint8Array {
  const margin = opts.margin ?? 10;
  const bleed = opts.bleedMm ?? 0;
  const stroke = opts.strokeMm ?? 0.25;
  const roles = new Set<EdgeRole>(opts.roles ?? ["cut", "crease", "perforation", "half_cut", "glue_area"]);
  const pageW = (d.width + margin * 2) * PT_PER_MM;
  const pageH = (d.height + margin * 2) * PT_PER_MM;

  const byLayer = new Map<LayerName, string[]>();
  for (const l of dielineLines(d)) {
    if (!roles.has(l.role)) continue;
    const layer = LAYER_OF[l.role];
    byLayer.set(layer, [...(byLayer.get(layer) ?? []), pathOps(l.edge)]);
  }
  if (bleed > 0) {
    const ops = d.pieces.flatMap((p) =>
      bleedOutline(p, bleed).map(
        (poly) => `${poly.map((q, i) => `${n(q[0])} ${n(q[1])} ${i ? "l" : "m"}`).join(" ")} h S`,
      ),
    );
    byLayer.set("BLEED", ops);
  }
  const layers = LAYER_ORDER.filter((name) => byLayer.has(name));

  // Objects: 1 catalog, 2 pages, 3 page, 4 content, 5 ExtGState, then separations, OCGs, images, info.
  const objects: (string | Uint8Array[])[] = [];
  const add = (body: string | Uint8Array[]) => {
    objects.push(body);
    return objects.length;
  };
  const catalog = add("");
  const pages = add("");
  const page = add("");
  const content = add("");
  const gs = add("<< /Type /ExtGState /OP true /op true /OPM 1 >>");

  const tint = (c: number[]) => `<< /FunctionType 2 /Domain [0 1] /C0 [0 0 0 0] /C1 [${c.map(n).join(" ")}] /N 1 >>`;
  const separations = new Map<LayerName, number>();
  const ocgs = new Map<string, number>();
  for (const name of layers) {
    const s = LAYER_STYLE[name];
    separations.set(name, add(`[/Separation /${s.spot} /DeviceCMYK ${tint(s.cmyk)}]`));
  }
  const images = opts.images ?? [];
  if (images.length) ocgs.set("Artwork", add(`<< /Type /OCG /Name ${pdfText("Artwork")} >>`));
  for (const name of layers) ocgs.set(name, add(`<< /Type /OCG /Name ${pdfText(name)} >>`));
  const imageObjs = images.map((img) =>
    add([
      new TextEncoder().encode(
        `<< /Type /XObject /Subtype /Image /Width ${img.widthPx} /Height ${img.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpeg.length} >>\nstream\n`,
      ),
      img.jpeg,
      new TextEncoder().encode("\nendstream"),
    ]),
  );
  const info = add(`<< /Producer (Packio @packio/dieline) /Title ${pdfText(opts.title ?? `Dieline ${d.styleId}`)} >>`);

  // Finishes: a separation, a layer, the stencil, a page and its content each.
  const finishes = (opts.finishes ?? []).map((f) => {
    const name = f.name.replace(/[^A-Za-z0-9_]/g, "");
    const separation = add(`[/Separation /${name} /DeviceCMYK ${tint(f.cmyk)}]`);
    const ocg = add(`<< /Type /OCG /Name ${pdfText(name)} >>`);
    const mask = add([
      new TextEncoder().encode(
        `<< /Type /XObject /Subtype /Image /Width ${f.mask.widthPx} /Height ${f.mask.heightPx} /ImageMask true /BitsPerComponent 1 /Decode [1 0]${f.mask.flate ? " /Filter /FlateDecode" : ""} /Length ${f.mask.bits.length} >>\nstream\n`,
      ),
      f.mask.bits,
      new TextEncoder().encode("\nendstream"),
    ]);
    const finishPage = add("");
    const finishContent = add("");
    return { f, name, separation, ocg, mask, page: finishPage, content: finishContent };
  });
  for (const fp of finishes) ocgs.set(fp.name, fp.ocg);

  // Content: mm units, y down, origin at the trim's top-left.
  const k = PT_PER_MM;
  const ops: string[] = [`${n(k)} 0 0 ${n(-k)} ${n(margin * k)} ${n(pageH - margin * k)} cm`];
  if (images.length) {
    ops.push("/OC /Artwork BDC");
    images.forEach((img, i) =>
      ops.push(`q ${n(img.width)} 0 0 ${n(-img.height)} ${n(img.x)} ${n(img.y + img.height)} cm /Im${i} Do Q`),
    );
    ops.push("EMC");
  }
  for (const name of layers) {
    const s = LAYER_STYLE[name];
    const dash = s.dash ? `[${s.dash}] 0 d` : "[] 0 d";
    ops.push(`/OC /${name} BDC q /GS0 gs /CS_${name} CS 1 SCN ${n(stroke)} w ${dash} 1 J 1 j`);
    ops.push(...byLayer.get(name)!);
    ops.push("Q EMC");
  }
  const stream = ops.join("\n");

  const colorSpaces = layers.map((name) => `/CS_${name} ${separations.get(name)} 0 R`).join(" ");
  const properties = [...ocgs].map(([name, id]) => `/${name} ${id} 0 R`).join(" ");
  const xobjects = imageObjs.map((id, i) => `/Im${i} ${id} 0 R`).join(" ");
  const trim = [margin * k, margin * k, pageW - margin * k, pageH - margin * k];
  const bleedBox = [
    (margin - bleed) * k,
    (margin - bleed) * k,
    pageW - (margin - bleed) * k,
    pageH - (margin - bleed) * k,
  ];

  objects[catalog - 1] =
    `<< /Type /Catalog /Pages ${pages} 0 R /OCProperties << /OCGs [${[...ocgs.values()].map((id) => `${id} 0 R`).join(" ")}] /D << /Order [${[...ocgs.values()].map((id) => `${id} 0 R`).join(" ")}] /ON [${[...ocgs.values()].map((id) => `${id} 0 R`).join(" ")}] >> >> >>`;
  objects[pages - 1] =
    `<< /Type /Pages /Kids [${[page, ...finishes.map((fp) => fp.page)].map((id) => `${id} 0 R`).join(" ")}] /Count ${1 + finishes.length} >>`;
  objects[page - 1] =
    `<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${n(pageW)} ${n(pageH)}] /TrimBox [${trim.map(n).join(" ")}] /BleedBox [${bleedBox.map(n).join(" ")}] ` +
    `/Resources << /ExtGState << /GS0 ${gs} 0 R >> /ColorSpace << ${colorSpaces} >> /Properties << ${properties} >>${xobjects ? ` /XObject << ${xobjects} >>` : ""} >> /Contents ${content} 0 R >>`;
  objects[content - 1] = `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`;
  const dieOps = ops.slice(images.length ? images.length + 3 : 1);
  for (const fp of finishes) {
    const m = fp.f.mask;
    const body = [
      ops[0]!,
      `/OC /${fp.name} BDC q /GS0 gs /CS_${fp.name} cs 1 scn`,
      `q ${n(m.width)} 0 0 ${n(-m.height)} ${n(m.x)} ${n(m.y + m.height)} cm /Mk Do Q`,
      "Q EMC",
      ...dieOps,
    ].join("\n");
    const finishProps = [...ocgs].map(([name, id]) => `/${name} ${id} 0 R`).join(" ");
    objects[fp.page - 1] =
      `<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${n(pageW)} ${n(pageH)}] /TrimBox [${trim.map(n).join(" ")}] /BleedBox [${bleedBox.map(n).join(" ")}] ` +
      `/Resources << /ExtGState << /GS0 ${gs} 0 R >> /ColorSpace << ${colorSpaces} /CS_${fp.name} ${fp.separation} 0 R >> /Properties << ${finishProps} >> /XObject << /Mk ${fp.mask} 0 R >> >> /Contents ${fp.content} 0 R >>`;
    objects[fp.content - 1] = `<< /Length ${new TextEncoder().encode(body).length} >>\nstream\n${body}\nendstream`;
  }

  // Serialise with a byte-exact cross-reference table.
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const push = (c: Uint8Array) => {
    chunks.push(c);
    offset += c.length;
  };
  push(enc.encode("%PDF-1.6\n%âãÏÓ\n"));
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(offset);
    push(enc.encode(`${i + 1} 0 obj\n`));
    if (typeof body === "string") push(enc.encode(body));
    else body.forEach(push);
    push(enc.encode("\nendobj\n"));
  });
  const xref = offset;
  push(
    enc.encode(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}` +
        `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
    ),
  );
  const out = new Uint8Array(offset);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
