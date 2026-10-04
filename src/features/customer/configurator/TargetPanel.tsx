"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { pick } from "@/features/customer/catalog/localize";
import { useFormat } from "@/features/shared/format/useFormat";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { Skeleton } from "@/ui/components/Skeleton";

import { optionsById, type Configurator } from "./model";
import type { Lever } from "./useQuoteActions";

export interface TargetPanelProps {
  configurator: Configurator;
  /** The target as sent (D-247). */
  target: string;
  /** The gap the API worked out for the quantity on screen (`QuoteCalculationDto.target`). */
  gap: Schemas["QuoteStepGapDto"] | null;
  unit: string;
  levers: UseQueryResult<Schemas["QuoteLeversDto"]> | null;
  onShowLevers: () => void;
  onApply: (lever: Lever) => void;
  onSendToCs: (notes: string) => void;
  busy: boolean;
}

/**
 * The target price (U2.F1 §4, D-247–D-251): at or below it, a positive state; above it, the ways
 * to get there that the API worked out with the real engine — each a card with its new price per
 * piece ("เพิ่มเป็น 3,000 ชิ้น → ฿x.xx/ชิ้น"), taken in one click — and "คุยกับทีมขาย", which sends
 * the whole configuration and the target as a request for quote. The target is never shown to a
 * factory (D-190); nothing here compares or computes a price.
 */
export function TargetPanel({
  configurator,
  target,
  gap,
  unit,
  levers,
  onShowLevers,
  onApply,
  onSendToCs,
  busy,
}: TargetPanelProps) {
  const t = useTranslations("configurator.target");
  const format = useFormat();
  const locale = useLocale();
  const [asking, setAsking] = useState(false);
  const [notes, setNotes] = useState("");
  if (!gap) return null;

  const byId = optionsById(configurator);
  const nameOf = (id: unknown) => {
    const option = typeof id === "string" ? byId.get(id) : undefined;
    return option ? pick(locale, option.nameTh, option.nameEn) : t("anotherMaterial");
  };
  const titleOf = (lever: Lever) => {
    const change = (lever.changes ?? {}) as Record<string, { to?: unknown } | undefined>;
    if (lever.kind === "quantity") {
      const to = Array.isArray(change.quantities?.to) ? (change.quantities.to as number[]) : [];
      return t("levers.quantity", { quantities: to.map((quantity) => format.number(quantity)).join(", "), unit });
    }
    if (lever.kind === "material") return t("levers.material", { name: nameOf(change.materialId?.to) });
    return t(`levers.${lever.kind}`);
  };
  const absolute = (value: string) => (value.startsWith("-") ? value.slice(1) : value);

  return (
    <section aria-labelledby="target-title" className="border-border flex flex-col gap-3 rounded-2xl border p-4">
      <h3 id="target-title" className="font-semibold">
        {t("title", { target: format.thb(target), unit })}
      </h3>
      {gap.meetsTarget ? (
        <Callout tone="success" live title={t("meets")}>
          {t("meetsBody", { gap: format.thb(absolute(gap.gapPerUnit)), unit })}
        </Callout>
      ) : (
        <Callout tone="warning" live title={t("above")}>
          {t("aboveBody", { gap: format.thb(gap.gapPerUnit), pct: format.percent(gap.gapPct, 1), unit })}
        </Callout>
      )}
      {!gap.meetsTarget ? (
        <div className="flex flex-wrap gap-2">
          {!levers ? (
            <Button size="sm" variant="secondary" iconStart="sparkles" onClick={onShowLevers} loading={busy}>
              {t("showLevers")}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" iconStart="chat" onClick={() => setAsking(true)}>
            {t("askSales")}
          </Button>
        </div>
      ) : null}

      {levers?.isLoading ? <Skeleton className="h-24 w-full" /> : null}
      {levers?.data ? (
        levers.data.levers.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2" aria-label={t("leversLabel")}>
            {levers.data.levers.map((lever) => (
              <li key={lever.id} className="border-border flex flex-col gap-2 rounded-xl border p-3">
                <p className="font-medium">{titleOf(lever)}</p>
                <ul className="flex flex-col gap-1 text-sm tabular-nums">
                  {lever.steps.map((step) => (
                    <li key={step.quantity} className="flex flex-wrap items-center gap-2">
                      {t("step", {
                        quantity: format.number(step.quantity),
                        unit,
                        price: format.thb(step.unitPrice),
                      })}
                      {step.meetsTarget ? (
                        <Badge tone="success" size="sm">
                          {t("meetsBadge")}
                        </Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <p className="text-muted text-xs">
                  {t("saving", { pct: format.percent(lever.bestSavingPct, 1) })} ·{" "}
                  {t("validUntil", { date: format.date(lever.validUntil) })}
                </p>
                <Button size="sm" variant="secondary" onClick={() => onApply(lever)} loading={busy}>
                  {t("apply")}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted text-sm">{t(`status.${levers.data.status}`)}</p>
        )
      ) : null}
      <p className="text-muted text-xs">{t("private")}</p>

      <Dialog
        open={asking}
        onOpenChange={setAsking}
        title={t("askTitle")}
        description={t("askBody")}
        closeLabel={t("close")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsking(false)}>
              {t("cancel")}
            </Button>
            <Button
              loading={busy}
              onClick={() => {
                onSendToCs(notes);
                setAsking(false);
              }}
            >
              {t("send")}
            </Button>
          </>
        }
      >
        <Field label={t("notes")} hint={t("notesHint")}>
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={1000} />
        </Field>
      </Dialog>
    </section>
  );
}
