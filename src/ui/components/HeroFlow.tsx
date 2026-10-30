import { Icon } from "../icons";
import { cn } from "../lib/cn";
import { CardImage } from "./CardImage";
import { ProductIllustration, type ProductFamily } from "./ProductIllustration";

export interface HeroFlowStep {
  key: string;
  title: string;
  /** The one thing the product does at this step (existing copy), one line under the title. */
  caption: string;
  photo: { src: string | null; alt: string; family: ProductFamily };
}

/** Seconds per step: about a second resting on the card, then a second along the curve to the next. */
const STEP = 2;
/** The staggered column's inner width and the card's (px): the curves are drawn to these. */
const TRACK = 544;
const CARD = 336;
const LEFT_X = CARD / 2;
const RIGHT_X = TRACK - CARD / 2;
const GAP = 48;

/**
 * A hero's picture as the process it sells (owner direction 2026-10-30): white step cards — a real product photo,
 * the step's number, its title and what the product does there — staggered left and right on a tinted panel with a
 * fine dot texture, joined by a smooth hairline curve that a small green dot travels, resting a moment at each card
 * while the card lifts. One white chip in the corner carries the key promise. On a phone and tablet the cards
 * stack with the line down the left. Decoration is hidden from assistive tech; the steps are an ordered list.
 * Under reduced motion nothing moves and the first card stays highlighted. Supports 3–6 steps.
 */
export function HeroFlow({
  id,
  steps,
  label,
  promise,
  className,
}: {
  /** Unique on the page: names the texture pattern. */
  id: string;
  steps: readonly HeroFlowStep[];
  label: string;
  /** The corner chip: the one thing to remember. */
  promise: string;
  className?: string;
}) {
  const n = Math.min(6, Math.max(3, steps.length));
  const total = n * STEP;
  return (
    <figure
      aria-label={label}
      data-hero-flow={n}
      className={cn(
        "bg-primary-subtle rounded-panel relative isolate overflow-hidden px-5 py-8 sm:px-8 md:py-10",
        className,
      )}
    >
      {/* A fine dot texture (an SVG pattern: the design language has no CSS gradients). */}
      <svg
        aria-hidden="true"
        className="text-primary pointer-events-none absolute inset-0 -z-10 size-full opacity-[0.09]"
      >
        <defs>
          <pattern id={`${id}-dots`} width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.1" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id}-dots)`} />
      </svg>

      <span className="hero-float bg-surface border-border rounded-control shadow-overlay absolute end-4 top-4 z-[3] hidden items-center gap-2 border px-3 py-2 text-sm font-medium sm:flex md:end-6 md:top-6">
        <span aria-hidden="true" className="bg-primary text-primary-fg grid size-5 place-items-center rounded-full">
          <Icon name="check" size={12} />
        </span>
        {promise}
      </span>

      <ol className="relative mx-auto flex max-w-[34rem] flex-col gap-4 md:gap-12">
        {/* Phone and tablet: one line down the cards' left edge, a dot running down it. */}
        <span aria-hidden="true" className="bg-primary/40 absolute start-[2.75rem] top-8 bottom-8 w-px md:hidden">
          <span className="hero-flow-run bg-primary absolute -start-[3px] size-[7px] rounded-full" />
        </span>
        {steps.map((step, index) => {
          const right = index % 2 === 1;
          const drawing = (
            <span className="text-muted grid size-full place-items-center [--pi-stroke:1.2]">
              <ProductIllustration family={step.photo.family} className="max-w-[70%]" />
            </span>
          );
          return (
            <li
              key={step.key}
              style={{ "--i": index } as React.CSSProperties}
              className={cn(
                "hero-flow-card bg-surface rounded-card relative z-[1] flex items-center gap-4 p-3 pe-5 md:w-[21rem] md:p-4",
                "shadow-[0_1px_2px_rgb(30_27_24/0.06),0_12px_28px_-12px_rgb(30_27_24/0.18)]",
                right && "md:ms-auto",
              )}
            >
              <span className="bg-surface-subtle border-border grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border md:size-[4.5rem]">
                {step.photo.src ? (
                  <CardImage
                    src={step.photo.src}
                    alt={step.photo.alt}
                    className="size-full object-contain p-1.5"
                    loading={index < 2 ? "eager" : "lazy"}
                    fallback={drawing}
                  />
                ) : (
                  drawing
                )}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-primary text-xs font-semibold tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-[1.0625rem] leading-snug font-semibold">{step.title}</span>
                <span className="text-muted text-sm leading-snug text-pretty">{step.caption}</span>
              </span>

              {/* From md: the curve down to the next card, drawn in the gap under this one. */}
              {index < steps.length - 1 ? (
                <svg
                  aria-hidden="true"
                  width={TRACK}
                  height={GAP}
                  viewBox={`0 0 ${TRACK} ${GAP}`}
                  className={cn(
                    "pointer-events-none absolute top-full hidden max-w-none overflow-visible md:block",
                    right ? "end-0" : "start-0",
                  )}
                >
                  <path
                    d={
                      right
                        ? `M ${RIGHT_X} 0 C ${RIGHT_X} ${GAP * 0.7}, ${LEFT_X} ${GAP * 0.3}, ${LEFT_X} ${GAP}`
                        : `M ${LEFT_X} 0 C ${LEFT_X} ${GAP * 0.7}, ${RIGHT_X} ${GAP * 0.3}, ${RIGHT_X} ${GAP}`
                    }
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-primary/40"
                    id={`${id}-curve-${index}`}
                  />
                  <circle r="3.5" className="hero-flow-dot fill-primary" opacity="0">
                    {/* Rests on the card for the first half of its slot, travels the second half. */}
                    <animateMotion
                      dur={`${total}s`}
                      repeatCount="indefinite"
                      calcMode="linear"
                      keyPoints="0;0;1;1"
                      keyTimes={`0;${((index * STEP + STEP / 2) / total).toFixed(4)};${(((index + 1) * STEP) / total).toFixed(4)};1`}
                    >
                      <mpath href={`#${id}-curve-${index}`} />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      dur={`${total}s`}
                      repeatCount="indefinite"
                      calcMode="discrete"
                      values="0;1;0"
                      keyTimes={`0;${((index * STEP + STEP / 2) / total).toFixed(4)};${(((index + 1) * STEP) / total).toFixed(4)}`}
                    />
                  </circle>
                </svg>
              ) : null}
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
