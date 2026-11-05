import Link from "next/link";

import { Badge } from "@/ui/components/Badge";
import { Meter } from "@/ui/components/Meter";
import { Ticket } from "@/ui/components/Ticket";
import { cn } from "@/ui/lib/cn";

/**
 * One co-funding offer as a horizontal ticket (loyalty P4, D-486 in system green; prototype
 * `p4-partner-cofunding.html`): the stub is the factory's share ("40%" over "ของส่วนลดดีล", or "฿150" over
 * "ต่อออเดอร์"), the body is the deal and its one line of terms, the footer carries the state — the one amber badge
 * "รอตอบรับ" with the respond-by date (a static date, never a countdown), or the accrued / cap meter. A closed offer
 * has a neutral stub. Every string comes formatted from the page.
 */
export function OfferTicket({
  href,
  share,
  shareUnit,
  title,
  meta,
  status,
  closed = false,
  waiting,
  use,
  linkLabel,
}: {
  href: string;
  share: string;
  shareUnit: string;
  title: string;
  meta: string;
  status: { label: string; tone: "accent" | "success" | "neutral" };
  closed?: boolean;
  /** "ตอบภายใน …" for an offer awaiting an answer. */
  waiting?: string;
  /** Accepted: the accrued of cap line and its percentage. */
  use?: { text: string; pct: number };
  linkLabel: string;
}) {
  return (
    <Ticket
      orientation="horizontal"
      stubSize={104}
      tone={closed ? "spent" : "normal"}
      className="h-full"
      stub={
        <span className="flex h-full flex-col justify-center gap-1 px-3.5 sm:px-4">
          <span className="text-[1.625rem] leading-none font-semibold tracking-tight tabular-nums sm:text-[1.875rem]">
            {share}
          </span>
          <span className="text-xs leading-snug font-medium">{shareUnit}</span>
        </span>
      }
      bodyClassName="flex min-w-0 flex-1 flex-col gap-0.5 px-4 py-3.5"
    >
      <h3 className={cn("text-[0.96875rem] leading-snug font-semibold", closed && "text-muted")}>
        <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
          {title}
        </Link>
      </h3>
      <p className="text-muted text-[0.8125rem]">{meta}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pt-2.5 text-[0.8125rem]">
        {use ? (
          <span className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5">
            <span className="text-muted tabular-nums">{use.text}</span>
            <Badge size="sm" tone={status.tone}>
              {status.label}
            </Badge>
            <Meter className="col-span-2 h-1.5" value={use.pct} label={status.label} valueText={use.text} />
          </span>
        ) : (
          <>
            <span className="text-muted flex flex-wrap items-center gap-2">
              <Badge size="sm" tone={status.tone}>
                {status.label}
              </Badge>
              {waiting ? <span className="tabular-nums">{waiting}</span> : null}
            </span>
            <span aria-hidden="true" className="text-primary font-medium underline underline-offset-4">
              {linkLabel}
            </span>
          </>
        )}
      </div>
    </Ticket>
  );
}
