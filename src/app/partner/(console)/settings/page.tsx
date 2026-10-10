import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { FACTORY_USER_STATUS } from "@/domain/status";
import {
  CreateUser,
  EditUser,
  LabelSize,
  NotificationMatrix,
  PushOnThisDevice,
} from "@/features/partner/account/actions";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { LocaleMenu } from "@/features/shared/shell";
import { StatusChip } from "@/features/partner/status";
import { Card } from "@/ui/components/Card";
import { Icon } from "@/ui/icons";
import { ThemeToggle } from "@/ui/theme/ThemeToggle";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerAccount.settings"))("title") };
}

/**
 * Settings (F5 5.3): the factory's users and roles (Owner only, D-140, `partner.factoryUsers.*`) —
 * active and deactivated —, this user's notification channels — partner-zone push, LINE, e-mail
 * (D-143, D-231, `partner.me.notificationPreferences`) — and this device's label size, language and
 * theme (high contrast for a bright shop floor).
 */
export default async function SettingsPage() {
  const t = await getTranslations("partnerAccount.settings");
  const tUsers = await getTranslations("partnerAccount.users");
  const tRoles = await getTranslations("partner.shell.roles");
  const tCommon = await getTranslations("common");
  const format = await getFormat();
  const context = await factoryContext();
  const { contract } = await partnerServerApis();
  const owner = canAt(context, "factory_users.manage");
  const listUsers = (status: "active" | "deactivated") =>
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/users", {
            params: { path: { factoryId: context.factoryId }, query: { status } },
          })
        ).data ?? [],
    );
  const [active, deactivated, preferences] = await Promise.all([
    owner ? listUsers("active") : null,
    owner ? listUsers("deactivated") : null,
    attempt(async () => (await contract.GET("/v1/partner/me/notification-preferences", {})).data!),
  ]);
  const users = active?.data
    ? { data: [...active.data, ...(deactivated?.data ?? [])], error: deactivated?.error ?? null }
    : active;
  const labelSize = (await cookies()).get("pk_label")?.value === "4x6" ? "4x6" : "100x150";
  const roleName = (role: string) =>
    [
      "factory_owner",
      "factory_planner",
      "factory_operator",
      "factory_qc",
      "factory_shipping",
      "factory_accountant",
      "factory_storekeeper",
      "factory_purchaser",
      "factory_maintenance",
    ].includes(role)
      ? tRoles(role as "factory_owner")
      : role;

  return (
    <PartnerPage title={t("title")} wide>
      {owner ? (
        <PartnerSection title={tUsers("title")} description={tUsers("body")} id="users">
          {users?.data ? (
            <PartnerTable
              caption={tUsers("title")}
              rows={users.data}
              rowKey={(user) => user.id}
              columns={[
                {
                  key: "name",
                  header: tUsers("table.name"),
                  primary: true,
                  cell: (user) => (
                    <span className="flex flex-col">
                      <span className="font-medium">{user.displayName}</span>
                      <span className="text-muted text-sm break-all">{user.email}</span>
                    </span>
                  ),
                },
                {
                  key: "roles",
                  header: tUsers("table.roles"),
                  cell: (user) => user.roles.map(roleName).join(", "),
                },
                {
                  key: "seen",
                  header: tUsers("table.seen"),
                  cell: (user) =>
                    user.lastSignInAt ? (
                      format.dateTime(user.lastSignInAt)
                    ) : (
                      <span className="text-muted">{tUsers("table.never")}</span>
                    ),
                  className: "whitespace-nowrap",
                },
                {
                  key: "status",
                  header: tUsers("table.status"),
                  cell: (user) => <StatusChip map={FACTORY_USER_STATUS} value={user.status} />,
                },
                {
                  key: "manage",
                  header: tUsers("table.manage"),
                  cell: (user) => <EditUser user={user} />,
                  className: "w-[1%] min-w-56",
                },
              ]}
            />
          ) : (
            <PageError error={users?.error} />
          )}
          <details className="border-border bg-surface rounded-xl border">
            <summary className="hover:bg-surface-subtle flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-4 font-medium md:min-h-10">
              <Icon name="user-plus" size={18} />
              {tUsers("createTitle")}
            </summary>
            <div className="border-border border-t p-4">
              <p className="text-muted mb-3 text-sm">{tUsers("createBody")}</p>
              <CreateUser />
            </div>
          </details>
        </PartnerSection>
      ) : null}

      <PartnerSection title={t("hours")} description={t("hoursBody")}>
        <Link href="/settings/hours" className="text-primary inline-flex min-h-11 items-center underline md:min-h-10">
          {t("hoursLink")}
        </Link>
      </PartnerSection>
      {canAt(context, "factory_inventory.read") ? (
        <PartnerSection title={t("erp")} description={t("erpBody")}>
          <Link href="/settings/erp" className="text-primary inline-flex min-h-11 items-center underline md:min-h-10">
            {t("erpLink")}
          </Link>
        </PartnerSection>
      ) : null}
      <PartnerSection title={t("notifications")} description={t("notificationsBody")}>
        <Card padding="md" className="flex flex-col gap-4">
          <PushOnThisDevice />
          {preferences.data ? (
            <NotificationMatrix initial={preferences.data.preferences} lineLinked={preferences.data.lineLinked} />
          ) : (
            <PageError error={preferences.error} />
          )}
        </Card>
      </PartnerSection>

      <PartnerSection title={t("device")} description={t("deviceBody")}>
        <Card padding="md" className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="font-medium">{t("labelSize")}</p>
            <LabelSize initial={labelSize} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-medium">{t("language")}</p>
            <LocaleMenu />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-medium">{t("theme")}</p>
            <ThemeToggle
              label={tCommon("theme.label")}
              choiceLabels={{
                system: tCommon("theme.system"),
                light: tCommon("theme.light"),
                dark: tCommon("theme.dark"),
                hc: tCommon("theme.hc"),
              }}
            />
            <p className="text-muted w-full text-sm">{t("themeHint")}</p>
          </div>
        </Card>
      </PartnerSection>
    </PartnerPage>
  );
}
