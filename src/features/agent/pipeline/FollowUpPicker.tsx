"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";

import { fromLocalInput, quickFollowUp, toLocalInput, type QuickFollowUp } from "./dates";
import { useProblemText } from "./problem";

/**
 * When to follow up (D-468 §1): the current date, three quick choices — พรุ่งนี้ 10:00 · 3 วัน · 1 สัปดาห์, worked out
 * on the Bangkok calendar — or a date and time of the agent's own. Saved with `If-Match`; the API re-arms the reminder
 * and holds it until 08:00 when it would fall in the quiet hours.
 */
export function FollowUpPicker({
  leadId,
  etag,
  current,
}: {
  leadId: string;
  etag: string | null;
  current: string | null;
}) {
  const t = useTranslations("agentSales.followUp");
  const format = useFormat();
  const problemText = useProblemText();
  const router = useRouter();
  const [custom, setCustom] = useState(false);
  const [value, setValue] = useState(toLocalInput(current));
  const [busy, setBusy] = useState<string | null>(null);

  const save = async (at: string | null, key: string) => {
    setBusy(key);
    try {
      await browserApi().PATCH("/v1/store/agent/leads/{leadId}", {
        params: { path: { leadId }, header: { "If-Match": etag ?? "" } },
        body: { nextFollowUpAt: at },
      });
      toast.success(at ? t("saved", { at: format.dateTime(at) }) : t("cleared"));
      setCustom(false);
      router.refresh();
    } catch (error) {
      toast.error(isApiError(error) && error.isStale ? t("stale") : problemText(error));
      if (isApiError(error) && error.isStale) router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const quick = (choice: QuickFollowUp) => void save(quickFollowUp(choice), choice);

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-base">
        <Icon name="calendar" size={18} aria-hidden="true" className="text-muted" />
        {current ? (
          <span>
            {t("next")} <strong className="font-semibold">{format.dateTime(current)}</strong>
          </span>
        ) : (
          <span className="text-muted">{t("none")}</span>
        )}
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("quickLabel")}>
        {(["tomorrow", "threeDays", "week"] as const).map((choice) => (
          <Button
            key={choice}
            size="sm"
            variant="secondary"
            className="min-h-11 sm:min-h-8"
            loading={busy === choice}
            disabled={Boolean(busy)}
            onClick={() => quick(choice)}
          >
            {t(`quick.${choice}`)}
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="min-h-11 sm:min-h-8"
          aria-expanded={custom}
          onClick={() => setCustom((open) => !open)}
        >
          {t("custom")}
        </Button>
        {current ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted min-h-11 sm:min-h-8"
            loading={busy === "clear"}
            disabled={Boolean(busy)}
            onClick={() => void save(null, "clear")}
          >
            {t("clear")}
          </Button>
        ) : null}
      </div>
      {custom ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const at = fromLocalInput(value);
            if (at) void save(at, "custom");
          }}
        >
          <Field label={t("customLabel")} className="min-w-0 flex-1 sm:max-w-xs">
            <Input type="datetime-local" value={value} onChange={(event) => setValue(event.target.value)} className="min-h-11 sm:min-h-0" />
          </Field>
          <Button type="submit" loading={busy === "custom"} disabled={!fromLocalInput(value)} className="min-h-11 sm:min-h-0">
            {t("save")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
