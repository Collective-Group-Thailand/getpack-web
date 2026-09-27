import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { FACTORY_USER_STATUS } from "@/domain/status";
import {
  EditUser,
  InviteUser,
  LabelSize,
  NotificationMatrix,
  PushOnThisDevice,
} from "@/features/partner/account/actions";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { getFormat } from "@/features/shared/format/server";
import { LocaleMenu } from "@/features/shared/shell";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { ThemeToggle } from "@/ui/theme/ThemeToggle";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerAccount.settings"))("title") };
}

/**
 * Settings (F5 5.3): the factory's users and roles (Owner only, D-140), this user's notification
 * channels — partner-zone push, LINE, e-mail (D-143) — and this device's label size, language and
 * theme (high contrast for a bright shop floor).
 */
export default async function SettingsPage() {
  const t = await getTranslations("partnerAccount.settings");
  const tUsers = await getTranslations("partnerAccount.users");
  const tRoles = await getTranslations("partner.shell.roles");
  const tCommon = await getTranslations("common");
  const format = await getFormat();
  const context = await factoryContext();
  const { requests } = await partnerServerApis();
  const owner = canAt(context, "factory_users.manage");
  const [users, preferences] = await Promise.all([
    owner
      ? attempt(() =>
          requests.call("GET /v1/partner/factories/{factoryId}/users", { path: { factoryId: context.factoryId } }),
        )
      : null,
    attempt(() => requests.call("GET /v1/partner/me/notification-preferences", {})),
  ]);
  const labelSize = (await cookies()).get("pk_label")?.value === "4x6" ? "4x6" : "100x150";
  const roleName = (role: string) =>
    [
      "factory_owner",
      "factory_planner",
      "factory_operator",
      "factory_qc",
      "factory_shipping",
      "factory_accountant",
    ].includes(role)
      ? tRoles(role as "factory_owner")
      : role;

  return (
    <PartnerPage title={t("title")}>
      {owner ? (
        <PartnerSection title={tUsers("title")} description={tUsers("body")} id="users">
          {users?.data ? (
            <ul className="flex flex-col gap-2">
              {users.data.map((user) => (
                <li key={user.id}>
                  <Card padding="md" className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{user.displayName}</span>
                        <span className="text-muted text-sm">{user.email}</span>
                      </span>
                      <StatusChip map={FACTORY_USER_STATUS} value={user.status} />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <Badge key={role} size="sm">
                          {roleName(role)}
                        </Badge>
                      ))}
                      {user.lastSignInAt ? (
                        <span className="text-muted text-sm">
                          {tUsers("lastSeen", { date: format.dateTime(user.lastSignInAt) })}
                        </span>
                      ) : null}
                    </div>
                    <EditUser user={user} />
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <PageError error={users?.error} />
          )}
          <Card padding="lg">
            <h3 className="mb-3 text-lg font-semibold">{tUsers("inviteTitle")}</h3>
            <InviteUser />
          </Card>
        </PartnerSection>
      ) : null}

      <PartnerSection title={t("notifications")} description={t("notificationsBody")}>
        <Card padding="lg" className="flex flex-col gap-4">
          <PushOnThisDevice />
          {preferences.data ? (
            <NotificationMatrix initial={preferences.data.preferences} lineLinked={preferences.data.lineLinked} />
          ) : (
            <PageError error={preferences.error} />
          )}
        </Card>
      </PartnerSection>

      <PartnerSection title={t("device")} description={t("deviceBody")}>
        <Card padding="lg" className="flex flex-col gap-5">
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
