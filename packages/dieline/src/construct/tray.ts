import { face } from "../faces";
import type { FaceLabel } from "../labels";
import { polygon, rectangle } from "../path";
import type { Contour, Edge, Face, Pt } from "../types";

/**
 * A cross-shaped tray: a base with a wall on each side, and glue flaps on the corners of the
 * side walls that fold in behind the front and back walls.
 *
 *            [ back wall ]
 *   [left] [    base     ] [right]
 *            [ front wall ]
 *
 * Coordinates: base at x ∈ [h, h + length], y ∈ [h, h + width]; walls `h` deep; corner flaps in
 * the four corner squares, cut back at 45° on the edge facing the neighbouring wall.
 */
export interface TraySpec {
  length: number;
  width: number;
  /** Wall height (score to score). */
  height: number;
  /** Corner glue flap reach, along the wall it folds against. */
  cornerFlap: number;
  /** Extra faces hinged on a wall's free edge (e.g. an inner wall or a lock tab), keyed by wall id. */
  wallExtras?: Partial<Record<"wall-back" | "wall-front" | "wall-left" | "wall-right", (edge: [Pt, Pt]) => Face[]>>;
  /** Holes per face id, in tray coordinates. */
  holes?: Partial<Record<string, Contour[]>>;
  labels?: { base?: FaceLabel };
}

export function buildTray(spec: TraySpec): Face[] {
  const { length: L, width: W, height: H } = spec;
  const x0 = H;
  const x1 = H + L;
  const y0 = H;
  const y1 = H + W;
  const cf = Math.max(0, Math.min(spec.cornerFlap, H - 0.5, (L - 1) / 2, (W - 1) / 2));
  const holes = (id: string) => spec.holes?.[id] ?? [];
  const extraBack =
    spec.wallExtras?.["wall-back"]?.([
      [x1, 0],
      [x0, 0],
    ]) ?? [];
  const extraFront =
    spec.wallExtras?.["wall-front"]?.([
      [x0, y1 + H],
      [x1, y1 + H],
    ]) ?? [];
  const extraLeft =
    spec.wallExtras?.["wall-left"]?.([
      [0, y0],
      [0, y1],
    ]) ?? [];
  const extraRight =
    spec.wallExtras?.["wall-right"]?.([
      [x1 + H, y1],
      [x1 + H, y0],
    ]) ?? [];

  const faces: Face[] = [
    face(
      "base",
      spec.labels?.base ?? "base",
      "base",
      rectangle(x0, y0, L, W, { top: "crease", right: "crease", bottom: "crease", left: "crease" }),
      { holes: holes("base") },
    ),
    face(
      "wall-back",
      "wall_back",
      "wall",
      rectangle(x0, 0, L, H, { top: extraBack.length ? "crease" : "cut", bottom: "crease" }),
      { holes: holes("wall-back") },
    ),
    face(
      "wall-front",
      "wall_front",
      "wall",
      rectangle(x0, y1, L, H, { top: "crease", bottom: extraFront.length ? "crease" : "cut" }),
      { holes: holes("wall-front") },
    ),
    face(
      "wall-left",
      "wall_left",
      "wall",
      rectangle(0, y0, H, W, {
        top: cf > 0 ? "crease" : "cut",
        right: "crease",
        bottom: cf > 0 ? "crease" : "cut",
        left: extraLeft.length ? "crease" : "cut",
      }),
      { holes: holes("wall-left") },
    ),
    face(
      "wall-right",
      "wall_right",
      "wall",
      rectangle(x1, y0, H, W, {
        top: cf > 0 ? "crease" : "cut",
        right: extraRight.length ? "crease" : "cut",
        bottom: cf > 0 ? "crease" : "cut",
        left: "crease",
      }),
      { holes: holes("wall-right") },
    ),
  ];

  if (cf > 0) {
    // Each flap: hinged on the side wall's end, reaching `cf` into the corner square, its edge
    // towards the neighbouring wall cut back at 45° so the two never collide.
    const flap = (id: string, hinge: [Pt, Pt], dir: 1 | -1, wallSide: "left" | "right"): Face => {
      const [a, b] = hinge; // along y = const, a.x < b.x
      const y = a[1];
      const tip = y - dir * cf;
      // The end nearest the base-side wall (x0 or x1) gets the 45° cut.
      const nearWall = wallSide === "left" ? b[0] : a[0];
      const farEnd = wallSide === "left" ? a[0] : b[0];
      const inset = Math.min(cf, Math.abs(b[0] - a[0]) - 0.5);
      const pts: Pt[] =
        wallSide === "left"
          ? [
              [farEnd, y],
              [farEnd, tip],
              [nearWall - inset, tip],
              [nearWall, y],
            ]
          : [
              [nearWall, y],
              [nearWall + inset, tip],
              [farEnd, tip],
              [farEnd, y],
            ];
      const edges: Edge[] = polygon(pts, ["cut", "cut", "cut", "crease"]);
      return face(id, "corner_flap", "flap", edges);
    };
    faces.push(
      flap(
        "corner-left-top",
        [
          [0, y0],
          [H, y0],
        ],
        1,
        "left",
      ),
      flap(
        "corner-left-bottom",
        [
          [0, y1],
          [H, y1],
        ],
        -1,
        "left",
      ),
      flap(
        "corner-right-top",
        [
          [x1, y0],
          [x1 + H, y0],
        ],
        1,
        "right",
      ),
      flap(
        "corner-right-bottom",
        [
          [x1, y1],
          [x1 + H, y1],
        ],
        -1,
        "right",
      ),
    );
  }
  faces.push(...extraBack, ...extraFront, ...extraLeft, ...extraRight);
  return faces;
}
