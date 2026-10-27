"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { trackCatalog } from "@/lib/analytics/catalog";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Dialog } from "@/ui/components/Dialog";
import { cn } from "@/ui/lib/cn";

import {
  listHref,
  toQuery,
  WIZARD_ITEMS,
  WIZARD_PLACES,
  type ListParams,
  type WizardAnswers,
  type WizardItem,
  type WizardPlace,
} from "./query";
import { wizardItemKey, wizardPlaceKey } from "./wizard-labels";

/**
 * "ช่วยเลือกให้หน่อย" (styles redesign Phase 2 §3, C0): a dialog that asks what goes in and where
 * the box goes, counts the matching styles live (the API's `useCase` groups, so the count is the
 * list's), and leaves its answers in the URL as one removable chip. The third question (budget per
 * piece) waits for price data on quote-only styles (D-220: no estimates) — it is not asked.
 */
export default function StyleWizard({ params, onClose }: { params: ListParams; onClose: () => void }) {
  const t = useTranslations("styles");
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<WizardAnswers>(params.wizard ?? { items: [], place: [] });
  const [count, setCount] = useState<{ key: string; n: number | null }>({ key: "", n: null });
  const steps = 2;
  const next: ListParams = { ...params, wizard: answers.items.length || answers.place.length ? answers : undefined };
  const key = JSON.stringify(toQuery(next, 1));

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { browserApi } = await import("@/lib/api/browser");
        const query = JSON.parse(key) as ReturnType<typeof toQuery>;
        const { data } = await browserApi().GET("/v1/store/styles", { params: { query } });
        if (!live) return;
        const categories = data?.facets.category ?? [];
        const n = query.category
          ? (categories.find((c) => c.value === query.category)?.count ?? 0)
          : categories.reduce((sum, c) => sum + c.count, 0);
        setCount({ key, n: data ? n : null });
      } catch {
        if (live) setCount({ key, n: null });
      }
    })();
    return () => {
      live = false;
    };
  }, [key]);
  const shown = count.key === key ? count.n : null;

  const toggle = <K extends keyof WizardAnswers>(k: K, value: WizardAnswers[K][number]) =>
    setAnswers((a) => {
      const list = a[k] as string[];
      const updated = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      trackCatalog("catalog_wizard", { action: "answer", step: step + 1, answers: `${k}:${updated.join(",")}` });
      return { ...a, [k]: updated };
    });

  const options =
    step === 0
      ? (Object.keys(WIZARD_ITEMS) as WizardItem[]).map((v) => ({
          value: v,
          label: t(wizardItemKey(v)),
          hint: v === "*" ? t("library.wizardItemAnyHint") : null,
          on: answers.items.includes(v),
          toggle: () => toggle("items", v),
        }))
      : (Object.keys(WIZARD_PLACES) as WizardPlace[]).map((v) => ({
          value: v,
          label: t(wizardPlaceKey(v)),
          hint: v === "serve" ? null : t(`${wizardPlaceKey(v)}Hint`),
          on: answers.place.includes(v),
          toggle: () => toggle("place", v),
        }));

  const close = () => {
    trackCatalog("catalog_wizard", { action: "close", step: step + 1 });
    onClose();
  };
  const finish = () => {
    trackCatalog("catalog_wizard", {
      action: "complete",
      step: steps,
      answers: `items:${answers.items.join(",")};place:${answers.place.join(",")}`,
      result_count: shown ?? undefined,
    });
    onClose();
    startTransition(() => router.push(listHref({ ...next, style: undefined })));
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : close())}
      title={t("library.wizardTitle")}
      closeLabel={t("library.wizardClose")}
      footer={
        <>
          <span className="text-muted me-auto text-sm tabular-nums" aria-live="polite">
            {shown === null ? t("library.wizardCounting") : t("library.wizardCount", { count: shown })}
          </span>
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(0)}>
              {t("library.wizardBack")}
            </Button>
          ) : null}
          {step < steps - 1 ? (
            <Button onClick={() => setStep(step + 1)}>{t("library.wizardNext")}</Button>
          ) : (
            <Button onClick={finish} disabled={shown === 0}>
              {shown === null ? t("library.wizardNext") : t("library.wizardShow", { count: shown })}
            </Button>
          )}
        </>
      }
    >
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: steps }, (_, i) => (
          <i key={i} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-border")} />
        ))}
      </div>
      <p className="text-muted mt-4 text-xs">{t("library.wizardStep", { step: step + 1, total: steps })}</p>
      <h3 className="mt-1 text-lg font-semibold">
        {step === 0 ? t("library.wizardItemsQ") : t("library.wizardPlaceQ")}
      </h3>
      <p className="text-muted text-sm">{step === 0 ? t("library.wizardItemsHint") : t("library.wizardPlaceHint")}</p>
      <div
        className="mt-4 grid grid-cols-2 gap-2"
        role="group"
        aria-label={step === 0 ? t("library.wizardItemsQ") : t("library.wizardPlaceQ")}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.on}
            onClick={o.toggle}
            className={cn(
              "rounded-card focus-visible:ring-focus-ring flex min-h-12 flex-col items-start justify-center border px-3 py-2 text-start text-sm font-medium outline-none focus-visible:ring-2",
              o.on ? "border-primary bg-primary-subtle text-primary-subtle-fg" : "border-border hover:bg-bg-subtle",
            )}
          >
            {o.label}
            {o.hint ? <small className="text-muted text-xs font-normal">{o.hint}</small> : null}
          </button>
        ))}
      </div>
    </Dialog>
  );
}
