import { buildDieline, dielineSegments } from "@packio/dieline";
import type { BoxDims, BoxStyleId } from "@/lib/types";

/** Small SVG preview of a dieline, used in the setup dialog. */
export function BoxPreview({ style, dims, color }: { style: BoxStyleId; dims: BoxDims; color: string }) {
  const d = buildDieline(style, dims);
  const segs = dielineSegments(d);
  const pad = Math.max(d.width, d.height) * 0.04;
  return (
    <svg viewBox={`${-pad} ${-pad} ${d.width + pad * 2} ${d.height + pad * 2}`} className="h-full w-full">
      {d.faces.map((f) => (
        <polygon key={f.id} points={f.points.map((p) => p.join(",")).join(" ")} fill={color} />
      ))}
      {segs.map((s, i) => (
        <line
          key={i}
          x1={s.a[0]}
          y1={s.a[1]}
          x2={s.b[0]}
          y2={s.b[1]}
          stroke={s.kind === "cut" ? "#e11d48" : "#2563eb"}
          strokeWidth={1.2}
          vectorEffect="non-scaling-stroke"
          strokeDasharray={s.kind === "fold" ? "4 3" : undefined}
        />
      ))}
    </svg>
  );
}
