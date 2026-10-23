import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";

/**
 * Marketing decoration for the storefront (home redesign, 2026-10-06). Kraft is decoration only
 * (D-180), so the pieces that use it live here, where the contrast gate and the ESLint rule
 * expect them — never as `bg-kraft` in a feature folder.
 */

/** A highlighter stroke under a phrase of a heading. Kraft, not the campaign amber (D-180). */
export function Highlight({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("relative isolate inline-block", className)}>
      {children}
      <span aria-hidden className="bg-kraft absolute inset-x-0 bottom-1.5 -z-10 h-3 rounded" />
    </span>
  );
}

/**
 * A kraft band with a dashed die-cut square in its corner — for a section that is an invitation.
 * Give the children `relative` so they sit above the square; layout (grid, padding) is the caller's.
 */
export function KraftPanel({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("bg-kraft text-fg relative overflow-hidden rounded-2xl", className)} {...props}>
      <div
        aria-hidden
        className="border-kraft-strong rounded-panel absolute -end-12 -top-10 size-96 rotate-12 border-2 border-dashed"
      />
      {children}
    </div>
  );
}

const TILE_TONE = {
  /** Solid brand fill — steps in a sequence. */
  solid: "bg-primary text-primary-fg",
  /** Brand tint — a feature in a list. */
  primary: "bg-primary-subtle text-primary",
  kraft: "bg-kraft text-fg",
  /** On a solid brand or dark band. */
  inverse: "bg-current/15",
} as const;

const TILE_SIZE = { sm: "size-8.5 rounded-lg", md: "size-11.5 rounded-xl", lg: "size-12.5 rounded-xl" } as const;
const GLYPH_SIZE = { sm: 18, md: 22, lg: 24 } as const;

/** A rounded square holding one icon — the mark beside a step, a benefit or a floating note. */
export function IconTile({
  name,
  tone = "primary",
  size = "md",
  className,
}: {
  name: IconName;
  tone?: keyof typeof TILE_TONE;
  size?: keyof typeof TILE_SIZE;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center", TILE_TONE[tone], TILE_SIZE[size], className)}>
      <Icon name={name} size={GLYPH_SIZE[size]} />
    </span>
  );
}
