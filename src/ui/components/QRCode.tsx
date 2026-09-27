import qrcode from "qrcode-generator";

/** The quiet zone ISO/IEC 18004 asks for: four modules of blank on every side. */
const QUIET = 4;

export interface QRCodeProps {
  value: string;
  /** Rendered width and height, in any CSS length — `"28mm"` on a label, `160` px on screen. */
  size?: number | string;
  /** Accessible name: what the code is for, not its content ("QR ติดตามพัสดุกล่องที่ 1"). */
  label: string;
  /** Error correction: M (15 %) survives a scuffed carton; H when a logo overlaps it. */
  level?: "L" | "M" | "Q" | "H";
  className?: string;
}

/**
 * A QR code as vector SVG (design-system.md §3 "QRCode"): one `<path>` of dark modules on a white
 * square, quiet zone included, sharp at any print size. Colours are fixed black on white — a
 * scanner needs the contrast whatever the theme is.
 */
export function QRCode({ value, size = 160, label, level = "M", className }: QRCodeProps) {
  const qr = qrcode(0, level);
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  const total = count + QUIET * 2;
  let d = "";
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (qr.isDark(row, column)) d += `M${column + QUIET},${row + QUIET}h1v1h-1z`;
    }
  }
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${total} ${total}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={total} height={total} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
