"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import type { Schemas } from "@/lib/api/types";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { PhoneInput } from "@/ui/components/PhoneInput";
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
 * someone who already has a Packio account by their phone (`store.companies.inviteMember`), edits
 * roles and removes people (`store.companies.removeMember`); everyone else reads the list.
 *
 * CONTRACT-GAP store.company-members — a published member is a name only (no phone or e-mail to
 * show), an invitation takes no name, and changing roles is still being built (its request stays).
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
  const [busy, setBusy] = useState(false);

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
    if (ok) setInvite({ phone: "", roles: ["company_buyer"] });
  }

  return (
    <div className="flex flex-col gap-8">
      <ul className="flex flex-col gap-3">
        {members.map((member) => (
          <li key={member.id} className="border-border rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {member.user.displayName}
                  {member.id === selfId ? (
                    <span className="text-muted ms-2 text-sm font-normal">{t("you")}</span>
                  ) : null}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {member.roles.map((role) => (
                    <Badge key={role} tone="neutral">
                      {t(`roles.${role}`)}
                    </Badge>
                  ))}
                  {member.status === "invited" ? <Badge tone="warning">{t("invitedBadge")}</Badge> : null}
                </div>
                {member.joinedAt ? (
                  <p className="text-muted mt-1 text-xs">{t("joined", { date: format.date(member.joinedAt) })}</p>
                ) : null}
              </div>
              {canManage ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
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
                </div>
              ) : null}
            </div>
            {editing?.id === member.id ? (
              <div className="mt-4 flex flex-col gap-3">
                <RoleBoxes
                  value={editing.roles}
                  onChange={(roles) => setEditing({ id: member.id, roles })}
                  legend={t("rolesOf", { name: member.user.displayName })}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    loading={busy}
                    disabled={editing.roles.length === 0}
                    onClick={async () => {
                      const ok = await run(
                        () =>
                          browserRequests().call("PATCH /v1/store/me/company/members/{memberId}", {
                            path: { memberId: member.id },
                            body: { roles: editing.roles },
                          }),
                        t("saved"),
                      );
                      if (ok) setEditing(null);
                    }}
                  >
                    {t("save")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    {t("cancel")}
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {canManage ? (
        <section
          aria-labelledby="members-invite"
          className="border-border flex max-w-xl flex-col gap-4 rounded-xl border p-5"
        >
          <h2 id="members-invite" className="text-lg font-semibold">
            {t("inviteTitle")}
          </h2>
          <form noValidate onSubmit={(event) => void sendInvite(event)} className="flex flex-col gap-4">
            <Field label={t("phone")} hint={t("phoneHint")} error={inviteError.phone}>
              <PhoneInput value={invite.phone} onChange={(phone) => setInvite((current) => ({ ...current, phone }))} />
            </Field>
            <RoleBoxes
              value={invite.roles}
              onChange={(roles) => setInvite((current) => ({ ...current, roles }))}
              legend={t("rolesLegend")}
            />
            {inviteError.roles ? <p className="text-danger text-xs">{inviteError.roles}</p> : null}
            <Button type="submit" className="self-start" loading={busy}>
              {t("invite")}
            </Button>
          </form>
        </section>
      ) : null}

      <AlertDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("removeTitle", { name: removing?.user.displayName ?? "" })}
        description={t("removeBody")}
        confirmLabel={t("remove")}
        cancelLabel={t("cancel")}
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
