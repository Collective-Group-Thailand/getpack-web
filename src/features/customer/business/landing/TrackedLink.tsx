"use client";

import { Link } from "@/i18n/navigation";
import { trackBusiness } from "@/lib/analytics/business";

type Props = Omit<React.ComponentProps<typeof Link>, "onClick"> & {
  /** `biz_cta` on /business, `fx_cta` on /partner-with-us (business pack analytics). */
  event: "biz_cta" | "fx_cta";
  target: string;
};

/** A link that reports its CTA target (no personal data) before it navigates. */
export function TrackedLink({ event, target, ...props }: Props) {
  return <Link {...props} onClick={() => trackBusiness(event, { target })} />;
}

/** The same for an in-page anchor (`#sales`, `#apply`): a plain `<a>`, no navigation. */
export function TrackedAnchor({
  event,
  target,
  ...props
}: React.ComponentProps<"a"> & { event: "biz_cta" | "fx_cta"; target: string }) {
  return <a {...props} onClick={() => trackBusiness(event, { target })} />;
}
