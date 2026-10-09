"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { bangkokToday, useRefresh } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { problemMessage } from "@/features/shared/actions";
import { useFormat } from "@/features/shared/format";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

/**
 * The factory's closures (U2.F7, D-161): shutdowns and the factory's own holidays on top of the
 * public calendar; a day the factory closes is not worked for its lead times and SLAs. Public
 * holidays are shown, not edited.
 */
export function ClosuresEditor({ days }: { days: Schemas["CalendarDayDto"][] }) {
  const t = useTranslations("partnerAccount.closures");
  const { factoryId, can } = useFactory();
  const [refresh] = useRefresh();
  const [day, setDay] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const editable = can("factory_profile.manage");
  const format = useFormat();
  // A calendar day ("2026-10-28") read as the rest of the app writes dates (Buddhist era in Thai).
  const dayText = (value: string) => format.date(`${value}T00:00:00+07:00`);

  const add = async () => {
    setBusy(true);
    try {
      await browserApi().PUT("/v1/partner/factories/{factoryId}/closures/{day}", {
        params: { path: { factoryId, day } },
        body: { nameTh: name.trim() },
      });
      toast.success(t("added", { date: dayText(day) }));
      setDay("");
      setName("");
      refresh();
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (date: string) => {
    try {
      await browserApi().DELETE("/v1/partner/factories/{factoryId}/closures/{day}", {
        params: { path: { factoryId, day: date } },
      });
      toast.success(t("removed", { date: dayText(date) }));
      refresh();
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {days.length === 0 ? <p className="text-muted text-sm">{t("none")}</p> : null}
      <ul className="flex flex-col gap-2">
        {days.map((d) => (
          <li
            key={`${d.day}-${d.kind}`}
            className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
          >
            <span>{t("row", { date: dayText(d.day), name: d.nameTh })}</span>
            <span className="flex items-center gap-2">
              <Badge tone={d.kind === "closure" ? "warning" : "neutral"}>{t(`kinds.${d.kind}`)}</Badge>
              {editable && d.kind === "closure" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger min-h-11 md:min-h-10"
                  onClick={() => void remove(d.day)}
                >
                  {t("remove")}
                  <span className="sr-only"> {dayText(d.day)}</span>
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {editable ? (
        <div className="border-border flex flex-col gap-3 rounded-lg border p-3">
          <Field label={t("day")}>
            <Input type="date" value={day} min={bangkokToday(1)} onChange={(event) => setDay(event.target.value)} />
          </Field>
          <Field label={t("name")} hint={t("nameHint")}>
            <Input
              placeholder={t("namePlaceholder")}
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <div>
            <Button
              className="min-h-11 md:min-h-10"
              loading={busy}
              disabled={!day || !name.trim()}
              onClick={() => void add()}
            >
              {t("add")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
