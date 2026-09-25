"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Skeleton } from "@/ui/components/Skeleton";
import { Icon } from "@/ui/icons";

import { adminBrowserApis, QueryError, useRoleLabel } from "../console";
import { SENSITIVE_PERMISSIONS, type Role } from "./grants";

type Audience = Role["audience"];

/**
 * Every D-140 role and what it may do, as the API's catalogue says (`GET /v1/admin/roles`, the
 * same source `docs/rbac.md` is generated from). Read-only: roles and grants are edited by
 * superadmins through the approvals of B1.3, not here.
 *
 * A real table with row and column headers, so a screen reader announces "Finance, audit_logs.read,
 * granted" — and a granted cell is a word and an icon, never only a dot.
 */
export function RolesMatrix({ initial }: { initial: Role[] | null }) {
  const t = useTranslations("iam.roles");
  const roleLabel = useRoleLabel();
  const [audience, setAudience] = useState<Audience>("staff");

  const roles = useQuery({
    queryKey: queryKeys.list("admin", "role"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/roles")).data!,
    initialData: initial ?? undefined,
    staleTime: STALE_TIME.stable,
  });

  if (roles.isError) return <QueryError error={roles.error} onRetry={() => void roles.refetch()} />;
  if (!roles.data) return <Skeleton className="h-96" />;

  const columns = roles.data.filter((role) => role.audience === audience);
  const permissions = [...new Set(columns.flatMap((role) => role.permissions))].sort();

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label={t("audience")}
        value={audience}
        onValueChange={setAudience}
        options={(["staff", "partner", "customer"] as const).map((value) => ({
          value,
          label: t(`audiences.${value}`),
        }))}
      />
      <p className="text-muted flex items-center gap-2 text-sm">
        <Icon name="shield-alert" size={16} className="text-warning" />
        {t("sensitiveLegend")}
      </p>
      <div className="border-border overflow-auto rounded-lg border">
        <table className="text-sm">
          <caption className="sr-only">{t("caption", { audience: t(`audiences.${audience}`) })}</caption>
          <thead className="bg-surface-subtle sticky top-0">
            <tr>
              <th scope="col" className="text-muted px-3 py-2 text-start text-xs font-medium">
                {t("permission")}
              </th>
              {columns.map((role) => (
                <th
                  key={role.key}
                  scope="col"
                  className="text-muted px-2 py-2 text-center text-xs font-medium whitespace-nowrap"
                >
                  {roleLabel(role.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => {
              const sensitive = SENSITIVE_PERMISSIONS.has(permission);
              return (
                <tr key={permission} className="border-border border-t">
                  <th scope="row" className="px-3 py-1.5 text-start font-mono text-xs font-normal whitespace-nowrap">
                    {sensitive ? (
                      <Icon name="shield-alert" size={14} className="text-warning me-1 inline" aria-hidden />
                    ) : null}
                    {permission}
                    {sensitive ? <span className="sr-only">{t("sensitive")}</span> : null}
                  </th>
                  {columns.map((role) =>
                    role.permissions.includes(permission) ? (
                      <td key={role.key} className="px-2 py-1.5 text-center">
                        <Icon
                          name="check"
                          size={16}
                          className={sensitive ? "text-warning inline" : "text-success inline"}
                        />
                        <span className="sr-only">{t("granted")}</span>
                      </td>
                    ) : (
                      <td key={role.key} className="px-2 py-1.5 text-center">
                        <span className="sr-only">{t("notGranted")}</span>
                      </td>
                    ),
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
