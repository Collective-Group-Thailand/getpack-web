export type MockupKind = "label" | "tag" | "sleeve" | "pouch";

export interface ProductMockup2DProps {
  kind: MockupKind;
  /** Millimetres: the flat width × length (a pouch's width × height). */
  widthMm: number;
  lengthMm: number;
  /** A pouch's bottom gusset, millimetres. */
  gussetMm?: number;
  /** Label outline: `rect`, `circle`, `oval`, `custom` (die-cut to the artwork). */
  shape?: string;
  /** `#RRGGBB` of the material, from the API's swatch. */
  colour: string;
  printed?: boolean;
  /** Pouch extras. */
  zip?: boolean;
  window?: boolean;
  /** Hang tags: a punched hole, with or without string. */
  hole?: boolean;
  string?: boolean;
  /** Describes the item: "ฉลากวงกลม 50 × 50 มม. PP ขาว". */
  label: string;
  className?: string;
}

const BOX = 220;

/**
 * Flat items in 2D (D-152: labels, pouches, tags and sleeves), drawn to the proportions the
 * customer typed so a 30 × 90 mm label looks long and thin before it is ordered.
 *
 * Original, generic drawings — outline, material colour, an artwork placeholder when printed —
 * never a photo or a third party's mockup.
 */
export function ProductMockup2D({
  kind,
  widthMm,
  lengthMm,
  gussetMm = 0,
  shape = "rect",
  colour,
  printed = false,
  zip = false,
  window = false,
  hole = false,
  string: withString = false,
  label,
  className,
}: ProductMockup2DProps) {
  const longest = Math.max(widthMm, lengthMm, 1);
  const w = Math.max(24, (widthMm / longest) * (BOX - 40));
  const h = Math.max(24, (lengthMm / longest) * (BOX - 40));
  const x = (BOX - w) / 2;
  const y = (BOX - h) / 2;
  const stroke = "rgba(0,0,0,0.35)";
  const art = printed ? (
    <g aria-hidden>
      <circle cx={BOX / 2} cy={y + h * 0.38} r={Math.min(w, h) * 0.14} className="fill-primary" opacity={0.7} />
      <rect
        x={BOX / 2 - w * 0.3}
        y={y + h * 0.58}
        width={w * 0.6}
        height={Math.max(3, h * 0.06)}
        rx={2}
        fill="rgba(0,0,0,0.35)"
      />
      <rect
        x={BOX / 2 - w * 0.2}
        y={y + h * 0.7}
        width={w * 0.4}
        height={Math.max(2, h * 0.045)}
        rx={2}
        fill="rgba(0,0,0,0.2)"
      />
    </g>
  ) : null;

  let body: React.ReactNode;
  if (kind === "label") {
    body =
      shape === "circle" ? (
        <circle cx={BOX / 2} cy={BOX / 2} r={Math.min(w, h) / 2} fill={colour} stroke={stroke} />
      ) : shape === "oval" ? (
        <ellipse cx={BOX / 2} cy={BOX / 2} rx={w / 2} ry={h / 2} fill={colour} stroke={stroke} />
      ) : shape === "custom" ? (
        <path
          d={`M${x + w * 0.1} ${y + h * 0.2} Q${BOX / 2} ${y - h * 0.08} ${x + w * 0.9} ${y + h * 0.2} L${x + w} ${y + h * 0.8} Q${BOX / 2} ${y + h * 1.08} ${x} ${y + h * 0.8} Z`}
          fill={colour}
          stroke={stroke}
          strokeDasharray="5 3"
        />
      ) : (
        <rect x={x} y={y} width={w} height={h} rx={Math.min(w, h) * 0.08} fill={colour} stroke={stroke} />
      );
  } else if (kind === "tag") {
    body = (
      <>
        <rect x={x} y={y} width={w} height={h} rx={6} fill={colour} stroke={stroke} />
        {hole ? (
          <circle cx={BOX / 2} cy={y + Math.min(14, h * 0.12)} r={4} fill="var(--color-bg)" stroke={stroke} />
        ) : null}
        {hole && withString ? (
          <path
            d={`M${BOX / 2} ${y + Math.min(14, h * 0.12)} C${BOX / 2 - 30} ${y - 30} ${BOX / 2 + 40} ${y - 40} ${BOX / 2 + 20} 4`}
            fill="none"
            stroke="#8a6d4b"
            strokeWidth={2}
          />
        ) : null}
      </>
    );
  } else if (kind === "sleeve") {
    body = (
      <>
        <rect
          x={x - 14}
          y={y - 10}
          width={w + 28}
          height={h + 20}
          rx={4}
          fill="none"
          stroke={stroke}
          strokeDasharray="4 4"
        />
        <rect x={x - 14} y={BOX / 2 - h * 0.25} width={w + 28} height={h * 0.5} fill={colour} stroke={stroke} />
      </>
    );
  } else {
    const g = Math.min(h * 0.25, (gussetMm / longest) * (BOX - 40));
    body = (
      <>
        <path
          d={`M${x} ${y} H${x + w} V${y + h - g} Q${x + w} ${y + h} ${x + w - g * 0.6} ${y + h} H${x + g * 0.6} Q${x} ${y + h} ${x} ${y + h - g} Z`}
          fill={colour}
          stroke={stroke}
        />
        <rect x={x} y={y} width={w} height={Math.max(6, h * 0.05)} fill="rgba(0,0,0,0.12)" />
        {zip ? (
          <line
            x1={x + 4}
            x2={x + w - 4}
            y1={y + h * 0.13}
            y2={y + h * 0.13}
            stroke={stroke}
            strokeWidth={2}
            strokeDasharray="3 2"
          />
        ) : null}
        {window ? (
          <rect
            x={x + w * 0.3}
            y={y + h * 0.45}
            width={w * 0.4}
            height={h * 0.28}
            rx={8}
            fill="rgba(255,255,255,0.55)"
            stroke={stroke}
          />
        ) : null}
        {g > 0 ? (
          <line
            x1={x + g * 0.6}
            x2={x + w - g * 0.6}
            y1={y + h - g}
            y2={y + h - g}
            stroke={stroke}
            strokeDasharray="3 3"
          />
        ) : null}
      </>
    );
  }

  return (
    <svg viewBox={`0 0 ${BOX} ${BOX}`} role="img" aria-label={label} className={className ?? "h-64 w-full"}>
      {body}
      {kind !== "sleeve" ? art : null}
    </svg>
  );
}
