/**
 * The job's spec snapshot as lines a shop floor reads (round 1, partner job): the box style, its
 * inside, outside and over-crease sizes, the board's caliper, the material and print where the
 * snapshot names them, and the design path — never the raw JSON, never an id. The snapshot is an
 * open map (`ProductionJobDto.spec`, CONTRACT-GAP partner.jobs: its shape is not in the contract),
 * so every read is guarded and a missing part is left out.
 */
export interface SpecLine {
  key: string;
  values?: Record<string, string>;
}

type Rec = Record<string, unknown>;
const rec = (value: unknown): Rec | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Rec) : null;
const str = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : null);
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

function lwd(value: unknown, format: (n: number) => string): string | null {
  const size = rec(value);
  if (!size) return null;
  const [l, w, d] = [num(size["l"]), num(size["w"]), num(size["d"])];
  if (l === null || w === null) return null;
  return [l, w, d]
    .filter((n): n is number => n !== null)
    .map(format)
    .join(" × ");
}

export function specLines(spec: unknown, format: (n: number) => string): SpecLine[] {
  const root = rec(spec);
  if (!root) return [];
  const lines: SpecLine[] = [];
  const style = rec(root["style"]);
  const styleName = str(style?.["name"]);
  if (styleName) {
    const code = str(style?.["code"]);
    lines.push({ key: "style", values: { name: code ? `${styleName} · ${code}` : styleName } });
  }
  const dimensions = rec(root["dimensions"]);
  const sizes = rec(dimensions?.["sizes"]);
  for (const [field, key] of [
    ["internal", "internal"],
    ["external", "external"],
    ["overCrease", "overCrease"],
  ] as const) {
    const text = lwd(sizes?.[field], format);
    if (text) lines.push({ key, values: { size: text } });
  }
  const caliper = num(dimensions?.["caliperMm"]);
  if (caliper !== null) lines.push({ key: "caliper", values: { mm: format(caliper) } });
  const material = str(rec(root["material"])?.["name"]) ?? str(root["materialName"]);
  if (material) lines.push({ key: "material", values: { name: material } });
  const parts = Array.isArray(rec(root["configuration"])?.["parts"])
    ? (rec(root["configuration"])!["parts"] as unknown[])
    : [];
  const printAreas = parts.reduce<number>((total, part) => {
    const front = rec(part)?.["printFront"];
    return total + (Array.isArray(front) ? front.length : 0);
  }, 0);
  if (parts.length)
    lines.push(printAreas ? { key: "print", values: { count: String(printAreas) } } : { key: "noPrint" });
  const design = str(root["designOption"]);
  if (design) lines.push({ key: `design.${design}` });
  return lines;
}
