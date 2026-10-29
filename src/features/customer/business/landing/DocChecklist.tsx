"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { trackBusiness } from "@/lib/analytics/business";
import { Checkbox } from "@/ui/components/Checkbox";
import { Meter } from "@/ui/components/Meter";
import { cn } from "@/ui/lib/cn";

import { ALL_DOCS, docsReady, readDocs, REQUIRED_DOCS, type DocKey } from "./rules";

/** Kept on this device only (business pack Phase 1 item 6): nothing is sent anywhere. */
const STORAGE_KEY = "pk_business_docs";

/** Re-renders the checklist when it changes here or in another tab. */
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
function snapshot(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    // Storage refused (private mode): the list simply starts empty.
    return "[]";
  }
}

/** "เตรียมเอกสารให้พร้อม": the KYC documents to have at hand, ticked and remembered in this browser only. */
export function DocChecklist() {
  const t = useTranslations("business.landing.applySection");
  const checked = readDocs(useSyncExternalStore(subscribe, snapshot, () => "[]"));

  function toggle(key: DocKey, on: boolean) {
    const next = on ? [...new Set([...checked, key])] : checked.filter((candidate) => candidate !== key);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Not remembered (storage refused): the tick cannot be kept.
    }
    listeners.forEach((listener) => listener());
    if (on) trackBusiness("biz_doc_check", { n: docsReady(next) });
  }

  const ready = docsReady(checked);
  const text = ready === REQUIRED_DOCS.length ? t("ready") : ready > 0 ? t("partial", { n: ready }) : t("none");
  return (
    <div className="border-border bg-surface rounded-panel flex flex-col gap-3 border p-5.5">
      <h3 className="text-lg font-semibold">{t("docsTitle")}</h3>
      <p className="text-muted -mt-1.5 text-sm">{t("docsLead")}</p>
      <ul className="flex flex-col gap-2">
        {ALL_DOCS.map((key) => {
          const on = checked.includes(key);
          return (
            <li
              key={key}
              className={cn(
                "rounded-card border px-3 py-2.5 transition-colors",
                on ? "bg-success-subtle border-transparent" : "border-border",
              )}
            >
              <Checkbox
                checked={on}
                onCheckedChange={(next) => toggle(key, next === true)}
                label={
                  <span>
                    <b className="block text-sm font-semibold">{t(`docs.${key}.title`)}</b>
                    <small className="text-muted block text-[12.5px]">{t(`docs.${key}.body`)}</small>
                  </span>
                }
              />
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <Meter
          value={(ready / REQUIRED_DOCS.length) * 100}
          label={t("progress")}
          valueText={text}
          tone="success"
          className="min-w-[120px] flex-1"
        />
        <span className={cn("text-[13px]", ready === REQUIRED_DOCS.length ? "text-success-subtle-fg" : "text-muted")}>
          {text}
        </span>
      </div>
    </div>
  );
}
