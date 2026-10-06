"use client";

import { useRouter } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { DropdownMenu } from "@/ui/components/DropdownMenu";

/**
 * The navbar's secondary pages between 1024 and 1279 px (round 2, responsive acceptance): their
 * labels do not fit beside the products menu there, so they fold into "เพิ่มเติม". From 1280 the
 * approved navbar shows them all.
 */
export function MoreLinks({ label, links }: { label: string; links: readonly [string, string][] }) {
  const router = useRouter();
  return (
    <DropdownMenu
      label={label}
      trigger={
        <Button variant="ghost" size="sm" iconEnd="chevron-down" className="h-10 text-sm font-medium xl:hidden">
          {label}
        </Button>
      }
      items={links.map(([href, text]) => ({ id: href, label: text, onSelect: () => router.push(href) }))}
    />
  );
}
