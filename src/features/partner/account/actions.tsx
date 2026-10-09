"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { useRefresh } from "@/features/partner/client";
import { uploadPhotos } from "@/features/partner/floor";
import { ConfirmAction, problemMessage } from "@/features/shared/actions";
import { browserApi } from "@/lib/api/browser";
import { usePushSubscription } from "@/lib/push";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { CameraCapture, type CapturedPhoto } from "@/ui/components/CameraCapture";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Skeleton } from "@/ui/components/Skeleton";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";
import { useViewerLabels } from "@/features/partner/viewer";

/* -------------------------------------------------------------------------------- claims */

/**
 * The factory's answer to a claim that names it (D-083, `partner.claims.respond`): accept it, or
 * dispute it with what happened and its own photos (uploaded first, then named by id). The note is
 * optional to the API; a dispute asks for one, since Packio decides on it. The claim goes back to
 * Packio's claims desk either way.
 */
export function RespondClaim({ claimId, claimNo }: { claimId: string; claimNo: string }) {
  const t = useTranslations("partnerAccount.claims.respond");
  const tCamera = useTranslations("partnerJobs.camera");
  const viewer = useViewerLabels();
  const tCommon = useTranslations("common");
  const { factoryId } = useFactory();
  const [refresh] = useRefresh();
  const [response, setResponse] = useState<Schemas["FactoryClaimResponse"]>("accepted");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disputing = response === "disputed";

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label={t("response")}
        size="xl"
        value={response}
        onValueChange={setResponse}
        options={[
          { value: "accepted", label: t("accept"), icon: "check" },
          { value: "disputed", label: t("dispute"), icon: "flag" },
        ]}
      />
      {/* What the choice leads to, said before the owner picks — not only in the confirm dialog. */}
      <p className="text-muted">{disputing ? t("disputeMeans") : t("acceptMeans")}</p>
      <Field
        label={t("note")}
        hint={disputing ? t("disputeHint") : t("acceptHint")}
        required={disputing}
        requiredLabel={tCommon("state.required")}
        error={error ?? undefined}
      >
        <Textarea
          placeholder={disputing ? t("disputePlaceholder") : t("notePlaceholder")}
          rows={4}
          value={note}
          maxLength={2000}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
      {disputing ? (
        <Field label={t("photos")}>
          <CameraCapture
            photos={photos}
            onChange={setPhotos}
            labels={{
              take: tCamera("take"),
              more: tCamera("more"),
              photo: (n) => tCamera("photo", { n }),
              remove: (n) => tCamera("remove", { n }),
              count: (count) => tCamera("count", { count }),
              processing: tCamera("processing"),
              viewer,
            }}
          />
        </Field>
      ) : null}
      <Button
        size="xl"
        iconStart="send"
        onClick={() =>
          disputing && note.trim().length < 3 ? setError(t("noteRequired")) : (setError(null), setOpen(true))
        }
        className="self-start"
      >
        {t("send")}
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        tone="primary"
        title={t(disputing ? "disputeTitle" : "acceptTitle", { no: claimNo })}
        description={t(disputing ? "disputeBody" : "acceptBody", { no: claimNo })}
        confirmLabel={t("send")}
        onConfirm={async ({ idempotencyKey }) => {
          try {
            const evidenceFileIds = disputing && photos.length ? await uploadPhotos(photos, factoryId) : [];
            await browserApi().POST("/v1/partner/claims/{claimId}/actions/respond", {
              params: { path: { claimId }, header: { "Idempotency-Key": idempotencyKey } },
              body: {
                response,
                ...(note.trim() ? { note: note.trim() } : {}),
                ...(evidenceFileIds.length ? { evidenceFileIds } : {}),
              },
            });
            toast.success(t("done", { no: claimNo }));
            refresh();
          } catch (failure) {
            toast.error(problemMessage(failure, t("failed")));
            throw failure;
          }
        }}
      />
    </div>
  );
}

/* --------------------------------------------------------------------------- performance */

const Chart = dynamic(() => import("@/ui/components/Chart").then((module) => module.Chart), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});

type Scorecard = Schemas["ScorecardDto"];

/** The scorecard's months as a line chart with its data table (D-155), loaded on demand. */
export function ScoreChart({ months, monthLabels }: { months: Scorecard[]; monthLabels: Record<string, string> }) {
  const t = useTranslations("partnerAccount.performance");
  const rows = [...months].reverse().map((month) => ({
    month: month.month,
    acceptance: Number(month.onTimeAcceptancePct ?? 0),
    shipping: Number(month.onTimeShippingPct ?? 0),
    firstPass: Number(month.qcFirstPassPct ?? 0),
    updates: Number(month.onTimeUpdatesPct ?? 0),
  }));
  return (
    <Chart
      kind="line"
      title={t("chartTitle")}
      data={rows}
      index="month"
      indexLabel={t("month")}
      formatIndex={(value) => monthLabels[String(value)] ?? String(value)}
      formatValue={(value) => t("pct", { value: Number(value).toFixed(1) })}
      series={[
        { key: "acceptance", label: t("metrics.acceptance"), tone: "primary" },
        { key: "shipping", label: t("metrics.shipping"), tone: "success" },
        { key: "firstPass", label: t("metrics.firstPass"), tone: "info" },
        { key: "updates", label: t("metrics.updates"), tone: "warning" },
      ]}
      labels={{ showTable: t("showTable"), hideTable: t("hideTable") }}
    />
  );
}

/* ------------------------------------------------------------------------------ settings */

/** The roles an owner may give (`FactoryStaffRole`): never the owner role, which Packio grants (D-171). */
const STAFF_ROLES = [
  "factory_planner",
  "factory_operator",
  "factory_qc",
  "factory_shipping",
  "factory_accountant",
] as const satisfies readonly Schemas["FactoryStaffRole"][];
type StaffRole = (typeof STAFF_ROLES)[number];
type User = Schemas["FactoryUserDto"];

function RolePicker({ roles, onChange }: { roles: StaffRole[]; onChange: (roles: StaffRole[]) => void }) {
  const t = useTranslations("partnerAccount.users");
  const tRoles = useTranslations("partner.shell.roles");
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-medium">{t("roles")}</legend>
      {STAFF_ROLES.map((role) => (
        <Checkbox
          key={role}
          label={tRoles(role)}
          description={t(`roleHints.${role}`)}
          checked={roles.includes(role)}
          onCheckedChange={(checked) => onChange(checked ? [...roles, role] : roles.filter((item) => item !== role))}
        />
      ))}
    </fieldset>
  );
}

/**
 * Add someone who acts for the factory (D-140, Owner only, `partner.factoryUsers.create`). There is
 * no invitation e-mail: the owner sets a first password and hands it over in person or by phone, and
 * the person changes it at first sign-in. The password is never shown back, kept or logged.
 */
export function CreateUser() {
  const t = useTranslations("partnerAccount.users");
  const tCommon = useTranslations("common");
  const { factoryId } = useFactory();
  const [refresh] = useRefresh();
  const [value, setValue] = useState({ email: "", displayName: "", initialPassword: "" });
  const [roles, setRoles] = useState<StaffRole[]>(["factory_operator"]);
  const [errors, setErrors] = useState<{
    email?: string;
    displayName?: string;
    initialPassword?: string;
    form?: string;
  }>({});
  const [busy, setBusy] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())) next.email = t("emailInvalid");
    if (!value.displayName.trim()) next.displayName = t("nameRequired");
    if (value.initialPassword.length < 12) next.initialPassword = t("passwordTooShort");
    if (!roles.length) next.form = t("roleRequired");
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await browserApi().POST("/v1/partner/factories/{factoryId}/users", {
        params: { path: { factoryId } },
        body: {
          email: value.email.trim(),
          displayName: value.displayName.trim(),
          initialPassword: value.initialPassword,
          roles,
        },
      });
      setValue({ email: "", displayName: "", initialPassword: "" });
      toast.success(t("created"));
      refresh();
    } catch (failure) {
      setErrors({ form: problemMessage(failure, t("failed")) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void create(event)} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("name")} required requiredLabel={tCommon("state.required")} error={errors.displayName}>
          <Input
            placeholder={t("namePlaceholder")}
            inputSize="lg"
            autoComplete="off"
            maxLength={120}
            value={value.displayName}
            onChange={(event) => setValue({ ...value, displayName: event.target.value })}
          />
        </Field>
        <Field label={t("email")} required requiredLabel={tCommon("state.required")} error={errors.email}>
          <Input
            placeholder={t("emailPlaceholder")}
            inputSize="lg"
            type="email"
            autoComplete="off"
            maxLength={254}
            value={value.email}
            onChange={(event) => setValue({ ...value, email: event.target.value })}
          />
        </Field>
        <Field
          label={t("password")}
          hint={t("passwordHint")}
          required
          requiredLabel={tCommon("state.required")}
          error={errors.initialPassword}
          className="md:col-span-2"
        >
          <Input
            inputSize="lg"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={200}
            value={value.initialPassword}
            onChange={(event) => setValue({ ...value, initialPassword: event.target.value })}
          />
        </Field>
      </div>
      <RolePicker roles={roles} onChange={setRoles} />
      {errors.form ? (
        <p role="alert" className="text-danger text-sm">
          {errors.form}
        </p>
      ) : null}
      <Button type="submit" size="xl" iconStart="user-plus" loading={busy} className="self-start">
        {t("create")}
      </Button>
    </form>
  );
}

/**
 * One user's roles and whether they may sign in (`partner.factoryUsers.setRoles` / `deactivate`).
 * Setting roles on a deactivated user reactivates them. The owner cannot change themselves, and
 * owners are Packio's to manage (D-171).
 */
export function EditUser({ user }: { user: User }) {
  const t = useTranslations("partnerAccount.users");
  const { factoryId } = useFactory();
  const [refresh] = useRefresh();
  const held = user.roles.filter((role): role is StaffRole => (STAFF_ROLES as readonly string[]).includes(role));
  const [roles, setRoles] = useState<StaffRole[]>(held.length ? held : ["factory_operator"]);
  const [confirm, setConfirm] = useState<"deactivate" | "reactivate" | null>(null);
  const [busy, setBusy] = useState(false);
  // The role picker opens on demand: a list of six users stays a list, not six forms.
  const [editing, setEditing] = useState(false);

  if (user.isSelf) return <p className="text-muted text-sm">{t("self")}</p>;
  if (user.roles.includes("factory_owner")) return <p className="text-muted text-sm">{t("ownerManaged")}</p>;

  const setUserRoles = async (next: StaffRole[], done: string) => {
    await browserApi().PUT("/v1/partner/factories/{factoryId}/users/{userId}/roles", {
      params: { path: { factoryId, userId: user.id } },
      body: { roles: next },
    });
    toast.success(done);
    refresh();
  };
  const active = user.status === "active";

  return (
    <div className="flex flex-col gap-3">
      {active && !editing ? (
        <div className="flex flex-wrap gap-2">
          <Button size="md" variant="secondary" iconStart="edit" onClick={() => setEditing(true)}>
            {t("editRoles")}
          </Button>
          <Button size="md" variant="ghost" onClick={() => setConfirm("deactivate")}>
            {t("deactivate")}
          </Button>
        </div>
      ) : active ? (
        <>
          <RolePicker roles={roles} onChange={setRoles} />
          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              loading={busy}
              disabled={!roles.length}
              onClick={async () => {
                setBusy(true);
                try {
                  await setUserRoles(roles, t("rolesSaved", { name: user.displayName }));
                  setEditing(false);
                } catch (error) {
                  toast.error(problemMessage(error, t("failed")));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("saveRoles")}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setRoles(held.length ? held : ["factory_operator"]);
                setEditing(false);
              }}
            >
              {t("cancelEdit")}
            </Button>
          </div>
        </>
      ) : (
        <Button size="lg" variant="secondary" className="self-start" onClick={() => setConfirm("reactivate")}>
          {t("reactivate")}
        </Button>
      )}
      <ConfirmAction
        open={confirm !== null}
        onOpenChange={(open) => (open ? undefined : setConfirm(null))}
        tone={confirm === "deactivate" ? "destructive" : "primary"}
        title={t(confirm === "deactivate" ? "deactivateTitle" : "reactivateTitle", { name: user.displayName })}
        description={t(confirm === "deactivate" ? "deactivateBody" : "reactivateBody", { name: user.displayName })}
        confirmLabel={confirm === "deactivate" ? t("deactivate") : t("reactivate")}
        onConfirm={async () => {
          try {
            if (confirm === "deactivate") {
              await browserApi().POST("/v1/partner/factories/{factoryId}/users/{userId}/actions/deactivate", {
                params: { path: { factoryId, userId: user.id } },
              });
              toast.success(t("statusSaved", { name: user.displayName }));
              refresh();
            } else {
              // Reactivation is setting the roles the user held when deactivated (U-B0.3).
              await setUserRoles(roles, t("statusSaved", { name: user.displayName }));
            }
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
    </div>
  );
}

type Preference = Schemas["PartnerNotificationPreferenceDto"];
const CATEGORIES = ["transactional", "security"] as const satisfies readonly Schemas["PartnerNotificationCategory"][];
const CHANNELS = ["web_push", "line", "email"] as const satisfies readonly Schemas["PartnerNotificationChannel"][];

/**
 * Which channel each kind of factory notice arrives on (D-143, D-231): jobs, shipments, billing and
 * claims (transactional), and security. E-mail of transactional notices and every security notice
 * are locked on — read-only here, and refused by the API.
 */
export function NotificationMatrix({ initial, lineLinked }: { initial: Preference[]; lineLinked: boolean }) {
  const t = useTranslations("partnerAccount.notifications");
  const [rows, setRows] = useState(initial);
  async function toggle(category: Preference["category"], channel: Preference["channel"], enabled: boolean) {
    const next = rows.map((row) => (row.category === category && row.channel === channel ? { ...row, enabled } : row));
    setRows(next);
    try {
      const { data } = await browserApi().PUT("/v1/partner/me/notification-preferences", {
        body: {
          preferences: next
            .filter((row) => !row.locked)
            .map(({ category: c, channel: ch, enabled: e }) => ({ category: c, channel: ch, enabled: e })),
        },
      });
      setRows(data!.preferences);
      toast.success(t("saved"));
    } catch (error) {
      setRows(rows);
      toast.error(problemMessage(error, t("failed")));
    }
  }
  return (
    <div className="flex flex-col gap-4">
      {!lineLinked ? <p className="text-muted text-sm">{t("lineNotLinked")}</p> : null}
      {CATEGORIES.map((category) => (
        <fieldset key={category} className="border-border flex flex-col gap-2 rounded-lg border p-3">
          <legend className="px-1 font-medium">{t(`categories.${category}`)}</legend>
          <p className="text-muted text-sm">{t(`categoryHints.${category}`)}</p>
          {CHANNELS.map((channel) => {
            const row = rows.find((item) => item.category === category && item.channel === channel);
            if (!row) return null;
            return (
              <Switch
                key={channel}
                label={t(`channels.${channel}`)}
                description={row.locked ? t("locked") : undefined}
                checked={row.enabled}
                disabled={row.locked || (channel === "line" && !lineLinked)}
                onCheckedChange={(checked) => void toggle(category, channel, checked)}
              />
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}

const LABEL_COOKIE = "pk_label";

/**
 * The label printer this device prints to (a per-device choice, kept in a cookie — nothing the
 * API needs to know): 100 × 150 mm, the thermal-printer standard, or 4 × 6 inches.
 */
export function LabelSize({ initial }: { initial: "100x150" | "4x6" }) {
  const t = useTranslations("partnerAccount.device");
  const [size, setSize] = useState(initial);
  return (
    <SegmentedControl
      label={t("labelSize")}
      size="xl"
      value={size}
      onValueChange={(next) => {
        setSize(next);
        document.cookie = `${LABEL_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        toast.success(t("labelSaved"));
      }}
      options={[
        { value: "100x150", label: t("sizes.100x150") },
        { value: "4x6", label: t("sizes.4x6") },
      ]}
    />
  );
}

/**
 * Partner-zone push on this device (D-143). Asked for only on this deliberate click — the hook
 * refuses any other way (`usePushSubscription`); the state says when asking is not possible.
 */
export function PushOnThisDevice() {
  const t = useTranslations("partnerAccount.notifications.push");
  const { state, busy, enable } = usePushSubscription("partner");
  if (state === "granted") return <p className="text-success-subtle-fg">{t("on")}</p>;
  if (state !== "askable") return <p className="text-muted text-sm">{t(state)}</p>;
  return (
    <Button
      size="xl"
      variant="secondary"
      iconStart="bell"
      loading={busy}
      onClick={async () => {
        const ok = await enable(true);
        toast[ok ? "success" : "error"](ok ? t("enabled") : t("failed"));
      }}
    >
      {t("enable")}
    </Button>
  );
}
