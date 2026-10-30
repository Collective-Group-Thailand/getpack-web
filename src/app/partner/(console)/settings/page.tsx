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
import { SettingsFrame } from "@/features/partner/settings/SettingsFrame";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { LocaleMenu } from "@/features/shared/shell";
import { StatusChip } from "@/features/partner/status";
import { Card } from "@/ui/components/Card";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";
import { ThemeToggle } from "@/ui/theme/ThemeToggle";

/** What the factory agreed with getpack, kept on its onboarding steps — read here after go-live, changed by request. */
const PROFILE_STEPS = [
  "application",
  "kyc",
  "bank_account",
  "capability",
  "capacity",
  "delivery_zones",
  "payout_policy",
  "agreement",
] as const;

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
  const tSteps = await getTranslations("partnerOnboarding.steps");
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
      "factory_sales",
      "factory_auditor",
    ].includes(role)
      ? tRoles(role as "factory_owner")
      : role;

  return (
    <PartnerPage full title={t("title")}>
      <SettingsFrame current="overview">
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
                    header: <span className="sr-only">{tUsers("table.manage")}</span>,
                    cell: (user) => <EditUser user={user} />,
                    className: "w-[1%] whitespace-nowrap",
                  },
                ]}
              />
            ) : (
              <PageError error={users?.error} />
            )}
            <details className="group border-border bg-surface rounded-xl border">
              <summary className="hover:bg-surface-subtle focus-visible:ring-focus-ring flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-4 font-medium outline-none focus-visible:ring-2 md:min-h-10 [&::-webkit-details-marker]:hidden">
                <Icon name="user-plus" size={18} aria-hidden="true" className="text-muted" />
                {tUsers("createTitle")}
                <Icon
                  name="chevron-down"
                  size={16}
                  aria-hidden="true"
                  className="text-muted ms-auto transition-transform group-open:rotate-180 motion-reduce:transition-none"
                />
              </summary>
              <div className="border-border border-t p-4 sm:p-5">
                <p className="text-muted mb-4 text-sm">{tUsers("createBody")}</p>
                <CreateUser />
              </div>
            </details>
          </PartnerSection>
        ) : null}

        {canAt(context, "factory_profile.read") ? (
          <PartnerSection id="profile" title={t("profile")} description={t("profileBody")}>
            <ul className="border-border bg-surface divide-border grid overflow-hidden rounded-xl border sm:grid-cols-2 sm:divide-x-0">
              {PROFILE_STEPS.map((step, at) => (
                <li
                  key={step}
                  className={cn(
                    "border-border min-w-0",
                    at > 0 && "border-t",
                    at === 1 && "sm:border-t-0",
                    at % 2 === 1 && "sm:border-s",
                  )}
                >
                  <Link
                    href={`/onboarding/${step}`}
                    className="hover:bg-surface-subtle focus-visible:ring-focus-ring flex h-full items-center gap-3 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-medium">{tSteps(`${step}.title`)}</span>
                      <span className="text-muted text-sm text-pretty">{tSteps(`${step}.body`)}</span>
                    </span>
                    <Icon name="chevron-right" size={18} aria-hidden="true" className="text-muted shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </PartnerSection>
        ) : null}

        <PartnerSection id="notifications" title={t("notifications")} description={t("notificationsBody")}>
          <Card padding="md" className="flex flex-col gap-4">
            <PushOnThisDevice />
            {preferences.data ? (
              <NotificationMatrix initial={preferences.data.preferences} lineLinked={preferences.data.lineLinked} />
            ) : (
              <PageError error={preferences.error} />
            )}
          </Card>
        </PartnerSection>

        <PartnerSection id="device" title={t("device")} description={t("deviceBody")}>
          <dl className="border-border bg-surface divide-border divide-y rounded-xl border">
            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:gap-6 sm:px-5">
              <dt className="font-medium sm:w-44 sm:shrink-0 sm:pt-2">{t("labelSize")}</dt>
              <dd className="min-w-0 flex-1">
                <LabelSize initial={labelSize} />
              </dd>
            </div>
            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-5">
              <dt className="font-medium sm:w-44 sm:shrink-0">{t("language")}</dt>
              <dd className="min-w-0 flex-1">
                <LocaleMenu />
              </dd>
            </div>
            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:gap-6 sm:px-5">
              <dt className="font-medium sm:w-44 sm:shrink-0 sm:pt-2">{t("theme")}</dt>
              <dd className="flex min-w-0 flex-1 flex-col gap-2">
                <ThemeToggle
                  label={tCommon("theme.label")}
                  choiceLabels={{
                    system: tCommon("theme.system"),
                    light: tCommon("theme.light"),
                    dark: tCommon("theme.dark"),
                    hc: tCommon("theme.hc"),
                  }}
                />
                <p className="text-muted text-sm">{t("themeHint")}</p>
              </dd>
            </div>
          </dl>
        </PartnerSection>
      </SettingsFrame>
    </PartnerPage>
  );
}
