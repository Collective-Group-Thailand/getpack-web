import { allFaces } from "../faces";
import { issue } from "../params";
import { t } from "../styles/_shared";
import type { Dieline, Edge, Issue, MaterialSpec, Pt } from "../types";
import { materialClassOf, materialRules } from "./materials";

/*
 * Manufacturing rules over a whole dieline, whatever modules made it (U3.2). Module-specific ones
 * live on the modules (`manufacturing`, `stage: "manufacturing"` constraints).
 */

const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const len = (p: Pt) => Math.hypot(p[0], p[1]);
const near = (a: Pt, b: Pt) => len(sub(a, b)) < 0.01;

/**
 * How far a straight cut runs beside a straight crease: their distance where they overlap when
 * they are within 10° of parallel and run alongside each other for more than 1 mm, else `null`.
 * Lines that meet (a flap's side leaving its hinge) never count.
 */
function besideDistance(cut: Edge, crease: Edge): number | null {
  if (cut.kind !== "line" || crease.kind !== "line") return null;
  if ([cut.from, cut.to].some((p) => near(p, crease.from) || near(p, crease.to))) return null;
  const d = sub(crease.to, crease.from);
  const L = len(d);
  if (L < 1e-9) return null;
  const u: Pt = [d[0] / L, d[1] / L];
  const c = sub(cut.to, cut.from);
  const cl = len(c);
  if (cl < 1e-9 || Math.abs(u[0] * c[1] - u[1] * c[0]) / cl > Math.sin((10 * Math.PI) / 180)) return null;
  const along = (p: Pt) => (p[0] - crease.from[0]) * u[0] + (p[1] - crease.from[1]) * u[1];
  const across = (p: Pt) => Math.abs((p[0] - crease.from[0]) * u[1] - (p[1] - crease.from[1]) * u[0]);
  const [a0, a1] = [along(cut.from), along(cut.to)].sort((p, q) => p - q);
  const overlap = Math.min(a1, L) - Math.max(a0, 0);
  if (overlap <= 1) return null;
  return Math.min(across(cut.from), across(cut.to));
}

/** The board itself must be one this class is made in, and no cut may run too close beside a crease. */
export function dielineManufacturing(d: Dieline, m: MaterialSpec): Issue[] {
  const r = materialRules(m);
  const out: Issue[] = [];
  if (m.caliperMm < r.caliper[0] || m.caliperMm > r.caliper[1]) {
    out.push(
      issue(
        "mfg.caliper_out_of_range",
        t(
          `ความหนา ${m.caliperMm} มม. ไม่อยู่ในช่วงของวัสดุกลุ่ม ${materialClassOf(m)}`,
          `A ${m.caliperMm} mm caliper is outside the ${materialClassOf(m)} range`,
        ),
      ),
    );
  }
  if (r.cutToCrease <= 0) return out;
  for (const f of allFaces(d)) {
    const edges = [...f.outline, ...f.marks];
    const creases = edges.filter((e) => e.role === "crease");
    const cuts = [...f.outline.filter((e) => e.role === "cut"), ...f.holes.flat()];
    const tooClose = cuts.some((c) =>
      creases.some((k) => {
        const dist = besideDistance(c, k);
        return dist !== null && dist < r.cutToCrease;
      }),
    );
    if (tooClose) {
      out.push(
        issue(
          "mfg.cut_near_crease",
          t(
            `รอยตัดใกล้รอยพับเกิน ${r.cutToCrease} มม. บนด้าน ${f.id}`,
            `A cut runs within ${r.cutToCrease} mm of a crease on ${f.id}`,
          ),
        ),
      );
    }
  }
  return out;
}
