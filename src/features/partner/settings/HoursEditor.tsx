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
      {/* A week reads as a timetable: one line a day, open/close side by side (a phone keeps the columns). */}
      <div className="border-border bg-surface overflow-hidden rounded-xl border">
        <table className="w-full border-collapse text-start">
          <thead>
            <tr className="border-border bg-surface-subtle border-b">
              <th scope="col" className="text-muted px-3 py-2.5 text-start text-sm font-medium">
                {t("table.day")}
              </th>
              <th scope="col" className="text-muted px-3 py-2.5 text-start text-sm font-medium">
                {t("table.opens")}
              </th>
              <th scope="col" className="text-muted px-3 py-2.5 text-start text-sm font-medium">
                {t("table.closes")}
              </th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day) => {
              const open = hours[day];
              const name = t(`days.${day}`);
              return (
                <tr key={day} className="border-border border-b last:border-b-0">
                  <th scope="row" className="px-3 py-2 text-start font-normal">
                    <Checkbox
                      label={name}
                      checked={!!open}
                      disabled={!editable}
                      onCheckedChange={(on) =>
                        setHours((h) => ({ ...h, [day]: on ? { from: "08:00", to: "17:00" } : null }))
                      }
                    />
                  </th>
                  {open ? (
                    <>
                      <td className="px-2 py-2 md:px-3">
                        <Input
                          type="time"
                          className="max-w-40"
                          aria-label={t("opens", { day: name })}
                          value={open.from}
                          disabled={!editable}
                          onChange={(event) =>
                            setHours((h) => ({ ...h, [day]: { ...open, from: event.target.value } }))
                          }
                        />
                      </td>
                      <td className="px-2 py-2 md:px-3">
                        <Input
                          type="time"
                          className="max-w-40"
                          aria-label={t("closes", { day: name })}
                          value={open.to}
                          disabled={!editable}
                          onChange={(event) => setHours((h) => ({ ...h, [day]: { ...open, to: event.target.value } }))}
                        />
                      </td>
                    </>
                  ) : (
                    <td colSpan={2} className="text-muted px-3 py-2">
                      {t("closed")}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
