import { BrandLogo } from "@/ui/brand";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

export interface AuthSplitLayoutProps {
  /** `brand` — the storefront's teal; `ink` — the back office's dark panel (UX audit: staff login). */
  tone: "brand" | "ink";
  /** The panel's headline and the line under it. */
  headline: React.ReactNode;
  lead: React.ReactNode;
  /** Two or three short reasons to sign in, ticked. */
  points?: React.ReactNode[];
  /** A card at the panel's foot (the storefront's dieline note). */
  note?: { title: React.ReactNode; body: React.ReactNode };
  /** Links over the form's top corners: back home, and the other way in. */
  topStart?: React.ReactNode;
  topEnd?: React.ReactNode;
  /** The brand mark's link, rendered by the caller (a zone's own `Link`), around `BrandLockup`. */
  homeLink: (children: React.ReactNode) => React.ReactNode;
  children: React.ReactNode;
}

/**
 * The sign-in page of every zone (UX audit Flow 1, step 3): a brand panel on the left and the form
 * in a 440 px column on the right. Below `md` the panel steps aside and the form has the screen.
 *
 * The panel is decoration plus three honest sentences; the form is the page's `<main>`. One solid
 * hue, nothing over it (design language v3: no gradient, no texture, no label over the headline).
 */
export function AuthSplitLayout({
  tone,
  headline,
  lead,
  points = [],
  note,
  topStart,
  topEnd,
  homeLink,
  children,
}: AuthSplitLayoutProps) {
  return (
    <div className="bg-bg grid min-h-dvh md:grid-cols-[1.1fr_1fr]">
      <aside
        className={cn(
          "relative hidden flex-col overflow-hidden px-10 py-12 md:flex lg:px-16",
          // The storefront's panel is the brand green, flat (design language v3).
          tone === "brand" ? "bg-primary text-primary-fg" : "bg-fg text-fg-inverse",
        )}
      >
        <div className="relative">{homeLink(<BrandLockup />)}</div>

        <div className="relative my-auto max-w-[32rem] py-10">
          <p className="serif text-4xl leading-[1.1] lg:text-[3.625rem] [&_em]:text-current/70 [&_em]:not-italic">
            {headline}
          </p>
          <p className="mt-5 text-lg leading-relaxed opacity-80">{lead}</p>
          {points.length > 0 ? (
            <ul className="mt-9 grid gap-4">
              {points.map((point, index) => (
                <li key={index} className="flex items-start gap-3 text-base leading-normal opacity-90">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-current/15">
                    <Icon name="check" size={14} aria-hidden="true" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {note ? (
          <div className="rounded-control relative flex items-center gap-5 border border-current/20 bg-current/[0.06] p-6">
            <DielineSketch />
            <div>
              <p className="font-semibold">{note.title}</p>
              <p className="mt-1 text-sm leading-relaxed opacity-90">{note.body}</p>
            </div>
          </div>
        ) : null}
      </aside>

      <main id="main" className="relative flex flex-col items-center justify-center px-5 py-24 md:px-12 lg:px-16">
        {topStart || topEnd ? (
          // One row, so the two corners share the width instead of overlapping on a phone.
          <div className="absolute inset-x-5 top-6 flex items-start justify-between gap-4 md:inset-x-10">
            <div className="shrink-0">{topStart}</div>
            {topEnd ? <div className="min-w-0 text-end text-sm">{topEnd}</div> : null}
          </div>
        ) : null}
        <div className="w-full max-w-[27.5rem]">{children}</div>
      </main>
    </div>
  );
}

function BrandLockup() {
  return (
    // On the green panel the oval melts into it and the cream wordmark stands alone; on the dark
    // panel the whole oval shows. Either way the logo is used as supplied.
    <BrandLogo height={44} />
  );
}

/** A flat carton's outline with its fold lines dashed — getpack's own drawing, decorative. */
function DielineSketch() {
  return (
    <svg viewBox="0 0 200 120" aria-hidden="true" className="h-24 w-40 shrink-0">
      <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round">
        <path d="M12 34h24v52H12zM36 34h40v52H36zM76 34h24v52H76zM100 34h40v52h-40zM140 34h24v52h-24z" />
        <path d="M36 34V16q20-6 40 0v18M36 86v18q20 6 40 0V86M100 34V16q20-6 40 0v18M100 86v18q20 6 40 0V86" />
      </g>
      <path
        d="M36 34v52M76 34v52M100 34v52M140 34v52M36 34h104M36 86h104"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.6"
        strokeWidth="1.2"
        strokeDasharray="4 3"
      />
    </svg>
  );
}
