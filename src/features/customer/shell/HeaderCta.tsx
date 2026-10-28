"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";

/**
 * The header's call to action: "เริ่มออกแบบฟรี" → `/studio` everywhere but on `/studio` itself, where it would link to
 * the page the customer is on — there it is "สินค้าและราคา" (studio redesign Phase 1 item 8).
 */
export function HeaderCta({
  className,
  startLabel,
  productsLabel,
}: {
  className?: string;
  startLabel: string;
  productsLabel: string;
}) {
  const onStudio = usePathname() === "/studio";
  return (
    <Button asChild size="md" variant={onStudio ? "secondary" : "primary"} className={className}>
      {onStudio ? <Link href="/products">{productsLabel}</Link> : <Link href="/studio">{startLabel}</Link>}
    </Button>
  );
}
