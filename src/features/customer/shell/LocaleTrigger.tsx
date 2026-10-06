"use client";

import { useLocale } from "next-intl";

import { Button } from "@/ui/components/Button";

/**
 * The language button: the globe and the current language's code ("TH" / "EN"), so it says what
 * it does without opening it (UX audit, system-wide). The name keeps the visible code (WCAG 2.5.3).
 */
export function LocaleTrigger({ label, ...props }: { label: string } & React.ComponentProps<typeof Button>) {
  const locale = useLocale();
  const code = locale.toUpperCase();
  return (
    <Button
      variant="ghost"
      size="sm"
      iconStart="language"
      aria-label={`${label} ${code}`}
      aria-haspopup="menu"
      className="px-2 text-sm"
      {...props}
    >
      {code}
    </Button>
  );
}
