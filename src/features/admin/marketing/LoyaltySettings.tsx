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
import { DateField } from "@/ui/components/DateField";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import { FormDialog, FormError, problemMessage, QueryError, Section, StatusChip, useActor, useCan } from "../console";
import { adminBrowserApis } from "../console/api";
import { SurfaceSwitches } from "./SurfaceSwitches";

type Setting = Schemas["SettingDto"];
type Value = Setting extends { current: infer C } ? (C extends { value: infer V } ? V : never) : never;
type Scalar = string | number | boolean | null;

/** The settings this page is for, in reading order (D-130…D-136, D-154, D-490…D-493, D-497…D-502). */
const KEYS = [
  "loyalty.earn_rate",
  "loyalty.point_value",
  "loyalty.tiers",
  "loyalty.activity_rewards",
  "loyalty.redemption_limits",
  "loyalty.points_expiry",
  // Loyalty P2 (D-490…D-493). Lifecycle bonuses and analytics windows stay in Settings, where the version history is.
  "loyalty.data_refresh",
  "loyalty.reorder_reminder",
  "surveys.rules",
  "referral.rules",
  "campaigns.budget_alert_pct",
  // Loyalty P3 (D-497…D-502): the reward catalogue's rules, tier perks, the order multipliers with the anniversary,
  // early pay and campaign keys, free rush, capacity deals and the credit-limit tier uplift. Nested values are edited
  // leaf by leaf: the shape (which tiers, how many quarterly coupons) stays as it is.
  "loyalty.rewards",
  "loyalty.tier_perks",
  "loyalty.order_multipliers",
  "promotions.free_rush",
  "promotions.capacity_deal",
  "b2b.credit_tier_uplift",
  // Loyalty P4 (D-506, D-507, D-510): the co-funding rules (Finance, pending CPA), and the programme budget and the
  // rollout read-only here — each is changed on its own screen, through its approval.
  "promotions.cofunding",
  "loyalty.programme_budget",
  "loyalty.rollout",
] as const;
type Key = (typeof KEYS)[number];

/** Settings changed on their own screen (and approval), shown here read-only with a link (P4-PLAN §2). */
const OWN_SCREEN: Partial<Record<Key, string>> = {
  "loyalty.programme_budget": "/marketing/loyalty/budget",
  "loyalty.rollout": "/marketing/loyalty/rollout",
};

/** Fields that are words, not amounts: shown, never edited here. */
const FIXED_FIELDS = new Set(["basis", "tier", "spendBasis", "best"]);

const isRecord = (value: unknown): value is Record<string, Scalar> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isScalar = (value: unknown): value is Scalar => value === null || typeof value !== "object";

/**
 * A record setting as its leaves, by path (`factors.gold`, `platinum.quarterly.0.qty`); a flat record's paths are its
 * field names. Arrays keep their length: entries are edited, never added or removed here.
 */
function leavesOf(value: unknown, prefix = ""): [string, Scalar][] {
  if (isScalar(value)) return [[prefix, value]];
  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((entry, index) => [String(index), entry])
    : Object.entries(value as Record<string, unknown>);
  return entries.flatMap(([key, entry]) => leavesOf(entry, prefix ? `${prefix}.${key}` : key));
}

/** The value with each leaf replaced from the form (typed as it was), the shape unchanged. */
function rebuilt(value: unknown, draft: Record<string, string>, prefix = ""): unknown {
  if (isScalar(value)) {
    const field = prefix.split(".").pop() ?? prefix;
    return FIXED_FIELDS.has(field) ? value : typed(value, draft[prefix] ?? "");
  }
  if (Array.isArray(value))
    return value.map((entry, index) => rebuilt(entry, draft, prefix ? `${prefix}.${index}` : String(index)));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      rebuilt(entry, draft, prefix ? `${prefix}.${key}` : key),
    ]),
  );
}

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

  const surfaces = byKey.get("loyalty.surfaces");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Loyalty P4 (D-509): the eight surface switches lead the page — they are what changes most often. */}
      {surfaces ? (
        <div className="lg:col-span-2">
          <SurfaceSwitches setting={surfaces} />
        </div>
      ) : null}
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
  const tFilters = useTranslations("console.filters");
  const format = useFormat();
  const queryClient = useQueryClient();
  const actor = useActor();
  // settings.change is every owning role's; each may change only the settings it owns (D-063), as
  // the Settings screen and getpack-api's owner check have it.
  const ownScreen = OWN_SCREEN[settingKey];
  const mayChange = useCan("settings.change");
  const canChange = !ownScreen && mayChange && actor.roles.includes(setting.ownerRole);
  const [editing, setEditing] = useState(false);
  const value = setting.current?.value ?? null;
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [reason, setReason] = useState("");

  const scope = settingKey.replace(".", "_");
  // A leaf's label: each named segment in words, an array entry as its number ("แพลทินัม · คูปองรายไตรมาส 1 · จำนวน").
  const label = (path: string) =>
    path
      .split(".")
      .map((segment) =>
        /^\d+$/.test(segment)
          ? String(Number(segment) + 1)
          : tSetting.has(`${scope}.${segment}`)
            ? tSetting(`${scope}.${segment}`)
            : segment,
      )
      .join(" · ");
  const shown = (path: string, raw: Scalar) => {
    const field = path.split(".").pop() ?? path;
    if (raw === null) return "–";
    if (typeof raw === "boolean") return tSetting(`values.${String(raw)}`);
    return FIXED_FIELDS.has(field) ? tSetting(`values.${String(raw)}`) : String(raw);
  };

  const open = () => {
    if (Array.isArray(value))
      setRows(value.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)]))));
    else if (isRecord(value)) setDraft(Object.fromEntries(leavesOf(value).map(([path, v]) => [path, String(v)])));
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
    if (isRecord(value)) return rebuilt(value, draft) as Value;
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
          <span className="text-xs tabular-nums">{setting.decisionRefs.join(", ")}</span>
        </>
      }
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" asChild>
            <Link href={`/settings/${setting.id}`}>{t("history")}</Link>
          </Button>
          {ownScreen ? (
            <Button size="sm" variant="secondary" asChild>
              <Link href={ownScreen}>{t("changeThere")}</Link>
            </Button>
          ) : canChange ? (
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
          {leavesOf(value).map(([path, raw]) => (
            <div key={path}>
              <dt className="text-muted text-xs">{label(path)}</dt>
              <dd className="tabular-nums">{shown(path, raw)}</dd>
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
              {leavesOf(value).map(([path, raw]) => {
                const fixed = FIXED_FIELDS.has(path.split(".").pop() ?? path);
                return typeof raw === "boolean" ? (
                  <SegmentedControl
                    key={path}
                    label={label(path)}
                    size="sm"
                    value={draft[path] ?? String(raw)}
                    onValueChange={(next) => setDraft({ ...draft, [path]: next })}
                    options={[
                      { value: "true", label: tSetting("values.true") },
                      { value: "false", label: tSetting("values.false") },
                    ]}
                  />
                ) : (
                  <Field key={path} label={label(path)}>
                    <Input
                      value={fixed ? shown(path, raw) : (draft[path] ?? "")}
                      disabled={fixed}
                      inputMode={typeof raw === "string" && !/^[\d.]+$/.test(raw) ? "text" : "decimal"}
                      onChange={(event) => setDraft({ ...draft, [path]: event.target.value })}
                    />
                  </Field>
                );
              })}
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
              <DateField
                value={effectiveFrom}
                display={effectiveFrom ? format.date(effectiveFrom) : tFilters("pickDate")}
                onChange={(event) => setEffectiveFrom(event.target.value)}
              />
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
