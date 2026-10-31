"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { SETTING_CONFIRMATION_STATUS, statusMeta } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { EDGE_BAR, StickySave } from "@/ui/components/FormLayout";
import { Input, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis, FormDialog, FormError, problemMessage, useActor, useCan, useRoleLabel } from "../../console";
import type { Setting, SettingValue } from "../setting-value";
import { SettingField, SettingValueView, useSettingWords } from "./SettingField";
import { plainDescription, sameValue, unitOf, wideValue } from "./shape";

type Draft = { value: SettingValue | null; valid: boolean };

/** Why a setting can't be changed here (or null when it can) — the same rules as its own page. */
export function useLock() {
  const t = useTranslations("platform.settings");
  const actor = useActor();
  const canChange = useCan("settings.change");
  const roleLabel = useRoleLabel();
  return (setting: Setting): string | null => {
    if (setting.masked) return t("change.masked");
    if (setting.pending) return t("change.pendingExists");
    if (!canChange || !actor.roles.includes(setting.ownerRole))
      return t("change.notOwner", { role: roleLabel(setting.ownerRole) });
    return null;
  };
}

/** Scalar leaves that differ between two values, as label paths — what the review lists. */
function changes(a: unknown, b: unknown, path: string[] = []): { path: string[]; from: unknown; to: unknown }[] {
  const scalar = (v: unknown) => v === null || v === undefined || typeof v !== "object" || Array.isArray(v);
  if (scalar(a) || scalar(b)) return sameValue(a, b) ? [] : [{ path, from: a, to: b }];
  const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
  return [...keys].flatMap((key) =>
    changes((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], [...path, key]),
  );
}

/** A value as one line of text — for the review and a read-only row. */
export function useValueText() {
  const t = useTranslations("platform.settings");
  const words = useSettingWords();
  const format = useFormat();
  return (value: unknown, unitName: string | null, setting: Setting): string => {
    if (value === null || value === undefined) return t("notSet");
    if (typeof value === "boolean") return value ? words.on : words.off;
    const unit = words.unit(unitOf(unitName ?? "") ?? (setting.valueType === "percent" ? "pct" : null));
    if (setting.valueType === "money" && typeof value === "string") return format.thb(value);
    if (Array.isArray(value)) return value.map((v) => (unit ? `${v} ${unit}` : String(v))).join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    const text = typeof value === "string" ? words.choice(value) : format.number(value as number);
    return unit ? `${text} ${unit}` : text;
  };
}

/** One setting as a row: what it is (label, one line, the key and its state), then its editor. */
function SettingRow({
  setting,
  draft,
  onDraft,
  scope,
}: {
  setting: Setting;
  draft: Draft | undefined;
  onDraft: (draft: Draft | null) => void;
  scope?: string;
}) {
  const t = useTranslations("platform.settings");
  const tStatus = useTranslations("status");
  const words = useSettingWords();
  const lock = useLock()(setting);
  const confirmation = statusMeta(SETTING_CONFIRMATION_STATUS, setting.confirmationStatus);
  const help = words.help(setting.key) ?? plainDescription(setting.description);
  const current = setting.current?.value ?? null;
  const changed = draft !== undefined;
  // A list of records or a nested structure reads under the label, full width, instead of in the field column.
  const wide = wideValue(current);
  return (
    <li
      id={`setting-${setting.id}`}
      className={cn(
        "grid scroll-mt-24 gap-x-8 gap-y-3 px-4 py-3.5 md:px-5",
        !wide && "md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]",
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-medium text-balance [overflow-wrap:anywhere] break-keep">{words.label(setting.key)}</h3>
          {changed ? (
            <Badge size="sm" tone="info">
              {t("edited")}
            </Badge>
          ) : null}
        </div>
        <p className="text-muted text-sm text-pretty">{help}</p>
        <div className="text-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <code className="bg-surface-subtle rounded-thumb px-1.5 py-0.5 font-mono [overflow-wrap:anywhere]">
            {setting.key}
          </code>
          {scope ? <span>{scope}</span> : null}
          {setting.confirmationStatus !== "confirmed" ? (
            <StatusBadge size="sm" meta={confirmation} label={tStatus(confirmation.labelKey)} />
          ) : null}
          {setting.pending ? (
            <Badge size="sm" tone="warning" icon="hourglass">
              {t("pendingBadge")}
            </Badge>
          ) : null}
          {setting.scheduled.length ? (
            <Badge size="sm" tone="info" icon="calendar">
              {t("scheduledCount", { count: setting.scheduled.length })}
            </Badge>
          ) : null}
          <Link href={`/settings/${setting.id}`} className="text-primary font-medium hover:underline">
            {t("historyLink")}
          </Link>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        {setting.masked ? (
          <p className="text-muted inline-flex items-center gap-1.5 text-sm">
            <Icon name="lock" size={14} aria-hidden />
            {t("masked")}
          </p>
        ) : lock ? (
          <SettingValueView setting={setting} value={current} />
        ) : (
          <SettingField
            setting={setting}
            value={draft ? draft.value : current}
            onChange={(value, valid) => onDraft(valid && sameValue(value, current) ? null : { value, valid })}
          />
        )}
        {lock && !setting.masked ? (
          <p className="text-muted inline-flex items-center gap-1.5 text-xs">
            <Icon name="lock" size={12} aria-hidden />
            {lock}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/** `datetime-local` text for "now", in Bangkok wall-clock time — getpack's only clock. */
const bangkokNowInput = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 16);

/**
 * A section of settings (an area of the business) with its own save: changed rows collect as drafts,
 * a bar at the foot of the section says how many and opens the review — each change is sent as a new
 * dated version with the reason, exactly as a setting's own page sends it; one that needs approval
 * goes to the approver instead of taking effect.
 */
export function SettingsSection({
  id,
  title,
  description,
  settings,
  scopeLabel,
  className,
  card = false,
  active = true,
}: {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  settings: Setting[];
  /** A heading per scope (an issuing entity), when the section holds more than one. */
  scopeLabel?: (setting: Setting) => string | undefined;
  className?: string;
  /** Drawn as one card (title inside) to sit among a page's other cards — the finance tax settings. */
  card?: boolean;
  /** False while the section is kept but not shown (another area is open): its edits wait, its save bar goes. */
  active?: boolean;
}) {
  const t = useTranslations("platform.settings");
  const words = useSettingWords();
  const valueText = useValueText();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [reviewing, setReviewing] = useState(false);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [reason, setReason] = useState("");
  // Bumped on discard so every field drops its typed text.
  const [generation, setGeneration] = useState(0);

  const edited = settings.filter((setting) => drafts[setting.id]);
  const invalid = edited.some((setting) => !drafts[setting.id]!.valid);
  const approvals = edited.filter((setting) => setting.approvalPolicy);

  const discard = () => {
    setDrafts({});
    setGeneration((g) => g + 1);
  };

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        className ?? "flex scroll-mt-20 flex-col gap-3",
        card && "border-border bg-surface rounded-card gap-0 border",
      )}
    >
      <div className={cn("flex flex-col gap-0.5", card && "px-4 pt-5 pb-4 md:px-6 md:pt-6")}>
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          {title}
        </h2>
        {description ? <p className="text-muted text-sm text-pretty">{description}</p> : null}
      </div>
      <ul
        key={generation}
        className={cn(
          "divide-border divide-y",
          card ? "border-border border-t" : "border-border bg-surface rounded-card border",
        )}
      >
        {settings.map((setting, at) => {
          const scope = scopeLabel?.(setting);
          const before = at > 0 ? scopeLabel?.(settings[at - 1]!) : undefined;
          const heading = scope && scope !== before ? scope : null;
          return [
            heading ? (
              <li
                key={`scope-${setting.scopeId}`}
                className="bg-surface-subtle px-4 py-2 text-sm font-semibold md:px-5"
              >
                {heading}
              </li>
            ) : null,
            <SettingRow
              key={setting.id}
              setting={setting}
              draft={drafts[setting.id]}
              onDraft={(draft) =>
                setDrafts((all) => {
                  const next = { ...all };
                  if (draft) next[setting.id] = draft;
                  else delete next[setting.id];
                  return next;
                })
              }
            />,
          ];
        })}
      </ul>
      {active && edited.length ? (
        <StickySave
          barClassName={EDGE_BAR}
          note={invalid ? t("save.invalid") : t("save.note", { count: edited.length })}
        >
          <Button variant="ghost" onClick={discard}>
            {t("save.discard")}
          </Button>
          <Button disabled={invalid} onClick={() => setReviewing(true)}>
            {t("save.review")}
          </Button>
        </StickySave>
      ) : null}

      {reviewing ? (
        <FormDialog
          title={t("save.title", { count: edited.length })}
          submitLabel={when === "now" ? t("change.applyNow") : t("change.schedule")}
          size="lg"
          onClose={() => setReviewing(false)}
          onSubmit={async () => {
            if (reason.trim().length < 3) throw new FormError(t("save.reasonShort"));
            if (when === "later" && !effectiveFrom) throw new FormError(t("save.whenMissing"));
            const at = when === "now" ? new Date().toISOString() : `${effectiveFrom}:00+07:00`;
            const failed: string[] = [];
            let pending = 0;
            for (const setting of edited) {
              try {
                const updated = (
                  await adminBrowserApis().contract.POST("/v1/admin/settings/{settingId}/versions", {
                    params: { path: { settingId: setting.id } },
                    body: { value: drafts[setting.id]!.value, reason: reason.trim(), effectiveFrom: at },
                  })
                ).data!;
                if (updated.pending) pending += 1;
                queryClient.setQueryData(queryKeys.detail("admin", "setting", setting.id), updated);
                setDrafts((all) => {
                  const next = { ...all };
                  delete next[setting.id];
                  return next;
                });
              } catch (failure) {
                failed.push(`${words.label(setting.key)} (${problemMessage(failure, t("change.failed"))})`);
              }
            }
            void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "setting") });
            void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "approval") });
            const saved = edited.length - failed.length;
            if (saved)
              toast.success(pending ? t("save.donePending", { count: pending }) : t("save.done", { count: saved }));
            if (failed.length) throw new FormError(t("save.partial", { names: failed.join(", ") }));
            setReason("");
            setGeneration((g) => g + 1);
          }}
        >
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{t("save.changes")}</p>
            <ul className="border-border divide-border rounded-control divide-y border text-sm">
              {edited.flatMap((setting) =>
                changes(setting.current?.value ?? null, drafts[setting.id]!.value).map((change) => {
                  const name = change.path.at(-1) ?? setting.key;
                  const label = [words.label(setting.key), ...change.path.map((p) => words.field(setting.key, p))].join(
                    " · ",
                  );
                  return (
                    <li key={`${setting.id}-${change.path.join(".")}`} className="flex flex-col gap-0.5 px-3 py-2">
                      <span className="font-medium">{label}</span>
                      <span className="text-muted [overflow-wrap:anywhere] tabular-nums">
                        {t("save.fromTo", {
                          from: valueText(change.from, name, setting),
                          to: valueText(change.to, name, setting),
                        })}
                      </span>
                    </li>
                  );
                }),
              )}
            </ul>
          </div>
          <Field label={t("change.effective")}>
            <SegmentedControl
              label={t("change.effective")}
              value={when}
              onValueChange={setWhen}
              options={[
                { value: "now", label: t("change.now") },
                { value: "later", label: t("change.later") },
              ]}
            />
          </Field>
          {when === "later" ? (
            <Field label={t("change.effectiveFrom")} hint={t("change.effectiveHint")} required>
              <Input
                type="datetime-local"
                min={bangkokNowInput()}
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
              />
            </Field>
          ) : null}
          <Field label={t("change.reason")} hint={t("change.reasonHint")} required>
            <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          {approvals.length ? (
            <Callout
              tone="info"
              title={t("change.needsApproval", {
                policy: [...new Set(approvals.map((s) => s.approvalPolicy!))].join(", "),
              })}
            />
          ) : null}
          <p className="text-muted text-sm">{t("save.lockedNote")}</p>
        </FormDialog>
      ) : null}
    </section>
  );
}
