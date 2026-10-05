"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { Button } from "@/ui/components/Button";

import type { DielineDownloadProps } from "./DielineDownload";

// The form (fields, selects, the layer guide) loads when asked for: a style page's first load
// stays within the marketing budget.
const DielineDownload = dynamic(() => import("./DielineDownload").then((m) => m.DielineDownload), { ssr: false });

/** "ดาวน์โหลดแบบแผ่นคลี่ฟรี" on a style page (U2.F2): one button, then the download form. */
export function DielineDownloadEntry(props: DielineDownloadProps) {
  const t = useTranslations("styles.dieline");
  const [open, setOpen] = useState(false);
  if (!props.sizeRanges.length) return null;
  return open ? (
    <DielineDownload {...props} />
  ) : (
    <Button variant="ghost" iconStart="download" onClick={() => setOpen(true)}>
      {t("title")}
    </Button>
  );
}
