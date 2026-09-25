import { NextIntlClientProvider } from "next-intl";

import { WebVitals } from "@/lib/observability";
import { QueryProvider } from "@/lib/query";
import { RealtimeProvider } from "@/lib/realtime";
import type { Zone } from "@/lib/zones";
import { Toaster } from "@/ui/components/Toast";
import { TooltipProvider } from "@/ui/components/Tooltip";
import { ThemeProvider } from "@/ui/theme";
import type { ThemeChoice } from "@/ui/theme/themes";

import { HydrationMark } from "./HydrationMark";

/**
 * The provider stack every zone's root layout wraps its tree in.
 *
 * Each zone keeps its own `<html>`, fonts and metadata — that is the point of three root
 * layouts (00-master-plan.md §2) — but the order these providers nest in is not a per-zone
 * decision, and three copies of it would drift.
 *
 * `TooltipProvider` is here rather than at each call site because Radix's `Tooltip.Root`
 * throws without a provider above it. Storybook had one in its own preview decorator, so
 * every tooltip story worked while the first tooltip rendered in the actual app — the
 * collapsed admin sidebar — took the whole sidebar down with it.
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
        <TooltipProvider>
          <QueryProvider>
            {children}
            {/* Inside QueryProvider: it needs the client whose caches it invalidates. */}
            <RealtimeProvider zone={zone} />
          </QueryProvider>
        </TooltipProvider>
        {/* One toaster per zone: toasts belong to the current page (design-system.md §4). */}
        <Toaster />
        {/* Renders nothing; reports field Web Vitals through this zone's BFF. */}
        <WebVitals zone={zone} />
        <HydrationMark />
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
