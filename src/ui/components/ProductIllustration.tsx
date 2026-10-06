import { cn } from "../lib/cn";

/**
 * Line-art product illustrations, one per packaging family, drawn on kraft (UX audit design
 * baseline: "ห้ามใช้ lucide Package เป็นรูปสินค้า — illustration ต่อ product type 13 แบบ").
 *
 * Packio's own drawings — simple isometric strokes in `currentColor` with a paper fill, so they
 * follow the theme. They stand in for a product photo until the catalogue has one; a real image
 * always wins (`ProductCard`'s `image`).
 */
export type ProductFamily =
  | "shipping"
  | "tuck"
  | "rigid"
  | "bag"
  | "pouch"
  | "label"
  | "tag"
  | "tube"
  | "food"
  | "display"
  | "tape"
  | "stock"
  | "service";

/**
 * The family a catalogue code belongs to — a product-type, category or style code, matched on the
 * words it is built from (`corrugated`, `mailer_box`, `stand-up-pouch` …). Unknown codes draw a
 * folding carton, the commonest thing Packio makes.
 */
export function productFamilyOf(code: string | null | undefined): ProductFamily {
  const value = (code ?? "").toLowerCase();
  const has = (...words: string[]) => words.some((word) => value.includes(word));
  if (has("service", "design", "mockup", "graphic")) return "service";
  if (has("tape")) return "tape";
  if (has("pouch", "flexible", "sachet")) return "pouch";
  if (has("bag")) return "bag";
  if (has("label", "sticker")) return "label";
  if (has("tag", "sleeve")) return "tag";
  if (has("tube", "cylinder")) return "tube";
  if (has("food", "cup", "tray", "bowl", "clamshell")) return "food";
  if (has("display", "pop", "stand")) return "display";
  if (has("rigid", "magnetic", "gift", "drawer")) return "rigid";
  if (has("standard", "stock", "ready")) return "stock";
  if (has("corrugat", "mailer", "shipping", "carton_box", "rsc", "fefco")) return "shipping";
  return "tuck";
}

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
};
const PAPER = { ...STROKE, fill: "var(--color-surface)" };
const SHADE = { ...STROKE, fill: "color-mix(in oklab, var(--color-kraft-strong) 55%, var(--color-surface))" };

/** An isometric box: top face, left face, right face — the building block most families share. */
function Box({ x, y, w, d, h }: { x: number; y: number; w: number; d: number; h: number }) {
  // (x, y) is the box's front-bottom corner; w runs right-up, d runs left-up.
  const r = [x + w, y - w / 2];
  const l = [x - d, y - d / 2];
  const back = [x + w - d, y - w / 2 - d / 2];
  return (
    <g>
      <path {...PAPER} d={`M${x} ${y - h}L${r[0]} ${r[1]! - h}L${back[0]} ${back[1]! - h}L${l[0]} ${l[1]! - h}Z`} />
      <path {...SHADE} d={`M${x} ${y}L${l[0]} ${l[1]}L${l[0]} ${l[1]! - h}L${x} ${y - h}Z`} />
      <path {...PAPER} d={`M${x} ${y}L${r[0]} ${r[1]}L${r[0]} ${r[1]! - h}L${x} ${y - h}Z`} />
    </g>
  );
}

const DRAWINGS: Record<ProductFamily, React.ReactNode> = {
  shipping: (
    <>
      <Box x={60} y={78} w={34} d={30} h={30} />
      <path {...STROKE} strokeDasharray="3 3" d="M60 48 L94 31 M45 40.5 L79 23.5" />
      <path {...STROKE} d="M70 66 l12 -6" />
    </>
  ),
  tuck: (
    <>
      <Box x={60} y={80} w={22} d={18} h={44} />
      <path {...PAPER} d="M60 36 L82 25 L82 17 Q71 14 60 28 Z" />
      <path {...STROKE} d="M66 58 l10 -5" />
    </>
  ),
  rigid: (
    <>
      <Box x={60} y={80} w={34} d={26} h={18} />
      <Box x={60} y={64} w={36} d={28} h={8} />
      <path {...STROKE} d="M44 54 Q60 60 76 46" />
    </>
  ),
  bag: (
    <>
      <path {...PAPER} d="M36 40 L84 40 L88 84 L32 84 Z" />
      <path {...SHADE} d="M84 40 L94 34 L98 78 L88 84 Z" />
      <path {...STROKE} d="M48 40 Q48 22 60 22 Q72 22 72 40" />
      <path {...STROKE} d="M36 40 L46 34 L94 34" />
    </>
  ),
  pouch: (
    <>
      <path {...PAPER} d="M40 24 L80 24 L82 70 Q82 84 60 84 Q38 84 38 70 Z" />
      <path {...STROKE} d="M40 32 L80 32" strokeDasharray="2 3" />
      <path {...STROKE} d="M48 84 Q60 76 72 84" />
      <circle {...STROKE} cx={74} cy={28} r={2} />
    </>
  ),
  label: (
    <>
      <ellipse {...SHADE} cx={50} cy={56} rx={20} ry={24} />
      <ellipse {...PAPER} cx={50} cy={56} rx={8} ry={10} />
      <path {...PAPER} d="M50 32 L92 32 L92 50 L66 52" />
      <rect {...STROKE} x={70} y={36} width={16} height={11} rx={3} />
    </>
  ),
  tag: (
    <>
      <path {...PAPER} d="M44 30 L76 30 L76 84 L44 84 L44 42 Z" transform="rotate(-10 60 57)" />
      <circle {...STROKE} cx={58} cy={38} r={3.5} transform="rotate(-10 60 57)" />
      <path {...STROKE} d="M58 38 Q50 18 66 14" />
      <path {...STROKE} d="M51 60 h18 M51 68 h12" transform="rotate(-10 60 57)" />
    </>
  ),
  tube: (
    <>
      <path {...SHADE} d="M44 30 L44 78 A16 6 0 0 0 76 78 L76 30" />
      <ellipse {...PAPER} cx={60} cy={30} rx={16} ry={6} />
      <path {...STROKE} d="M44 40 A16 6 0 0 0 76 40" />
    </>
  ),
  food: (
    <>
      <path {...PAPER} d="M30 54 L90 54 L82 78 L38 78 Z" />
      <ellipse {...SHADE} cx={60} cy={54} rx={30} ry={8} />
      <path {...STROKE} d="M48 46 q4 -6 8 0 M60 44 q4 -6 8 0" />
    </>
  ),
  display: (
    <>
      <path {...PAPER} d="M40 20 L80 20 L80 84 L40 84 Z" />
      <path {...SHADE} d="M40 46 L80 46 L86 50 L46 50 Z" />
      <path {...SHADE} d="M40 68 L80 68 L86 72 L46 72 Z" />
      <path {...STROKE} d="M48 28 h24 M48 34 h16" />
    </>
  ),
  tape: (
    <>
      <ellipse {...SHADE} cx={60} cy={56} rx={26} ry={26} />
      <ellipse {...PAPER} cx={60} cy={56} rx={13} ry={13} />
      <path {...PAPER} d="M84 66 L98 72 L96 80 L80 74" />
    </>
  ),
  stock: (
    <>
      <Box x={44} y={84} w={20} d={16} h={18} />
      <Box x={78} y={84} w={20} d={16} h={18} />
      <Box x={61} y={64} w={20} d={16} h={18} />
    </>
  ),
  service: (
    <>
      <rect {...PAPER} x={30} y={22} width={60} height={50} rx={6} />
      <path {...STROKE} strokeDasharray="3 3" d="M42 34 h36 v26 h-36 Z" />
      <path {...SHADE} d="M70 80 L86 50 L92 54 L76 84 Z" />
      <path {...STROKE} d="M70 80 L68 88 L76 84" />
    </>
  ),
};

export interface ProductIllustrationProps {
  family: ProductFamily;
  className?: string;
}

/** One drawing, decorative: the card's title already names the product. */
export function ProductIllustration({ family, className }: ProductIllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 100"
      aria-hidden="true"
      focusable="false"
      className={cn("h-auto w-full max-w-40 overflow-visible", className)}
    >
      {DRAWINGS[family]}
    </svg>
  );
}

/** An open, empty carton — for "nothing here" pages (a 404, an empty list). Decorative. */
export function OpenBoxIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 100"
      aria-hidden="true"
      focusable="false"
      className={cn("text-muted h-auto w-full max-w-36 overflow-visible", className)}
    >
      <Box x={60} y={86} w={30} d={26} h={30} />
      <path {...SHADE} d="M60 56 L90 41 L104 52 L74 67 Z" />
      <path {...SHADE} d="M60 56 L34 43 L22 55 L48 68 Z" />
      <path {...PAPER} d="M64 28 L90 41 L64 54 L34 43 Z" opacity={0.5} />
      <path {...STROKE} strokeDasharray="3 4" d="M60 22 v-10 M74 26 l6 -8 M46 26 l-6 -8" />
    </svg>
  );
}

/** A small kraft plate holding a family's drawing — a cart or order line without a photo. */
export function ProductThumb({ family, className }: { family: ProductFamily; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("bg-kraft text-fg/80 flex size-16 shrink-0 items-center justify-center rounded-lg", className)}
    >
      <ProductIllustration family={family} className="max-w-12" />
    </span>
  );
}

/** A 4:3 kraft plate holding a family's drawing — a card's picture when there is no photo. */
export function ProductPlate({ family, className }: { family: ProductFamily; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("bg-kraft text-fg/80 flex aspect-[4/3] items-center justify-center p-6", className)}
    >
      <ProductIllustration family={family} className="max-w-32" />
    </div>
  );
}
