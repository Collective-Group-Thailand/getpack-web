"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { SETTING_CONFIRMATION_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import { FormDialog, FormError, problemMessage, QueryError, Section, StatusChip, useActor, useCan } from "../console";
import { adminBrowserApis } from "../console/api";

type Setting = Schemas["SettingDto"];
type Value = Setting extends { current: infer C } ? (C extends { value: infer V } ? V : never) : never;
type Scalar = string | number | boolean | null;

/** The settings this page is for, in reading order (D-130…D-136, D-154). */
const KEYS = [
  "loyalty.earn_rate",
  "loyalty.point_value",
  "loyalty.tiers",
  "loyalty.activity_rewards",
  "loyalty.redemption_limits",
  "loyalty.points_expiry",
  "referral.rules",
  "campaigns.budget_alert_pct",
] as const;
type Key = (typeof KEYS)[number];

/** Fields that are words, not amounts: shown, never edited here. */
const FIXED_FIELDS = new Set(["basis", "tier"]);

const isRecord = (value: unknown): value is Record<string, Scalar> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Form text back to the type the value had: the backend validates the shape, the form keeps it. */
function typed(original: Scalar, text: string): Scalar {
  if (typeof original === "number") return Number(text);
  if (typeof original === "boolean") return text === "true";
  return text.trim();
}

/**
 * Loyalty and referral rules (F2 2.7): earn rate, point value, tiers, activity rewards,
 * redemption limits, expiry (D-130…D-135), referral rewards (D-136) and the campaign alert
 * (D-154). They are platform settings: every change is a new effective-dated version (D-063)
 * made by the setting's owner, and the version history lives in Settings.
 */
export function LoyaltySettings() {
  const t = useTranslations("marketing.loyalty");
  const settings = useQuery({
    queryKey: queryKeys.list("admin", "setting", {}),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/settings")).data!,
  });
  if (settings.isError) return <QueryError error={settings.error} onRetry={() => void settings.refetch()} />;
  const byKey = new Map((settings.data ?? []).map((setting) => [setting.key, setting]));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {KEYS.map((key) => {
        const setting = byKey.get(key);
        return setting ? <SettingCard key={key} settingKey={key} setting={setting} /> : null;
      })}
      {settings.data && KEYS.every((key) => !byKey.has(key)) ? <p className="text-muted">{t("none")}</p> : null}
    </div>
  );
}

function SettingCard({ settingKey, setting }: { settingKey: Key; setting: Setting }) {
  const t = useTranslations("marketing.loyalty");
  const tSetting = useTranslations(`marketing.loyalty.settings`);
  const format = useFormat();
  const queryClient = useQueryClient();
  const actor = useActor();
  // settings.change is every owning role's; each may change only the settings it owns (D-063), as
  // the Settings screen and getpack-api's owner check have it.
  const canChange = useCan("settings.change") && actor.roles.includes(setting.ownerRole);
  const [editing, setEditing] = useState(false);
  const value = setting.current?.value ?? null;
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [reason, setReason] = useState("");

  const label = (field: string) => tSetting(`${settingKey.replace(".", "_")}.${field}`);
  const shown = (field: string, raw: Scalar) =>
    raw === null ? "–" : FIXED_FIELDS.has(field) ? tSetting(`values.${String(raw)}`) : String(raw);

  const open = () => {
    if (Array.isArray(value))
      setRows(value.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)]))));
    else if (isRecord(value)) setDraft(Object.fromEntries(Object.entries(value).map(([k, v]) => [k, String(v)])));
    else setDraft({ value: value === null ? "" : String(value) });
    setWhen("now");
    setEffectiveFrom("");
    setReason("");
    setEditing(true);
  };

  const next = (): Value => {
    if (Array.isArray(value))
      return value.map((row, index) =>
        Object.fromEntries(
          Object.entries(row).map(([field, original]) => [
            field,
            FIXED_FIELDS.has(field) ? original : typed(original as Scalar, rows[index]?.[field] ?? ""),
          ]),
        ),
      ) as Value;
    if (isRecord(value))
      return Object.fromEntries(
        Object.entries(value).map(([field, original]) => [
          field,
          FIXED_FIELDS.has(field) ? original : typed(original, draft[field] ?? ""),
        ]),
      ) as Value;
    return typed(value as Scalar, draft.value ?? "") as Value;
  };

  return (
    <Section
      title={
        <>
          {tSetting(`${settingKey.replace(".", "_")}.title`)}
          <StatusChip map={SETTING_CONFIRMATION_STATUS} value={setting.confirmationStatus} />
        </>
      }
      description={
        <>
          {tSetting(`${settingKey.replace(".", "_")}.note`)}{" "}
          <span className="font-mono text-xs">{setting.decisionRefs.join(", ")}</span>
        </>
      }
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" asChild>
            <Link href={`/settings/${setting.id}`}>{t("history")}</Link>
          </Button>
          {canChange ? (
            <Button size="sm" variant="secondary" onClick={open}>
              {t("change")}
            </Button>
          ) : null}
        </div>
      }
    >
      {Array.isArray(value) ? (
        <table className="w-full text-sm">
          <caption className="sr-only">{tSetting(`${settingKey.replace(".", "_")}.title`)}</caption>
          <thead>
            <tr className="text-muted text-left text-xs">
              {Object.keys(value[0] ?? {}).map((field) => (
                <th key={field} scope="col" className="py-1 font-medium">
                  {label(field)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {value.map((row, index) => (
              <tr key={index}>
                {Object.entries(row).map(([field, raw]) => (
                  <td key={field} className="py-1.5 tabular-nums">
                    {shown(field, raw as Scalar)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : isRecord(value) ? (
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          {Object.entries(value).map(([field, raw]) => (
            <div key={field}>
              <dt className="text-muted text-xs">{label(field)}</dt>
              <dd className="tabular-nums">{shown(field, raw)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-2xl font-semibold tabular-nums">{value === null ? t("notSet") : String(value)}</p>
      )}
      <p className="text-muted mt-3 text-xs">
        {setting.current ? (
          <>
            {t("inForce", { no: setting.current.versionNo })} <When at={setting.current.effectiveFrom} absoluteOnly />
          </>
        ) : (
          t("notSet")
        )}
      </p>
      {setting.scheduled.length > 0 ? (
        <p className="mt-1 text-xs">
          <Badge tone="info" size="sm" icon="calendar">
            {t("scheduled", { count: setting.scheduled.length })}
          </Badge>{" "}
          {format.date(setting.scheduled[0]!.effectiveFrom)}
        </p>
      ) : null}
      {setting.pending ? (
        <p className="mt-1 text-xs">
          <Badge tone="warning" size="sm">
            {t("pending")}
          </Badge>
        </p>
      ) : null}

      {editing ? (
        <FormDialog
          title={t("changeTitle", { name: tSetting(`${settingKey.replace(".", "_")}.title`) })}
          description={t("changeBody")}
          submitLabel={t("save")}
          onClose={() => setEditing(false)}
          onSubmit={async () => {
            if (reason.trim().length < 3) throw new FormError(t("needReason"));
            if (when === "later" && !effectiveFrom) throw new FormError(t("needDate"));
            try {
              await adminBrowserApis().contract.POST("/v1/admin/settings/{settingId}/versions", {
                params: { path: { settingId: setting.id } },
                body: {
                  value: next(),
                  effectiveFrom: when === "now" ? new Date().toISOString() : `${effectiveFrom}T00:00:00+07:00`,
                  reason: reason.trim(),
                },
              });
            } catch (error) {
              throw new FormError(problemMessage(error, t("failed")));
            }
            toast.success(t("saved"));
            void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "setting") });
          }}
        >
          {Array.isArray(value) ? (
            <div className="flex flex-col gap-3">
              {value.map((row, index) => (
                <fieldset key={index} className="grid gap-3 sm:grid-cols-3">
                  <legend className="sr-only">{t("row", { no: index + 1 })}</legend>
                  {Object.entries(row).map(([field, raw]) => (
                    <Field key={field} label={`${label(field)} (${index + 1})`}>
                      <Input
                        value={FIXED_FIELDS.has(field) ? shown(field, raw as Scalar) : (rows[index]?.[field] ?? "")}
                        disabled={FIXED_FIELDS.has(field)}
                        inputMode="decimal"
                        onChange={(event) =>
                          setRows(
                            rows.map((other, at) => (at === index ? { ...other, [field]: event.target.value } : other)),
                          )
                        }
                      />
                    </Field>
                  ))}
                </fieldset>
              ))}
            </div>
          ) : isRecord(value) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(value).map(([field, raw]) => (
                <Field key={field} label={label(field)}>
                  <Input
                    value={FIXED_FIELDS.has(field) ? shown(field, raw) : (draft[field] ?? "")}
                    disabled={FIXED_FIELDS.has(field)}
                    inputMode="decimal"
                    onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                  />
                </Field>
              ))}
            </div>
          ) : (
            <Field label={tSetting(`${settingKey.replace(".", "_")}.title`)}>
              <Input
                inputMode="decimal"
                value={draft.value ?? ""}
                onChange={(event) => setDraft({ value: event.target.value })}
              />
            </Field>
          )}
          <SegmentedControl
            label={t("when")}
            value={when}
            onValueChange={(next) => setWhen(next as typeof when)}
            options={[
              { value: "now", label: t("now") },
              { value: "later", label: t("later") },
            ]}
          />
          {when === "later" ? (
            <Field label={t("effectiveFrom")} required>
              <Input type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
            </Field>
          ) : null}
          <Field label={t("reason")} required>
            <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </FormDialog>
      ) : null}
    </Section>
  );
}
