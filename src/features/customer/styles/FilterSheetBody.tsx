"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/ui/components/Button";
import { Sheet } from "@/ui/components/Sheet";

import { ClearFiltersButton, FilterPanel, type FilterPanelProps } from "./FilterPanel";

/** The bottom sheet of `FilterSheet`, loaded on its first opening. */
export default function FilterSheetBody({
  open,
  onOpenChange,
  ...panel
}: FilterPanelProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("styles.library");
  const tCommon = useTranslations("common");
  return (
    <Sheet
      side="bottom"
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
