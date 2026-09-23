import { NextIntlClientProvider } from "next-intl";

import { QueryProvider } from "@/lib/query";
import type { Zone } from "@/lib/zones";
import { Toaster } from "@/ui/components/Toast";
import { ThemeProvider } from "@/ui/theme";
import type { ThemeChoice } from "@/ui/theme/themes";

/**
 * The provider stack every zone's root layout wraps its tree in.
 *
 * Each zone keeps its own `<html>`, fonts and metadata — that is the point of three root
 * layouts (00-master-plan.md §2) — but the order these four providers nest in is not a
 * per-zone decision, and three copies of it would drift.
 */
export function ZoneProviders({
  zone,
  themeChoice,
  children,
}: {
  zone: Zone;
  themeChoice: ThemeChoice;
  children: React.ReactNode;
}) {
  return (
    <NextIntlClientProvider>
      <ThemeProvider initialChoice={themeChoice} zone={zone}>
        <QueryProvider>{children}</QueryProvider>
        {/* One toaster per zone: toasts belong to the current page (design-system.md §4). */}
        <Toaster />
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
