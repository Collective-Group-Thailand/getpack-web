"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/ui/components/Button";

import type { FilterPanelProps } from "./FilterPanel";

const FilterSheetBody = dynamic(() => import("./FilterSheetBody"), { ssr: false });

/**
 * The filters on a phone or a narrow window (≤ 1040 px, styles redesign §3): one button with how
 * many are on, opening the same panel as a bottom sheet — focus trapped, Escape closes, focus
 * returns to the button. The sheet's code loads on the first tap.
 */
export function FilterSheet({ active, ...panel }: FilterPanelProps & { active: number }) {
  const t = useTranslations("styles.library");
  const tList = useTranslations("styles.list");
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        iconStart="filter"
        aria-haspopup="dialog"
        onClick={() => {
          setLoaded(true);
          setOpen(true);
        }}
      >
        {t("filters")}
        {active ? <span className="text-primary tabular-nums">{tList("count", { count: active })}</span> : null}
      </Button>
      {loaded ? <FilterSheetBody open={open} onOpenChange={setOpen} {...panel} /> : null}
    </>
  );
}
