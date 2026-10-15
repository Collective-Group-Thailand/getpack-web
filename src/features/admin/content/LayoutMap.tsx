import type { TemplateLayout } from "@/features/designer/templates/layout";

const FACE_ORDER = ["top", "left", "front", "right", "back", "bottom", "main"] as const;

/**
 * A template's layout as a map (U4.4): each face it uses as a panel, each slot as its box in the
 * face's safe area, filled with the slot's colour role from the palette — enough to read what a
 * layout does without a dieline. The real re-flow happens in the studio.
 */
export function LayoutMap({ layout, label }: { layout: TemplateLayout; label: string }) {
  const faces = FACE_ORDER.filter((face) => layout.slots.some((slot) => slot.face === face));
  const W = 120;
  const H = 150;
  const GAP = 12;
  const width = Math.max(1, faces.length) * (W + GAP) - GAP;
  return (
    <svg viewBox={`0 0 ${width} ${H + 18}`} role="img" aria-label={label} className="h-auto w-full max-w-xl">
      {faces.map((face, index) => {
        const x0 = index * (W + GAP);
        const background = layout.background?.colour ? layout.palette[layout.background.colour] : layout.palette.paper;
        return (
          <g key={face}>
            <rect x={x0} y={0} width={W} height={H} fill={background} stroke="currentColor" strokeOpacity={0.3} />
            {layout.slots
              .filter((slot) => slot.face === face)
              .map((slot) => {
                const fill = layout.palette[slot.colour] ?? "#999";
                const box = { x: x0 + slot.box.x * W, y: slot.box.y * H, w: slot.box.w * W, h: slot.box.h * H };
                return slot.kind === "circle" ? (
                  <ellipse
                    key={slot.id}
                    cx={box.x + box.w / 2}
                    cy={box.y + box.h / 2}
                    rx={box.w / 2}
                    ry={box.h / 2}
                    fill={fill}
                    fillOpacity={0.85}
                  />
                ) : slot.kind === "text" ? (
                  <g key={slot.id}>
                    <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="none" stroke={fill} strokeDasharray="2 2" />
                    <text
                      x={box.x + 2}
                      y={box.y + Math.min(box.h - 2, 10)}
                      fontSize={Math.max(5, Math.min(9, box.h * 0.6))}
                      fill={fill}
                    >
                      {slot.text?.th ?? slot.role}
                    </text>
                  </g>
                ) : (
                  <rect
                    key={slot.id}
                    x={box.x}
                    y={box.y}
                    width={box.w}
                    height={box.h}
                    rx={(slot.round ?? 0) * Math.min(box.w, box.h)}
                    fill={fill}
                    fillOpacity={0.85}
                  />
                );
              })}
            <text x={x0 + W / 2} y={H + 13} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.7}>
              {face}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
