"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { statusMeta, USER_STATUS } from "@/domain/status";
import { When } from "@/features/shared/format";
import { applyProblemToForm, isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage, ResourceList, useCan, useRoleLabel, type InitialPage } from "../console";
import type { User } from "./grants";
import { usersList } from "./resources";

/** `CreateUserDto.initialPassword` minLength in the contract. */
const PASSWORD_MIN = 12;

export function UsersList({ initial }: { initial: InitialPage<User> | null }) {
  const t = useTranslations("iam.users");
  const tStatus = useTranslations("status");
  const roleLabel = useRoleLabel();
  const canManage = useCan("users.manage");

  const columns: DataTableColumn<User>[] = [
    {
      id: "displayName",
      header: t("columns.name"),
      sortable: true,
      cell: (row) => (
        <Link href={`/users/${row.id}`} className="text-primary font-medium hover:underline">
          {row.displayName}
        </Link>
      ),
    },
    { id: "email", header: t("columns.email"), cell: (row) => row.email ?? "—" },
    {
      id: "roles",
      header: t("columns.roles"),
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          {row.roles.map((grant) => (
            <Badge key={grant.id} size="sm">
              {roleLabel(grant.role)}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => {
        const meta = statusMeta(USER_STATUS, row.status);
        return <StatusBadge size="sm" meta={meta} label={tStatus(meta.labelKey)} />;
      },
    },
    { id: "lastLoginAt", header: t("columns.lastLogin"), sortable: true, cell: (row) => <When at={row.lastLoginAt} /> },
  ];

  return (
    <ResourceList
      resource={usersList}
      columns={columns}
      caption={t("title")}
      initial={initial}
      searchLabel={t("search")}
      searchPlaceholder={t("searchPlaceholder")}
      filters={[
        { id: "kind", label: t("columns.kind"), kind: "select", options: (["staff", "partner", "customer"] as const).map((value) => ({ value, label: t(`kinds.${value}`) })) },
        {
          id: "status",
          label: t("columns.status"),
          kind: "select",
          options: Object.entries(USER_STATUS).map(([value, meta]) => ({ value, label: tStatus(meta.labelKey) })),
        },
      ]}
      toolbarEnd={canManage ? <CreateUser /> : null}
    />
  );
}

function CreateUser() {
  const t = useTranslations("iam.users.create");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ displayName: "", email: "", initialPassword: "", kind: "staff" as "staff" | "partner" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: async () => (await adminBrowserApis().contract.POST("/v1/admin/users", { body: values })).data!,
    onSuccess: (user) => {
      toast.success(t("created"));
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "user") });
      setOpen(false);
      router.push(`/users/${user.id}`);
    },
    onError: (error) => {
      if (isApiError(error) && error.errors.length > 0) {
        const next: Record<string, string> = {};
        applyProblemToForm(error, (path, { message }) => (next[path] = message));
        setErrors(next);
      } else setErrors({ form: problemMessage(error, t("failed")) });
    },
  });

  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [key]: event.target.value });

  return (
    <>
      <Button size="sm" iconStart="user-plus" onClick={() => setOpen(true)}>
        {t("open")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        description={t("description")}
        closeLabel={tCommon("actions.close")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {tCommon("actions.cancel")}
            </Button>
            <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!values.displayName || !values.email || values.initialPassword.length < PASSWORD_MIN}>
              {t("submit")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {errors.form ? <p className="text-danger text-sm">{errors.form}</p> : null}
          <Field label={t("kind")}>
            <SegmentedControl
              label={t("kind")}
              value={values.kind}
              onValueChange={(kind) => setValues({ ...values, kind })}
              options={[
                { value: "staff", label: t("kinds.staff") },
                { value: "partner", label: t("kinds.partner") },
              ]}
            />
          </Field>
          <Field label={t("displayName")} required requiredLabel={tCommon("state.required")} error={errors.displayName}>
            <Input value={values.displayName} onChange={set("displayName")} />
          </Field>
          <Field label={t("email")} required requiredLabel={tCommon("state.required")} error={errors.email}>
            <Input type="email" autoComplete="off" value={values.email} onChange={set("email")} />
          </Field>
          <Field label={t("password")} hint={t("passwordHint", { min: PASSWORD_MIN })} required requiredLabel={tCommon("state.required")} error={errors.initialPassword}>
            <Input type="password" autoComplete="new-password" value={values.initialPassword} onChange={set("initialPassword")} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
