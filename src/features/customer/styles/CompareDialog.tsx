"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Dialog } from "@/ui/components/Dialog";

/**
 * The comparison's dialog over the library: large on a wide screen, nearly the whole screen on a phone; focus
 * trapped, Escape and the close button go back to the grid with the choice kept.
 */
export function CompareDialog({ title, children }: { title: string; children: React.ReactNode }) {
  const tCommon = useTranslations("common");
  const router = useRouter();
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && router.back()}
      title={title}
      closeLabel={tCommon("actions.close")}
      size="xl"
      className="max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-6xl md:max-h-[min(92dvh,56rem)]"
    >
      {children}
    </Dialog>
  );
}
