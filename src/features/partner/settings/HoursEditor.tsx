"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { bangkokToday, useRefresh } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { problemMessage } from "@/features/shared/actions";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

type Hours = Schemas["WeeklyHoursDto"];
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The factory's weekly hours (U2.F7, D-292): each day open or closed with its window, in force from a
 * Bangkok day no earlier than tomorrow. They replace the platform's weekend and business hours for
 * this factory's acceptance deadlines and promised dates — new jobs only: an accepted job's dates
 * never move (said here, since the API has no preview of the effect).
 */
export function HoursEditor({ current }: { current: Hours | null }) {
  const t = useTranslations("partnerAccount.hours");
  const { factoryId, can } = useFactory();
  const [refresh] = useRefresh();
  const [hours, setHours] = useState<Hours>(
    current ?? {
      mon: { from: "08:00", to: "17:00" },
      tue: { from: "08:00", to: "17:00" },
      wed: { from: "08:00", to: "17:00" },
      thu: { from: "08:00", to: "17:00" },
      fri: { from: "08:00", to: "17:00" },
      sat: null,
      sun: null,
    },
  );
  const [from, setFrom] = useState(bangkokToday(1));
  const [busy, setBusy] = useState(false);
  const editable = can("factory_profile.manage");
  const valid = DAYS.every(
    (d) => !hours[d] || (TIME.test(hours[d]!.from) && TIME.test(hours[d]!.to) && hours[d]!.from < hours[d]!.to),
  );

  const save = async () => {
    setBusy(true);
    try {
      await browserApi().PUT("/v1/partner/factories/{factoryId}/business-hours", {
        params: { path: { factoryId } },
        body: { effectiveFrom: from, hours },
      });
      toast.success(t("saved", { date: from }));
      refresh();
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {DAYS.map((day) => {
          const open = hours[day];
          return (
            <li key={day} className="border-border flex flex-col gap-2 rounded-lg border p-3">
              <Checkbox
                label={t(`days.${day}`)}
                checked={!!open}
                disabled={!editable}
                onCheckedChange={(on) => setHours((h) => ({ ...h, [day]: on ? { from: "08:00", to: "17:00" } : null }))}
              />
              {open ? (
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t("opens", { day: t(`days.${day}`) })}>
                    <Input
                      type="time"
                      value={open.from}
                      disabled={!editable}
                      onChange={(event) => setHours((h) => ({ ...h, [day]: { ...open, from: event.target.value } }))}
                    />
                  </Field>
                  <Field label={t("closes", { day: t(`days.${day}`) })}>
                    <Input
                      type="time"
                      value={open.to}
                      disabled={!editable}
                      onChange={(event) => setHours((h) => ({ ...h, [day]: { ...open, to: event.target.value } }))}
                    />
                  </Field>
                </div>
              ) : (
                <p className="text-muted text-sm">{t("closed")}</p>
              )}
            </li>
          );
        })}
      </ul>
      {editable ? (
        <>
          <Field label={t("effectiveFrom")} hint={t("effectiveHint")}>
            <Input type="date" value={from} min={bangkokToday(1)} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <p className="text-muted text-sm">{t("effect")}</p>
          <div>
            <Button className="min-h-12" loading={busy} disabled={!valid} onClick={() => void save()}>
              {t("save")}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-muted text-sm">{t("readOnly")}</p>
      )}
    </div>
  );
}
