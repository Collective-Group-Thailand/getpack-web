"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";

import { sampleHref } from "./paths";

/**
 * "ลองเล่นกับแบบตัวอย่าง" (U5.2 §2): a ready tuck-end box straight in the design step, to try the
 * tools before choosing anything. It is an ordinary new design — autosaved (DECISIONS-STAGE-A §2) and
 * deleted from "แบบของฉัน" like any other.
 */
export function SampleDesignLink({ productSlug }: { productSlug: string | null }) {
  const t = useTranslations("studio.start");
  return (
    <div className="flex flex-col gap-1">
      <Button asChild variant="ghost" iconStart="sparkles">
        <Link href={sampleHref(productSlug)}>{t("sample")}</Link>
      </Button>
      <p className="text-muted text-xs">{t("sampleNote")}</p>
    </div>
  );
}
