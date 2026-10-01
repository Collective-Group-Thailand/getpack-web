"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

import { linkLine } from "../auth/actions";
import { lineConfigured } from "../auth/providers";

type Preference = Schemas["NotificationPreferenceDto"];
type Channel = "email" | "sms" | "line" | "web_push";
type Category = "transactional" | "marketing";
const CHANNELS: Channel[] = ["email", "sms", "line", "web_push"];
const CATEGORIES: Category[] = ["transactional", "marketing"];
const PROVIDERS: Schemas["IdentityProvider"][] = ["phone_otp", "line", "firebase_google", "firebase_apple"];

/**
 * Which messages arrive where (D-143, D-144): order and payment messages on every channel the
 * customer keeps, marketing only where they choose — and never order e-mail switched off, which
 * the API refuses. Linked sign-in methods sit beside it, because LINE is both.
 */
export function NotificationSettings({
  initial,
  identities,
  lineMarketingConsent,
}: {
  initial: Preference[];
  identities: Schemas["LinkedIdentityDto"][];
  /** PDPA: marketing on a channel also needs that channel's consent (D-144). */
  lineMarketingConsent: boolean;
}) {
  const t = useTranslations("account.notifications");
  const format = useFormat();
  const router = useRouter();
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const resumed = useRef(false);
  const linked = new Set(identities.map((identity) => identity.provider));

  const enabled = (channel: Channel, category: Category) =>
    prefs.find((entry) => entry.channel === channel && entry.category === category)?.enabled ?? false;

  async function set(channel: Channel, category: Category, value: boolean) {
    const next = [
      ...prefs.filter((entry) => !(entry.channel === channel && entry.category === category)),
      { channel, category, enabled: value },
    ];
    setPrefs(next);
    setSaving(true);
    try {
      const { data } = await browserApi().PUT("/v1/store/me/notification-preferences", {
        body: { items: [{ channel, category, enabled: value }] },
      });
      if (data) setPrefs(data);
    } catch (error) {
      setPrefs(prefs);
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setSaving(false);
    }
  }

  async function connectLine() {
    setLinking(true);
    try {
      const { lineIdentity } = await import("../auth/provider-sdks");
      const identity = await lineIdentity(`${window.location.origin}${window.location.pathname}?link=line`);
      if (!identity) return; // navigating to LINE
      const result = await linkLine(identity);
      if (result.ok) {
        toast.success(t("lineLinked"));
        router.refresh();
      } else toast.error(t("lineFailed"));
    } catch {
      toast.error(t("lineFailed"));
    } finally {
      setLinking(false);
    }
  }

  // Back from LINE's login page: finish linking.
  useEffect(() => {
    if (resumed.current || !new URLSearchParams(window.location.search).has("link")) return;
    resumed.current = true;
    void connectLine();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on the way back from LINE
  }, []);

  /** `store.me.unlinkIdentity`: never the account phone or the last method (409, the API's words). */
  async function unlink(provider: Schemas["IdentityProvider"]) {
    try {
      await browserApi().DELETE("/v1/store/me/identities/{provider}", { params: { path: { provider } } });
      toast.success(t("unlinked", { provider: t(`providers.${provider}`) }));
      router.refresh();
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="notify-matrix">
        <h2 id="notify-matrix" className="text-lg font-semibold">
          {t("matrix")}
        </h2>
        <div className="border-border mt-4 overflow-x-auto rounded-xl border" aria-busy={saving || undefined}>
          <table className="w-full text-sm">
            <caption className="sr-only">{t("matrix")}</caption>
            <thead className="bg-bg-subtle text-muted text-xs">
              <tr>
                <th scope="col" className="px-4 py-2 text-start font-medium">
                  {t("category")}
                </th>
                {CHANNELS.map((channel) => (
                  <th key={channel} scope="col" className="px-4 py-2 text-center font-medium">
                    {t(`channels.${channel}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((category) => (
                <tr key={category} className="border-border border-t">
                  <th scope="row" className="px-4 py-3 text-start font-medium">
                    {t(`categories.${category}.label`)}
                    <span className="text-muted block text-xs font-normal">{t(`categories.${category}.hint`)}</span>
                  </th>
                  {CHANNELS.map((channel) => {
                    const locked = category === "transactional" && channel === "email";
                    const needsLine = channel === "line" && !linked.has("line");
                    return (
                      <td key={channel} className="px-4 py-3 text-center">
                        <Switch
                          checked={locked || enabled(channel, category)}
                          disabled={locked || needsLine}
                          onCheckedChange={(value) => void set(channel, category, value)}
                          className="justify-center"
                          label={
                            <span className="sr-only">
                              {t("switchLabel", {
                                category: t(`categories.${category}.label`),
                                channel: t(`channels.${channel}`),
                              })}
                            </span>
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="text-muted mt-3 flex list-disc flex-col gap-1 ps-5 text-xs">
          <li>{t("noteTransactional")}</li>
          <li>{t("noteSms")}</li>
          <li>{t("noteHours")}</li>
          {!lineMarketingConsent ? <li>{t("noteConsent")}</li> : null}
        </ul>
      </section>

      <section aria-labelledby="linked-accounts">
        <h2 id="linked-accounts" className="text-lg font-semibold">
          {t("linked")}
        </h2>
        <ul className="mt-4 flex flex-col gap-2">
          {PROVIDERS.map((provider) => {
            const identity = identities.find((entry) => entry.provider === provider);
            return (
              <li
                key={provider}
                className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{t(`providers.${provider}`)}</p>
                  <p className="text-muted text-xs">
                    {identity ? t("linkedAt", { date: format.date(identity.linkedAt) }) : t("notLinked")}
                  </p>
                </div>
                {identity ? (
                  provider !== "phone_otp" && identities.length > 1 ? (
                    <Button size="sm" variant="ghost" onClick={() => void unlink(provider)}>
                      {t("unlink")}
                      <span className="sr-only"> {t(`providers.${provider}`)}</span>
                    </Button>
                  ) : null
                ) : provider === "line" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={linking}
                    disabled={!lineConfigured()}
                    onClick={() => void connectLine()}
                  >
                    {t("linkLine")}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
        {!lineConfigured() ? (
          <Callout tone="neutral" className="mt-3">
            {t("lineUnavailable")}
          </Callout>
        ) : null}
      </section>
    </div>
  );
}
