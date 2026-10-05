import { useTranslations } from "next-intl";

/** The three hardest concepts (U5.2 §3), each with its own short loop — our drawings, no video. */
export const DEMOS = ["measurement-basis", "bleed", "offset"] as const;
export type Demo = (typeof DEMOS)[number];

export const hasDemo = (slug: string): slug is Demo => (DEMOS as readonly string[]).includes(slug);

/**
 * A looping diagram for a glossary term: inside vs outside size, bleed past the cut, offset's
 * colour passes. Pure SVG and CSS on the motion tokens; with reduced motion it rests on its last
 * frame (src/ui/styles/base.css). The caption says in words what the picture shows.
 */
export function DemoLoop({ demo }: { demo: Demo }) {
  const t = useTranslations("help.demo");
  return (
    <figure className="flex flex-col gap-1">
      <svg
        viewBox="0 0 160 90"
        className="bg-surface-subtle h-24 w-full rounded-md"
        role="img"
        aria-label={t(`${demo}.alt`)}
      >
        {demo === "measurement-basis" ? (
          <>
            <rect
              x="40"
              y="15"
              width="80"
              height="60"
              rx="2"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-muted pk-demo-swap-alt"
            />
            <rect
              x="46"
              y="21"
              width="68"
              height="48"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              className="text-primary pk-demo-swap"
            />
            <text x="80" y="88" textAnchor="middle" fontSize="9" fill="currentColor" className="text-muted">
              {t("measurement-basis.label")}
            </text>
          </>
        ) : demo === "bleed" ? (
          <>
            <rect x="34" y="12" width="92" height="66" fill="currentColor" className="text-primary" opacity="0.25" />
            <g className="pk-demo-trim">
              <rect
                x="40"
                y="18"
                width="80"
                height="54"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="5 3"
                className="text-fg"
              />
            </g>
            <text x="80" y="88" textAnchor="middle" fontSize="9" fill="currentColor" className="text-muted">
              {t("bleed.label")}
            </text>
          </>
        ) : (
          <>
            {["#00a3e0", "#e6007e", "#ffd400", "#1e1b18"].map((colour, index) => (
              <rect
                key={colour}
                x="30"
                y={12 + index * 15}
                width="100"
                height="10"
                rx="2"
                fill={colour}
                className="pk-demo-pass"
                style={{ animationDelay: `${index * 0.4}s` }}
              />
            ))}
            <text x="80" y="88" textAnchor="middle" fontSize="9" fill="currentColor" className="text-muted">
              {t("offset.label")}
            </text>
          </>
        )}
      </svg>
      <figcaption className="text-muted text-xs">{t(`${demo}.caption`)}</figcaption>
    </figure>
  );
}
