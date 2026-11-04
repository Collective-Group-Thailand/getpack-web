/**
 * Points in and out per month (loyalty P2 analytics; prototype `p2-loyalty-analytics.html`), drawn the way the admin
 * charts are (`ui/components/charts`): no chart library, a hairline dashed grid, one brand-green series — the points
 * earned, above the zero line — and the greys it is read against below it: redeemed (`muted`) and expired
 * (`border-strong`), stacked with a 2 px gap. 4 px rounded data ends, one direct label (the latest month), a legend,
 * and a `<title>` per month for hover. The drawing is hidden from assistive technology: the movement table under it
 * carries the same figures. Heights are drawing only; every number a reader sees is the API's, formatted.
 */

export interface MovementBar {
  key: string;
  /** The month, already formatted ("ต.ค."). */
  label: string;
  /** The month in full, for the hover title. */
  title: string;
  earned: number;
  redeemed: number;
  expired: number;
}

const W = 1000;
const H = 260;
const LEFT = 64;
const TOP = 24;
const BOTTOM = 26;

/** A round step for the axis: 1, 2 or 5 × a power of ten. */
function niceStep(max: number): number {
  if (max <= 0) return 1;
  const raw = max / 2;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

export function MovementChart({
  bars,
  label,
  legend,
  formatValue,
}: {
  bars: readonly MovementBar[];
  label: string;
  legend: { earned: string; redeemed: string; expired: string };
  formatValue: (value: number) => string;
}) {
  if (!bars.length) return null;
  const up = Math.max(...bars.map((bar) => bar.earned));
  const down = Math.max(...bars.map((bar) => bar.redeemed + bar.expired));
  const step = niceStep(Math.max(up, down));
  const top = Math.max(step, Math.ceil(up / step) * step);
  const bottom = Math.max(step, Math.ceil(down / step) * step);
  const plot = H - TOP - BOTTOM;
  const scale = plot / (top + bottom);
  const zero = TOP + top * scale;
  const slot = (W - LEFT) / bars.length;
  const width = Math.min(44, slot * 0.28);
  const ticks = [
    ...Array.from({ length: Math.round(top / step) + 1 }, (_, at) => at * step),
    ...Array.from({ length: Math.round(bottom / step) }, (_, at) => -(at + 1) * step),
  ];
  const last = bars.length - 1;
  const rounded = (x: number, y: number, w: number, h: number, downward: boolean) => {
    if (h <= 0) return "";
    const r = Math.min(4, h, w / 2);
    return downward
      ? `M${x},${y} v${h - r} q0,${r} ${r},${r} h${w - 2 * r} q${r},0 ${r},-${r} v-${h - r} z`
      : `M${x},${y} v-${h - r} q0,-${r} ${r},-${r} h${w - 2 * r} q${r},0 ${r},${r} v${h - r} z`;
  };

  return (
    <figure aria-label={label} className="m-0 flex flex-col gap-2">
      <div aria-hidden="true" className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-[0.8125rem]">
        {(
          [
            ["bg-primary", legend.earned],
            ["bg-muted", legend.redeemed],
            ["bg-border-strong", legend.expired],
          ] as const
        ).map(([fill, text]) => (
          <span key={text} className="inline-flex items-center gap-1.5">
            <span className={`${fill} size-2.5 rounded-[3px]`} />
            {text}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[40rem]" aria-hidden="true">
          {ticks.map((tick) => {
            const y = zero - tick * scale;
            return (
              <g key={tick}>
                <line
                  x1={LEFT - 8}
                  x2={W}
                  y1={y}
                  y2={y}
                  className={tick === 0 ? "stroke-border-strong" : "stroke-border"}
                  strokeDasharray={tick === 0 ? undefined : "3 3"}
                />
                <text x={LEFT - 14} y={y + 4} textAnchor="end" className="fill-muted text-[12px] tabular-nums">
                  {formatValue(Math.abs(tick))}
                </text>
              </g>
            );
          })}
          {bars.map((bar, at) => {
            const x = LEFT + at * slot + (slot - width * 2 - 6) / 2;
            const earned = bar.earned * scale;
            const redeemed = bar.redeemed * scale;
            const expired = bar.expired * scale;
            return (
              <g key={bar.key} className="hover:opacity-90">
                <title>{bar.title}</title>
                <rect x={LEFT + at * slot} y={TOP} width={slot} height={plot} className="fill-transparent" />
                <path d={rounded(x, zero, width, earned, false)} className="fill-primary" />
                <path d={`M${x + width + 6},${zero} v${redeemed} h${width} v-${redeemed} z`} className="fill-muted" />
                <path
                  d={rounded(x + width + 6, zero + redeemed + (redeemed > 0 ? 2 : 0), width, expired, true)}
                  className="fill-border-strong"
                />
                <text x={x + width + 3} y={H - 6} textAnchor="middle" className="fill-muted text-[12px]">
                  {bar.label}
                </text>
                {at === last ? (
                  <text
                    x={x + width / 2}
                    y={zero - earned - 8}
                    textAnchor="middle"
                    className="fill-fg text-[12px] font-semibold tabular-nums"
                  >
                    {formatValue(bar.earned)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </figure>
  );
}
