"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { statusMeta, USER_STATUS } from "@/domain/status";
import { When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { STALE_TIME } from "@/lib/query/defaults";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { Combobox, type ComboboxOption } from "@/ui/components/Combobox";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { Select } from "@/ui/components/Select";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, ConfirmAction, problemMessage, QueryError, useActor, useCan, useRoleLabel } from "../console";
import { grantableRoles, missingPermissions, sodConflicts, type Role, type User } from "./grants";

type Grant = User["roles"][number];
type AccountAction = "deactivate" | "reactivate" | "revoke_sessions";

/** `ReasonDto.reason` minLength in the contract. */
const REASON_MIN = 3;

export function UserDetail({ userId, initial }: { userId: string; initial: User | null }) {
  const t = useTranslations("iam.user");
  const tStatus = useTranslations("status");
  const roleLabel = useRoleLabel();
  const actor = useActor();
  const canManage = useCan("users.manage");
  const canAssign = useCan("roles.assign");
  const queryClient = useQueryClient();
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState<Grant | null>(null);
  const [action, setAction] = useState<AccountAction | null>(null);
  const key = queryKeys.detail("admin", "user", userId);

  const query = useQuery({
    queryKey: key,
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/users/{userId}", { params: { path: { userId } } })).data!,
    initialData: initial ?? undefined,
  });

  const refresh = (user?: User | null) => {
    if (user) queryClient.setQueryData(key, user);
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "user") });
  };

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const user = query.data;
  if (!user) return null;

  const self = user.id === actor.id;
  const meta = statusMeta(USER_STATUS, user.status);

  const grantColumns: DataTableColumn<Grant>[] = [
    { id: "role", header: t("grants.role"), cell: (grant) => <span className="font-medium">{roleLabel(grant.role)}</span> },
    { id: "scope", header: t("grants.scope"), cell: (grant) => (grant.scopeId ? `${t(`scopes.${grant.scopeType}`)} · ${grant.scopeId.slice(0, 8)}` : t("scopes.platform")) },
    { id: "validFrom", header: t("grants.validFrom"), cell: (grant) => <When at={grant.validFrom} absoluteOnly /> },
    { id: "validTo", header: t("grants.validTo"), cell: (grant) => (grant.validTo ? <When at={grant.validTo} absoluteOnly /> : t("grants.noEnd")) },
    { id: "reason", header: t("grants.reason"), cell: (grant) => grant.reason },
    ...(canAssign && !self
      ? [
          {
            id: "revoke",
            header: <span className="sr-only">{t("grants.actions")}</span>,
            className: "text-end",
            cell: (grant: Grant) => (
              <Button size="sm" variant="ghost" onClick={() => setRevoking(grant)}>
                {t("grants.revoke")}
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={<Breadcrumbs label={t("breadcrumb")} items={[{ label: t("users"), href: "/users" }, { label: user.displayName }]} />}
        title={user.displayName}
        meta={
          <>
            <StatusBadge meta={meta} label={tStatus(meta.labelKey)} />
            <Badge>{t(`kinds.${user.kind}`)}</Badge>
          </>
        }
        description={user.email ?? undefined}
        actions={
          canManage && !self ? (
            <>
              <Button variant="secondary" size="sm" iconStart="log-out" onClick={() => setAction("revoke_sessions")}>
                {t("actions.revokeSessions")}
              </Button>
              {user.status === "active" ? (
                <Button variant="destructive" size="sm" iconStart="user-x" onClick={() => setAction("deactivate")}>
                  {t("actions.deactivate")}
                </Button>
              ) : (
                <Button size="sm" iconStart="check" onClick={() => setAction("reactivate")}>
                  {t("actions.reactivate")}
                </Button>
              )}
            </>
          ) : undefined
        }
      />
      {self ? <Callout tone="info" title={t("selfHint")} /> : null}

      <Card padding="lg">
        <CardHeader>
          <CardTitle>{t("profile")}</CardTitle>
        </CardHeader>
        <DescriptionList
          columns={3}
          items={[
            { term: t("email"), description: user.email ?? "—" },
            { term: t("phone"), description: user.phone ?? "—" },
            { term: t("createdAt"), description: <When at={user.createdAt} /> },
            { term: t("lastLogin"), description: <When at={user.lastLoginAt} /> },
          ]}
        />
      </Card>

      <Card padding="lg">
        <CardHeader className="flex items-center justify-between gap-2">
          <CardTitle>{t("grants.title")}</CardTitle>
          {canAssign && !self ? (
            <Button size="sm" iconStart="plus" onClick={() => setGranting(true)}>
              {t("grants.add")}
            </Button>
          ) : null}
        </CardHeader>
        <DataTable caption={t("grants.title")} columns={grantColumns} rows={user.roles} getRowId={(grant) => grant.id} empty={t("grants.empty")} />
      </Card>

      {granting ? <GrantRole user={user} onClose={() => setGranting(false)} onGranted={refresh} /> : null}

      <ConfirmAction
        open={revoking !== null}
        onOpenChange={(open) => (open ? undefined : setRevoking(null))}
        title={t("grants.revokeTitle", { role: revoking ? roleLabel(revoking.role) : "" })}
        description={t("grants.revokeDescription", { name: user.displayName })}
        confirmLabel={t("grants.revoke")}
        tone="destructive"
        reason={{ label: t("reason"), required: true, minLength: REASON_MIN, hint: t("reasonHint") }}
        onConfirm={async ({ reason }) => {
          try {
            const { data } = await adminBrowserApis().contract.POST("/v1/admin/users/{userId}/roles/{grantId}/actions/revoke", {
              params: { path: { userId, grantId: revoking!.id } },
              body: { reason },
            });
            toast.success(t("grants.revoked"));
            refresh(data);
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />

      <ConfirmAction
        open={action !== null}
        onOpenChange={(open) => (open ? undefined : setAction(null))}
        title={action ? t(`actions.${action}Title`) : ""}
        description={action ? t(`actions.${action}Description`, { name: user.displayName }) : ""}
        confirmLabel={action ? t(`actions.${action}Confirm`) : ""}
        tone={action === "reactivate" ? "primary" : "destructive"}
        confirmationPhrase={action === "deactivate" ? (user.email ?? undefined) : undefined}
        reason={action === "revoke_sessions" ? undefined : { label: t("reason"), required: true, minLength: REASON_MIN, hint: t("reasonHint") }}
        onConfirm={async ({ reason }) => {
          const api = adminBrowserApis().contract;
          const path = { params: { path: { userId } } };
          try {
            if (action === "revoke_sessions") await api.POST("/v1/admin/users/{userId}/actions/revoke-sessions", path);
            else if (action === "deactivate") refresh((await api.POST("/v1/admin/users/{userId}/actions/deactivate", { ...path, body: { reason } })).data);
            else refresh((await api.POST("/v1/admin/users/{userId}/actions/reactivate", { ...path, body: { reason } })).data);
            toast.success(t(`actions.${action}Done`));
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
    </div>
  );
}

function GrantRole({ user, onClose, onGranted }: { user: User; onClose: () => void; onGranted: (user: User | null | undefined) => void }) {
  const t = useTranslations("iam.user.grant");
  const tCommon = useTranslations("common");
  const roleLabel = useRoleLabel();
  const actor = useActor();
  const [roleKey, setRoleKey] = useState<string>("");
  const [scope, setScope] = useState<ComboboxOption | null>(null);
  const [scopeQuery, setScopeQuery] = useState("");
  const [validTo, setValidTo] = useState("");
  const [reason, setReason] = useState("");

  const roles = useQuery({
    queryKey: queryKeys.list("admin", "role"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/roles")).data!,
    staleTime: STALE_TIME.stable,
  });
  const rules = useQuery({
    queryKey: queryKeys.list("admin", "sod_rule"),
    queryFn: () => browserRequests().call("GET /v1/admin/sod-rules"),
    staleTime: STALE_TIME.stable,
  });

  const options = grantableRoles(roles.data ?? [], user);
  const role: Role | undefined = options.find((candidate) => candidate.key === roleKey);
  const conflicts = role ? sodConflicts(rules.data?.data ?? [], user, role.key) : [];
  const missing = role ? missingPermissions(role, actor.permissions) : [];
  const scoped = role && role.scopeType !== "platform";

  const scopes = useQuery({
    queryKey: queryKeys.list("admin", "search", { q: scopeQuery, type: role?.scopeType }),
    queryFn: () => browserRequests().call("GET /v1/admin/search", { query: { q: scopeQuery, limit: 10 } }),
    enabled: Boolean(scoped) && scopeQuery.trim().length >= 2,
  });

  const grant = useMutation({
    mutationFn: async () =>
      (await adminBrowserApis().contract.POST("/v1/admin/users/{userId}/roles", {
        params: { path: { userId: user.id } },
        body: {
          role: roleKey,
          reason: reason.trim(),
          ...(scoped && scope ? { scope: { id: scope.value, type: role!.scopeType as "factory" | "company" } } : {}),
          ...(validTo ? { validTo: `${validTo}:00+07:00` } : {}),
        },
      })).data,
    onSuccess: (updated) => {
      toast.success(t("granted"));
      onGranted(updated);
      onClose();
    },
  });

  const blocked = conflicts.some((rule) => rule.enforcement === "block") || missing.length > 0;
  const ready = role && reason.trim().length >= REASON_MIN && (!scoped || scope) && !blocked;

  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t("title", { name: user.displayName })}
      closeLabel={tCommon("actions.close")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tCommon("actions.cancel")}
          </Button>
          <Button onClick={() => grant.mutate()} loading={grant.isPending} disabled={!ready}>
            {t("submit")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {grant.error ? <Callout tone="danger" title={problemMessage(grant.error, t("failed"))} /> : null}
        <Field label={t("role")} required requiredLabel={tCommon("state.required")}>
          <Select
            value={roleKey || undefined}
            onValueChange={(value) => {
              setRoleKey(value);
              setScope(null);
            }}
            placeholder={t("chooseRole")}
            options={options.map((candidate) => ({ value: candidate.key, label: roleLabel(candidate.key) }))}
          />
        </Field>
        {conflicts.map((rule) => (
          <Callout key={rule.id} tone="danger" title={t("sodTitle")}>
            {t("sodBody", { description: rule.description })}
          </Callout>
        ))}
        {missing.length > 0 ? (
          <Callout tone="warning" title={t("escalationTitle")}>
            {t("escalationBody", { permissions: missing.join(", ") })}
          </Callout>
        ) : null}
        {scoped ? (
          <Field label={t(`scope.${role!.scopeType}`)} required requiredLabel={tCommon("state.required")}>
            <Combobox
              value={scope}
              onValueChange={setScope}
              query={scopeQuery}
              onQueryChange={setScopeQuery}
              loading={scopes.isFetching}
              options={(scopes.data?.data ?? [])
                .filter((hit) => hit.type === role!.scopeType)
                .map((hit) => ({ value: hit.id, label: hit.title, description: hit.code }))}
              placeholder={t("scopePlaceholder")}
              labels={{ loading: tCommon("state.loading"), empty: t("noScope"), clear: t("clearScope") }}
            />
          </Field>
        ) : null}
        <Field label={t("validTo")} hint={t("validToHint")}>
          <Input type="datetime-local" value={validTo} onChange={(event) => setValidTo(event.target.value)} />
        </Field>
        <Field label={t("reason")} required requiredLabel={tCommon("state.required")} hint={t("reasonHint")}>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} />
        </Field>
      </div>
    </Dialog>
  );
}
