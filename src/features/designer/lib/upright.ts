import { applyMat4, foldDieline, lift, type Dieline, type HingeMap } from "@packio/dieline";

/**
 * How far to turn each face so it reads upright on the finished box — the rotation the canvas
 * applies when a face is focused (a bottom flap is drawn upside down on the flat; its text must
 * read the right way up on the box). From the fold: the face's flat "up" after folding, compared
 * with world up — or, for a face lying flat (a lid or a base), with "away from the viewer", so it
 * reads from the front. Multiples of 90°.
 */
export function uprightAngles(d: Dieline, hinges: HingeMap): Record<string, number> {
  const transforms = foldDieline(d, hinges, 1);
  const out: Record<string, number> = {};
  for (const [id, m] of transforms) {
    const o = applyMat4(m, lift([0, 0]));
    const at = (p: [number, number]) => {
      const q = applyMat4(m, lift(p));
      return [q[0] - o[0], q[1] - o[1], q[2] - o[2]];
    };
    const up = at([0, -1]); // flat up (y down on the sheet)
    const right = at([1, 0]);
    const normal = [
      right[1] * up[2] - right[2] * up[1],
      right[2] * up[0] - right[0] * up[2],
      right[0] * up[1] - right[1] * up[0],
    ];
    const flat = Math.abs(normal[1]) > 0.7;
    const target = flat ? [0, 0, -1] : [0, 1, 0];
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const angle = (Math.atan2(dot(target, right), dot(target, up)) * 180) / Math.PI;
    const snapped = (Math.round(angle / 90) * 90 + 360) % 360;
    out[id] = snapped;
  }
  return out;
}
