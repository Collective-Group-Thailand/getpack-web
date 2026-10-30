"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { Button } from "@/ui/components/Button";
import { Sheet } from "@/ui/components/Sheet";

import { ClearFiltersButton, FilterPanel, type FilterPanelProps } from "./FilterPanel";

const WIDE = "(min-width: 48rem)";
const subscribeWide = (onChange: () => void) => {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/**
 * The sheet of `FilterSheet`, loaded on its first opening: from the right on a tablet and up (the grid stays in
 * view beside it), from the bottom on a phone.
 */
export default function FilterSheetBody({
  open,
  onOpenChange,
  ...panel
}: FilterPanelProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("styles.library");
  const tCommon = useTranslations("common");
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
  return (
    <Sheet
      side={wide ? "end" : "bottom"}
      className={wide ? "w-[min(24rem,calc(100vw-2rem))]" : undefined}
      open={open}
      onOpenChange={onOpenChange}
      title={t("filters")}
      closeLabel={tCommon("actions.close")}
      footer={
        <>
          <ClearFiltersButton params={panel.params} className="px-2" />
          <Button className="ms-auto" onClick={() => onOpenChange(false)}>
            {t("showResults", { count: panel.resultCount })}
          </Button>
        </>
      }
    >
      <FilterPanel {...panel} />
    </Sheet>
  );
}
