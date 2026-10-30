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
      {/* A week reads as a timetable: one line a day, open and close side by side. On a narrow phone
          the two times drop under the day instead of squeezing the time boxes. */}
      <div className="border-border bg-surface overflow-hidden rounded-xl border">
        <div
          aria-hidden="true"
          className="border-border bg-surface-subtle text-muted hidden grid-cols-[minmax(0,1fr)_10rem_10rem] gap-3 border-b px-3 py-2.5 text-sm font-medium sm:grid"
        >
          <span>{t("table.day")}</span>
          <span>{t("table.opens")}</span>
          <span>{t("table.closes")}</span>
        </div>
        <ul>
          {DAYS.map((day) => {
            const open = hours[day];
            const name = t(`days.${day}`);
            return (
              <li
                key={day}
                className="border-border grid grid-cols-2 items-center gap-x-3 gap-y-2 border-b px-3 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]"
              >
                <span className="col-span-2 sm:col-span-1">
                  <Checkbox
                    label={name}
                    checked={!!open}
                    disabled={!editable}
                    onCheckedChange={(on) =>
                      setHours((h) => ({ ...h, [day]: on ? { from: "08:00", to: "17:00" } : null }))
                    }
                  />
                </span>
                {open ? (
                  <>
                    <span className="flex min-w-0 items-center gap-2">
                      <span aria-hidden="true" className="text-muted text-sm sm:hidden">
                        {t("table.opens")}
                      </span>
                      <Input
                        type="time"
                        className="min-w-0 px-2 sm:px-3"
                        aria-label={t("opens", { day: name })}
                        value={open.from}
                        disabled={!editable}
                        onChange={(event) => setHours((h) => ({ ...h, [day]: { ...open, from: event.target.value } }))}
                      />
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                      <span aria-hidden="true" className="text-muted text-sm sm:hidden">
                        {t("table.closes")}
                      </span>
                      <Input
                        type="time"
                        className="min-w-0 px-2 sm:px-3"
                        aria-label={t("closes", { day: name })}
                        value={open.to}
                        disabled={!editable}
                        onChange={(event) => setHours((h) => ({ ...h, [day]: { ...open, to: event.target.value } }))}
                      />
                    </span>
                  </>
                ) : (
                  <span className="text-muted col-span-2">{t("closed")}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {editable ? (
        // When the new week starts and the one button that saves it, side by side under the timetable.
        <div className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2 sm:max-w-sm">
            <Field label={t("effectiveFrom")} hint={t("effectiveHint")}>
              <Input type="date" value={from} min={bangkokToday(1)} onChange={(event) => setFrom(event.target.value)} />
            </Field>
            <p className="text-muted text-sm text-pretty">{t("effect")}</p>
          </div>
          <div data-fill="row" className="flex shrink-0 flex-col">
            <Button size="lg" iconStart="save" loading={busy} disabled={!valid} onClick={() => void save()}>
              {t("save")}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-muted text-sm">{t("readOnly")}</p>
      )}
    </div>
  );
}
