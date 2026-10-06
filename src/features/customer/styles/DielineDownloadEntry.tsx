"use client";

import { useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { Button } from "@/ui/components/Button";

import type { DielineDownloadProps } from "./DielineDownload";
import { DIELINE_FRAGMENT } from "./paths";

// The form (fields, selects, the layer guide) loads when asked for: a style page's first load
// stays within the marketing budget.
const DielineDownload = dynamic(() => import("./DielineDownload").then((m) => m.DielineDownload), { ssr: false });

const onHashChange = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};

/**
 * "ดาวน์โหลดแบบแผ่นคลี่ฟรี" on a style page (U2.F2): one button, then the download form. Signing in
 * for it comes back to `#dieline`, where the form is already open (U5.8, T12). The fragment never
 * reaches the server, so the page stays static; it is read once hydrated.
 */
export function DielineDownloadEntry(props: DielineDownloadProps) {
  const t = useTranslations("styles.dieline");
  const [asked, setAsked] = useState(false);
  const returned = useSyncExternalStore(
    onHashChange,
    () => window.location.hash === `#${DIELINE_FRAGMENT}`,
    () => false,
  );
  if (!props.sizeRanges.length) return null;
  return asked || returned ? (
    <DielineDownload {...props} />
  ) : (
    <Button variant="ghost" iconStart="download" onClick={() => setAsked(true)}>
      {t("title")}
    </Button>
  );
}
