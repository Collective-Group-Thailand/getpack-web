"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { useRefresh } from "@/features/partner/client";
import { uploadPhotos } from "@/features/partner/floor";
import { ConfirmAction, problemMessage } from "@/features/shared/actions";
import { browserRequests } from "@/lib/api/requests/browser";
import { usePushSubscription } from "@/lib/push";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { Button } from "@/ui/components/Button";
import { CameraCapture, type CapturedPhoto } from "@/ui/components/CameraCapture";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Select } from "@/ui/components/Select";
import { Skeleton } from "@/ui/components/Skeleton";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

/* -------------------------------------------------------------------------------- claims */

/**
 * The factory's answer to a claim that names it (D-083): accept it, or dispute it with what
 * happened and its own photos. The claim goes back to Packio's claims desk either way.
 */
export function RespondClaim({ claimId, claimNo }: { claimId: string; claimNo: string }) {
  const t = useTranslations("partnerAccount.claims.respond");
  const tCamera = useTranslations("partnerJobs.camera");
  const tCommon = useTranslations("common");
  const { factoryId, can } = useFactory();
  const [refresh] = useRefresh();
  const [response, setResponse] = useState<"accepted" | "disputed">("accepted");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!can("factory_claims.respond")) return <p className="text-muted">{t("ownerOnly")}</p>;

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
      <Field
        label={t("note")}
        hint={response === "disputed" ? t("disputeHint") : t("acceptHint")}
        required
        requiredLabel={tCommon("state.required")}
        error={error ?? undefined}
      >
        <Textarea rows={4} value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} />
      </Field>
      {response === "disputed" ? (
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
            }}
          />
        </Field>
      ) : null}
      <Button
        size="xl"
        iconStart="send"
        onClick={() => (note.trim().length < 3 ? setError(t("noteRequired")) : (setError(null), setOpen(true)))}
        className="self-start"
      >
        {t("send")}
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        tone={response === "accepted" ? "primary" : "destructive"}
        title={t(response === "accepted" ? "acceptTitle" : "disputeTitle", { no: claimNo })}
        description={t(response === "accepted" ? "acceptBody" : "disputeBody", { no: claimNo })}
        confirmLabel={t("send")}
        onConfirm={async ({ idempotencyKey }) => {
          try {
            const evidenceFileIds = photos.length ? await uploadPhotos(photos, factoryId) : [];
            await browserRequests().call("POST /v1/partner/factories/{factoryId}/claims/{claimId}/actions/respond", {
              path: { factoryId, claimId },
              body: { response, note: note.trim(), ...(evidenceFileIds.length ? { evidenceFileIds } : {}) },
              idempotencyKey,
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

type Scorecard = ResponseOf<Requests, "GET /v1/partner/factories/{factoryId}/scorecards">[number];

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

const ROLES = [
  "factory_owner",
  "factory_planner",
  "factory_operator",
  "factory_qc",
  "factory_shipping",
  "factory_accountant",
] as const;
type Role = (typeof ROLES)[number];
type User = ResponseOf<Requests, "GET /v1/partner/factories/{factoryId}/users">[number];

/** Invite someone to act for the factory, with the roles they need (D-140, Owner only). */
export function InviteUser() {
  const t = useTranslations("partnerAccount.users");
  const tRoles = useTranslations("partner.shell.roles");
  const tCommon = useTranslations("common");
  const { factoryId } = useFactory();
  const [refresh] = useRefresh();
  const [value, setValue] = useState({ email: "", displayName: "" });
  const [roles, setRoles] = useState<Role[]>(["factory_operator"]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) return setError(t("emailInvalid"));
    if (value.displayName.trim().length < 2) return setError(t("nameRequired"));
    if (!roles.length) return setError(t("roleRequired"));
    setBusy(true);
    setError(null);
    try {
      await browserRequests().call("POST /v1/partner/factories/{factoryId}/users", {
        path: { factoryId },
        body: { email: value.email.trim(), displayName: value.displayName.trim(), roles },
      });
      setValue({ email: "", displayName: "" });
      toast.success(t("invited"));
      refresh();
    } catch (failure) {
      setError(problemMessage(failure, t("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void invite(event)} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("name")} required requiredLabel={tCommon("state.required")}>
          <Input
            inputSize="lg"
            autoComplete="off"
            value={value.displayName}
            onChange={(event) => setValue({ ...value, displayName: event.target.value })}
          />
        </Field>
        <Field label={t("email")} required requiredLabel={tCommon("state.required")} error={error ?? undefined}>
          <Input
            inputSize="lg"
            type="email"
            autoComplete="off"
            value={value.email}
            onChange={(event) => setValue({ ...value, email: event.target.value })}
          />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">{t("roles")}</legend>
        {ROLES.map((role) => (
          <Checkbox
            key={role}
            label={tRoles(role)}
            description={t(`roleHints.${role}`)}
            checked={roles.includes(role)}
            onCheckedChange={(checked) => setRoles(checked ? [...roles, role] : roles.filter((item) => item !== role))}
          />
        ))}
      </fieldset>
      <Button type="submit" size="xl" iconStart="user-plus" loading={busy} className="self-start">
        {t("invite")}
      </Button>
    </form>
  );
}

/** One user's roles and whether they may sign in; the owner cannot demote themselves. */
export function EditUser({ user }: { user: User }) {
  const t = useTranslations("partnerAccount.users");
  const tRoles = useTranslations("partner.shell.roles");
  const { factoryId } = useFactory();
  const [refresh] = useRefresh();
  const [role, setRole] = useState<Role>(user.roles[0] ?? "factory_operator");
  const [confirm, setConfirm] = useState<"deactivated" | "active" | null>(null);

  async function patch(body: { roles?: Role[]; status?: "active" | "deactivated" }, done: string) {
    try {
      await browserRequests().call("PATCH /v1/partner/factories/{factoryId}/users/{userId}", {
        path: { factoryId, userId: user.id },
        body,
      });
      toast.success(done);
      refresh();
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
      throw error;
    }
  }

  if (user.isSelf) return <p className="text-muted text-sm">{t("self")}</p>;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label={t("roleFor", { name: user.displayName })} className="min-w-48 flex-1">
        <Select
          value={role}
          onValueChange={(next) => {
            setRole(next);
            void patch({ roles: [next] }, t("rolesSaved", { name: user.displayName })).catch(() => {});
          }}
          options={ROLES.map((key) => ({ value: key, label: tRoles(key) }))}
        />
      </Field>
      <Button
        size="lg"
        variant="secondary"
        onClick={() => setConfirm(user.status === "deactivated" ? "active" : "deactivated")}
      >
        {user.status === "deactivated" ? t("reactivate") : t("deactivate")}
      </Button>
      <ConfirmAction
        open={confirm !== null}
        onOpenChange={(open) => (open ? undefined : setConfirm(null))}
        tone={confirm === "deactivated" ? "destructive" : "primary"}
        title={t(confirm === "deactivated" ? "deactivateTitle" : "reactivateTitle", { name: user.displayName })}
        description={t(confirm === "deactivated" ? "deactivateBody" : "reactivateBody", { name: user.displayName })}
        confirmLabel={confirm === "deactivated" ? t("deactivate") : t("reactivate")}
        onConfirm={() => patch({ status: confirm! }, t("statusSaved", { name: user.displayName }))}
      />
    </div>
  );
}

type Preference = ResponseOf<Requests, "GET /v1/partner/me/notification-preferences">["preferences"][number];
const CATEGORIES = ["jobs", "shipping", "prices", "billing", "claims", "account"] as const;
const CHANNELS = ["web_push", "line", "email"] as const;

/** Which channel each kind of factory notice arrives on (D-143); locked ones always do. */
export function NotificationMatrix({ initial, lineLinked }: { initial: Preference[]; lineLinked: boolean }) {
  const t = useTranslations("partnerAccount.notifications");
  const [rows, setRows] = useState(initial);
  async function toggle(category: Preference["category"], channel: Preference["channel"], enabled: boolean) {
    const next = rows.map((row) => (row.category === category && row.channel === channel ? { ...row, enabled } : row));
    setRows(next);
    try {
      const saved = await browserRequests().call("PUT /v1/partner/me/notification-preferences", {
        body: {
          preferences: next.map(({ category: c, channel: ch, enabled: e }) => ({
            category: c,
            channel: ch,
            enabled: e,
          })),
        },
      });
      setRows(saved.preferences);
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
