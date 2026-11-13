import { cn } from "../lib/cn";

/**
 * The coupon ticket (loyalty P1.5, D-486): one form at every size — a **stub** that carries the value and a
 * **body** that says what it is — split by a perforation with semicircle notches at the tear line.
 *
 * Every cut is a CSS mask, never a circle painted in the page colour: painted circles break on a tinted band, in
 * dark mode, under a scrim and when a card lifts. The ticket is two boxes — the outer one is the 1 px `border`, the
 * inner one the face — carrying the same cuts, the outer 1 px larger and concentric, so the hairline follows every
 * notch and every stamp bite and wraps the stub too (`primary-subtle` on the page is 1.10:1 without it).
 * The gradients below are masks: they cut, they paint nothing (design-language.test.ts allows them here only).
 *
 * - `orientation`: `vertical` (stub on top, grid cards and the LIFF sheet) or `horizontal` (stub on the start side:
 *   the featured ticket and the mini-stub of a compact row).
 * - `notch`: `both` cuts a notch into each long edge at the tear line; `end` cuts one notch into the stub's far edge
 *   — a ticket that is all stub (the 64 px mini-stub).
 * - `edge`: `stamp` adds postage-stamp bites along the stub's outer edge (the featured ticket only).
 * - `tone`: the stub — `normal` (`primary-subtle`), `featured` (solid `primary`, white), `spent` (used or expired).
 */
export interface TicketProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  orientation?: "vertical" | "horizontal";
  notch?: "both" | "end";
  edge?: "plain" | "stamp";
  tone?: "normal" | "featured" | "spent";
  /** The stub's length along the ticket in px: its height when vertical, its width when horizontal. */
  stubSize?: number;
  /** Notch radius in px. */
  notchRadius?: number;
  /** `sheet`: square bottom corners, for a ticket that is the top of a bottom sheet. */
  shape?: "card" | "control" | "sheet";
  stub: React.ReactNode;
  stubClassName?: string;
  /** The body; absent for a ticket that is all stub (`notch="end"`). */
  children?: React.ReactNode;
  bodyClassName?: string;
}

const STAMP_BITE = 5;
const STAMP_STEP = 13;

type Mask = { image: string[]; size: string[]; repeat: string[]; position: string[] };

/** A round hole of radius `r` centred at `at` (CSS position). */
const hole = (r: number, at: string) => `radial-gradient(circle ${r}px at ${at}, transparent 98%, black)`;

/**
 * The cuts of one box. `inset` is 0 for the outer (border) box and 1 for the face, whose origin sits 1 px inside: its
 * holes are 1 px smaller and shifted by −1 px, so both rings share a centre and the border stays 1 px all round.
 */
function masks(
  {
    orientation,
    notch,
    edge,
    stubSize,
    notchRadius,
  }: Required<Pick<TicketProps, "orientation" | "notch" | "edge" | "stubSize" | "notchRadius">>,
  inset: 0 | 1,
): Mask {
  const r = notchRadius + 1 - inset;
  const o = `${-inset}px`;
  const far = `calc(100% + ${inset}px)`;
  const cut = `${stubSize - inset}px`;
  const mask: Mask = { image: [], size: [], repeat: [], position: [] };
  const add = (image: string, size = "100% 100%", repeat = "no-repeat", position = "0 0") => {
    mask.image.push(image);
    mask.size.push(size);
    mask.repeat.push(repeat);
    mask.position.push(position);
  };

  if (notch === "end") {
    add(hole(r, orientation === "horizontal" ? `${far} 50%` : `50% ${far}`));
  } else if (orientation === "vertical") {
    add(hole(r, `${o} ${cut}`));
    add(hole(r, `${far} ${cut}`));
  } else {
    add(hole(r, `${cut} ${o}`));
    add(hole(r, `${cut} ${far}`));
  }

  if (edge === "stamp") {
    const bite = STAMP_BITE + 1 - inset;
    if (orientation === "vertical") add(hole(bite, `50% ${o}`), `${STAMP_STEP}px 100%`, "repeat-x", `${o} 0`);
    else add(hole(bite, `${o} 50%`), `100% ${STAMP_STEP}px`, "repeat-y", `0 ${o}`);
  }
  return mask;
}

function maskStyle(mask: Mask): React.CSSProperties {
  const image = mask.image.join(", ");
  const size = mask.size.join(", ");
  const repeat = mask.repeat.join(", ");
  const position = mask.position.join(", ");
  return {
    WebkitMaskImage: image,
    maskImage: image,
    WebkitMaskSize: size,
    maskSize: size,
    WebkitMaskRepeat: repeat,
    maskRepeat: repeat,
    WebkitMaskPosition: position,
    maskPosition: position,
    WebkitMaskComposite: "source-in",
    maskComposite: "intersect",
  };
}

/** The outer box takes the token radius; the face sits 1 px inside it, so its corners are 1 px tighter (concentric). */
const RADIUS = {
  card: { outer: "rounded-card", inner: "[border-radius:calc(var(--radius-card)_-_1px)]" },
  control: { outer: "rounded-control", inner: "[border-radius:calc(var(--radius-control)_-_1px)]" },
  sheet: {
    outer: "rounded-t-card",
    inner:
      "[border-top-left-radius:calc(var(--radius-card)_-_1px)] [border-top-right-radius:calc(var(--radius-card)_-_1px)]",
  },
} as const;

const STUB_TONE = {
  normal: "bg-primary-subtle text-primary-subtle-fg",
  featured: "bg-primary text-primary-fg",
  spent: "bg-neutral-subtle text-muted",
} as const;

export function Ticket({
  orientation = "vertical",
  notch = "both",
  edge = "plain",
  tone = "normal",
  stubSize = 116,
  notchRadius = 8,
  shape = "card",
  stub,
  stubClassName,
  children,
  bodyClassName,
  className,
  style,
  ...props
}: TicketProps) {
  const geometry = { orientation, notch, edge, stubSize, notchRadius };
  const vertical = orientation === "vertical";
  const radius = RADIUS[shape];

  return (
    <div
      className={cn("bg-border relative flex p-px", radius.outer, className)}
      style={{ ...maskStyle(masks(geometry, 0)), ...style }}
      data-ticket={orientation}
      {...props}
    >
      <div
        className={cn(
          "bg-surface relative flex min-w-0 flex-1 overflow-hidden",
          radius.inner,
          vertical ? "flex-col" : "flex-row",
        )}
        style={maskStyle(masks(geometry, 1))}
      >
        <div
          className={cn("relative shrink-0", STUB_TONE[tone], children === undefined && "flex-1", stubClassName)}
          style={children === undefined ? undefined : vertical ? { height: stubSize } : { width: stubSize }}
        >
          {stub}
          {children !== undefined ? <Perforation vertical={vertical} solid={tone === "featured"} /> : null}
        </div>
        {children !== undefined ? (
          <div className={cn("flex min-w-0 flex-1 flex-col", bodyClassName)}>{children}</div>
        ) : null}
      </div>
    </div>
  );
}

/** The dashed tear line between the notches; decoration only. */
function Perforation({ vertical, solid }: { vertical: boolean; solid: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute border-dashed",
        solid ? "border-primary-fg/35" : "border-border-strong/55",
        vertical ? "inset-x-3.5 bottom-0 border-t" : "inset-y-3.5 end-0 border-e",
      )}
    />
  );
}
