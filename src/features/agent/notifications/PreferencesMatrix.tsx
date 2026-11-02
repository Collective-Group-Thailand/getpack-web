"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

type Preferences = Schemas["AgentNotificationPreferencesDto"];
type Event = Schemas["AgentNotificationEvent"];
type Channel = Schemas["PartnerNotificationChannel"];

/** The order an agent reads them in: their leads, their money, the paperwork around it. */
export const EVENTS: readonly Event[] = [
  "lead_converted",
  "lead_protection_expiring",
  "commission_earned",
  "statement_ready",
  "payout_paid",
  "payout_profile_needed",
];
export const CHANNELS: readonly Channel[] = ["web_push", "line", "email"];

/** Whether a channel can reach this person at all, from `reachable`. */
export function reachableFor(reachable: Preferences["reachable"], channel: Channel): boolean {
  return channel === "web_push" ? reachable.webPush : channel === "line" ? reachable.line : reachable.email;
}

/**
 * การแจ้งเตือน (D-467): six events × three channels, each an immediate switch (`store.agentNotificationPreferences.set`
 * with just the one that changed). A locked switch — the money e-mails Finance must send (D-144) — is shown on and
 * disabled, with the reason under it. One group per event: on a phone its three switches stack; from a tablet up
 * they sit in a row under the event, the same three columns for every event.
 */
export function PreferencesMatrix({ initial }: { initial: Preferences }) {
  const t = useTranslations("agentZone.notifications");
  const [items, setItems] = useState(initial.items);
  const [saving, setSaving] = useState<string | null>(null);

  const find = (event: Event, channel: Channel) =>
    items.find((item) => item.event === event && item.channel === channel);

  const set = async (event: Event, channel: Channel, enabled: boolean) => {
    const key = `${event}:${channel}`;
    const before = items;
    setItems((current) =>
      current.map((item) => (item.event === event && item.channel === channel ? { ...item, enabled } : item)),
    );
    setSaving(key);
    try {
      const { data } = await browserApi().PUT("/v1/store/agent/notification-preferences", {
        body: { items: [{ event, channel, enabled }] },
      });
      if (data) setItems(data.items);
      toast.success(enabled ? t("savedOn") : t("savedOff"));
    } catch (error) {
      setItems(before);
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setSaving(null);
    }
  };

  return (
    <ul className="border-border bg-surface rounded-card divide-border divide-y border">
      {EVENTS.map((event) => (
        <li key={event} className="px-4 py-4 sm:px-5">
          <fieldset>
            <legend className="font-semibold">{t(`events.${event}.title`)}</legend>
            <p className="text-muted mt-0.5 text-sm">{t(`events.${event}.body`)}</p>
            <div className="mt-3 grid gap-1 sm:grid-cols-3 sm:gap-4">
              {CHANNELS.map((channel) => {
                const item = find(event, channel);
                if (!item) return null;
                const key = `${event}:${channel}`;
                return (
                  <Switch
                    key={channel}
                    id={`pref-${event}-${channel}`}
                    label={t(`channels.${channel}`)}
                    description={item.locked ? t("locked") : undefined}
                    labelPosition="start"
                    checked={item.enabled}
                    disabled={item.locked || saving === key}
                    onCheckedChange={(checked) => void set(event, channel, checked)}
                    className="min-h-11 justify-between rounded-lg sm:justify-start [&>div]:flex-1 sm:[&>div]:flex-none"
                  />
                );
              })}
            </div>
          </fieldset>
        </li>
      ))}
    </ul>
  );
}
