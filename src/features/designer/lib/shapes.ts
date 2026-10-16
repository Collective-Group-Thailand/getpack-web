/*
 * getpack's shape library: simple geometric shapes drawn for getpack (no third-party icons or
 * artwork), each as SVG path data in a 100 × 100 box that the canvas scales to the element.
 */

export interface LibraryShape {
  id: string;
  /** Key into `designer.shapes` messages. */
  path: string;
}

const star = (points: number, inner: number): string => {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? 50 : 50 * inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
};

const polygonPath = (sides: number, rotation = -Math.PI / 2): string => {
  const pts = Array.from({ length: sides }, (_, i) => {
    const a = rotation + (i * 2 * Math.PI) / sides;
    return `${(50 + 50 * Math.cos(a)).toFixed(2)} ${(50 + 50 * Math.sin(a)).toFixed(2)}`;
  });
  return `M${pts.join(" L")} Z`;
};

export const SHAPES: LibraryShape[] = [
  { id: "star", path: star(5, 0.45) },
  { id: "burst", path: star(12, 0.78) },
  { id: "triangle", path: polygonPath(3) },
  { id: "hexagon", path: polygonPath(6, 0) },
  {
    id: "heart",
    path: "M50 92 C20 70 2 52 2 30 C2 14 14 4 28 4 C38 4 46 10 50 18 C54 10 62 4 72 4 C86 4 98 14 98 30 C98 52 80 70 50 92 Z",
  },
  { id: "arrow", path: "M0 38 H60 V16 L100 50 L60 84 V62 H0 Z" },
  { id: "speech", path: "M10 8 H90 Q98 8 98 16 V62 Q98 70 90 70 H40 L20 92 V70 H10 Q2 70 2 62 V16 Q2 8 10 8 Z" },
  {
    id: "badge",
    path: "M50 2 L61 12 L76 9 L80 24 L94 30 L89 44 L98 56 L86 66 L87 81 L72 83 L64 96 L50 90 L36 96 L28 83 L13 81 L14 66 L2 56 L11 44 L6 30 L20 24 L24 9 L39 12 Z",
  },
  { id: "leaf", path: "M8 92 C8 40 40 8 92 8 C92 60 60 92 8 92 Z" },
  { id: "drop", path: "M50 2 C66 30 84 48 84 66 C84 85 69 98 50 98 C31 98 16 85 16 66 C16 48 34 30 50 2 Z" },
  { id: "check", path: "M4 54 L18 40 L38 60 L82 16 L96 30 L38 88 Z" },
  { id: "ribbon", path: "M0 20 H100 L88 50 L100 80 H0 L12 50 Z" },
];
