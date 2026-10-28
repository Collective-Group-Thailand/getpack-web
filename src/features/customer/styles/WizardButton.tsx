"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { trackCatalog } from "@/lib/analytics/catalog";
import { Button } from "@/ui/components/Button";

import type { ListParams } from "./query";

// Heavy UI on demand (styles redesign perf budget): the dialog loads on the first click.
const StyleWizard = dynamic(() => import("./StyleWizard"), { ssr: false });

/** "ช่วยเลือกให้หน่อย" (C0): opens the wizard over the library. Rendered only behind `FEATURE_STYLES_WIZARD`. */
export function WizardButton({ params }: { params: ListParams }) {
  const t = useTranslations("styles.library");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconStart="help"
        onClick={() => {
          setOpen(true);
          trackCatalog("catalog_wizard", { action: "open", step: 1 });
        }}
      >
        {t("wizardOpen")}
      </Button>
      {open ? <StyleWizard params={params} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
