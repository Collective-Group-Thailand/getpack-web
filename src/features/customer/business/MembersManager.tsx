"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { PortalTable } from "@/features/customer/account/PortalTable";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { PhoneInput } from "@/ui/components/PhoneInput";
import { Sheet } from "@/ui/components/Sheet";
import { toast } from "@/ui/components/Toast";

type Member = Schemas["CompanyMemberDto"];
type Role = Schemas["CompanyRole"];

/** `0812345678` → `+66812345678`, the form `store.companies.inviteMember` takes. */
const e164 = (phone: string) => `+66${phone.slice(1)}`;
const ROLES: Role[] = ["company_admin", "company_buyer", "company_approver", "company_accountant"];

function RoleBoxes({ value, onChange, legend }: { value: Role[]; onChange: (roles: Role[]) => void; legend: string }) {
  const t = useTranslations("business.members");
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {ROLES.map((role) => (
        <Checkbox
          key={role}
          checked={value.includes(role)}
          onCheckedChange={(checked) =>
            onChange(checked === true ? [...value, role] : value.filter((entry) => entry !== role))
          }
          label={t(`roles.${role}`)}
          description={t(`roleHints.${role}`)}
        />
      ))}
    </fieldset>
  );
}

/**
 * Members and their roles (F3 3.7): Company Admin, Buyer, Approver, Accountant. An admin invites
 * someone who already has a getpack account by their phone (`store.companies.inviteMember`), edits
 * roles (`store.companies.changeMemberRoles`; the last Company Admin keeps the role, 409
 * `companies.last_admin`) and removes people (`store.companies.removeMember`); everyone else reads
 * the list. Members are shown by name and role only: their e-mail and phone stay private (D-224).
 * The list is a `PortalTable` (UX pass 2026-10-16) and roles are edited in one panel under it.
 */
export function MembersManager({
  companyId,
  members,
  canManage,
  selfId,
}: {
  companyId: string;
  members: Member[];
  canManage: boolean;
  selfId: string | null;
}) {
  const t = useTranslations("business.members");
  const format = useFormat();
  const router = useRouter();
  const [invite, setInvite] = useState({ phone: "", roles: ["company_buyer"] as Role[] });
  const [inviteError, setInviteError] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ id: string; roles: Role[] } | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState(false);
  const editingMember = editing ? members.find((member) => member.id === editing.id) : undefined;

  async function run(call: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await call();
      toast.success(done);
      router.refresh();
      return true;
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function sendInvite(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!/^0\d{8,9}$/.test(invite.phone)) found.phone = t("errors.phone");
    if (invite.roles.length === 0) found.roles = t("errors.roles");
    setInviteError(found);
    if (Object.keys(found).length > 0) return;
    const ok = await run(
      () =>
        browserApi().POST("/v1/store/companies/{companyId}/members", {
          params: { path: { companyId } },
          body: { phone: e164(invite.phone), roles: invite.roles },
        }),
      t("invited", { name: invite.phone }),
    );
    if (ok) {
      setInvite({ phone: "", roles: ["company_buyer"] });
      setInviting(false);
    }
  }

  const saveRoles = async () => {
    if (!editing || !editingMember) return;
    const ok = await run(
      () =>
        browserApi().PUT("/v1/store/companies/{companyId}/members/{memberId}/roles", {
          params: { path: { companyId, memberId: editingMember.id } },
          body: { roles: editing.roles },
        }),
      t("saved"),
    );
    if (ok) setEditing(null);
  };
  const countOf = (role: Role) => members.filter((member) => member.roles.includes(role)).length;

  // Project C: how many hold each role as summary cards; the list as the account's table with a person's
  // initial beside their name; inviting and changing roles in side sheets over the list, removing behind a
  // confirmation in the danger tone.
  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {ROLES.map((role) => (
          <div key={role} className="border-border bg-surface rounded-card flex flex-col gap-1 border p-4">
            <dt className="text-muted text-sm">{t(`roles.${role}`)}</dt>
            <dd className="text-[1.625rem] leading-tight font-semibold tabular-nums">{format.number(countOf(role))}</dd>
            <dd className="text-muted text-xs text-pretty">{t(`roleHints.${role}`)}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {t("tableCaption")} <span className="text-muted text-sm font-medium tabular-nums">{members.length}</span>
        </h2>
        {canManage ? (
          <Button iconStart="user-plus" onClick={() => setInviting(true)}>
            {t("inviteTitle")}
          </Button>
        ) : null}
      </div>

      <PortalTable
        caption={t("tableCaption")}
        columns={[
          { key: "name", label: t("columns.name"), className: "md:w-[34%]" },
          { key: "roles", label: t("columns.roles") },
          { key: "joined", label: t("columns.joined"), className: "md:whitespace-nowrap" },
          ...(canManage
            ? [{ key: "actions", label: t("columns.actions"), srOnly: true, className: "md:w-px md:whitespace-nowrap" }]
            : []),
        ]}
        rows={members.map((member) => ({
          id: member.id,
          cells: {
            name: (
              <span className="flex items-center gap-3">
                <Avatar name={member.user.displayName} size="sm" />
                <span className="min-w-0">
                  {member.user.displayName}
                  {member.id === selfId ? (
                    <span className="text-muted ms-2 text-sm font-normal">{t("you")}</span>
                  ) : null}
                </span>
              </span>
            ),
            roles: (
              <span className="flex flex-wrap justify-end gap-1 md:justify-start">
                {member.roles.map((role) => (
                  <Badge key={role} tone={role === "company_admin" ? "primary" : "neutral"}>
                    {t(`roles.${role}`)}
                  </Badge>
                ))}
                {member.status === "invited" ? <Badge tone="warning">{t("invitedBadge")}</Badge> : null}
              </span>
            ),
            joined: member.joinedAt ? format.date(member.joinedAt) : t("notJoined"),
            actions: canManage ? (
              <span className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  iconStart="edit"
                  onClick={() => setEditing({ id: member.id, roles: member.roles })}
                >
                  {t("editRoles")}
                  <span className="sr-only"> {member.user.displayName}</span>
                </Button>
                {member.id !== selfId ? (
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(member)}>
                    {t("remove")}
                    <span className="sr-only"> {member.user.displayName}</span>
                  </Button>
                ) : null}
              </span>
            ) : null,
          },
        }))}
      />

      <Sheet
        open={Boolean(editingMember && editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editingMember ? t("rolesOf", { name: editingMember.user.displayName }) : ""}
        closeLabel={t("cancel")}
        footer={
          <>
            <Button loading={busy} disabled={!editing || editing.roles.length === 0} onClick={() => void saveRoles()}>
              {t("save")}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {t("cancel")}
            </Button>
          </>
        }
      >
        {editing && editingMember ? (
          <RoleBoxes
            value={editing.roles}
            onChange={(roles) => setEditing({ id: editingMember.id, roles })}
            legend={t("rolesLegend")}
          />
        ) : null}
      </Sheet>

      {canManage ? (
        <Sheet
          open={inviting}
          onOpenChange={setInviting}
          title={t("inviteTitle")}
          closeLabel={t("cancel")}
          footer={
            <>
              <Button type="submit" form="members-invite-form" loading={busy}>
                {t("invite")}
              </Button>
              <Button variant="ghost" onClick={() => setInviting(false)}>
                {t("cancel")}
              </Button>
            </>
          }
        >
          <form
            id="members-invite-form"
            noValidate
            onSubmit={(event) => void sendInvite(event)}
            className="flex flex-col gap-5"
          >
            <Field label={t("phone")} hint={t("phoneHint")} error={inviteError.phone}>
              <PhoneInput value={invite.phone} onChange={(phone) => setInvite((current) => ({ ...current, phone }))} />
            </Field>
            <RoleBoxes
              value={invite.roles}
              onChange={(roles) => setInvite((current) => ({ ...current, roles }))}
              legend={t("rolesLegend")}
            />
            {inviteError.roles ? <p className="text-danger text-xs">{inviteError.roles}</p> : null}
          </form>
        </Sheet>
      ) : null}

      <AlertDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("removeTitle", { name: removing?.user.displayName ?? "" })}
        description={t("removeBody")}
        confirmLabel={t("remove")}
        cancelLabel={t("cancel")}
        tone="destructive"
        loading={busy}
        onConfirm={async () => {
          if (!removing) return;
          const ok = await run(
            () =>
              browserApi().POST("/v1/store/companies/{companyId}/members/{memberId}/actions/remove", {
                params: { path: { companyId, memberId: removing.id } },
              }),
            t("removed", { name: removing.user.displayName }),
          );
          if (ok) setRemoving(null);
        }}
      />
    </div>
  );
}
