import { getTranslations } from "next-intl/server";

import { canAt, factoryContext } from "@/features/partner/context/server";
import { Row, RowList } from "@/features/partner/rows";
import type { IconName } from "@/ui/icons";

import { SettingsNav, type SettingsNavItem } from "./SettingsNav";

export type SettingsKey =
  "overview" | "users" | "profile" | "notifications" | "device" | "hours" | "erp" | "documents" | "support";

/**
 * The settings layout (groups 7+8): on a desk the sections in a column on the left — the overview's own sections
 * first, then each setting with a page of its own — and the page beside it; on a phone the overview opens with the
 * same sections as a list to tap, and a setting's own page leads back to it. Which sections show is the role's.
 */
export async function SettingsFrame({ current, children }: { current: SettingsKey; children: React.ReactNode }) {
  const [t, tUsers, context] = await Promise.all([
    getTranslations("partnerAccount.settings"),
    getTranslations("partnerAccount.users"),
    factoryContext(),
  ]);
  const can = (permission: string) => canAt(context, permission);
  const all: (SettingsNavItem & { show: boolean; icon: IconName; body: string })[] = [
    {
      key: "users",
      href: "/settings#users",
      anchor: "users",
      label: tUsers("title"),
      body: tUsers("body"),
      icon: "users",
      show: can("factory_users.manage"),
    },
    {
      key: "profile",
      href: "/settings#profile",
      anchor: "profile",
      label: t("profile"),
      body: t("profileBody"),
      icon: "factory",
      show: can("factory_profile.read"),
    },
    {
      key: "notifications",
      href: "/settings#notifications",
      anchor: "notifications",
      label: t("notifications"),
      body: t("notificationsBody"),
      icon: "bell",
      show: true,
    },
    {
      key: "device",
      href: "/settings#device",
      anchor: "device",
      label: t("device"),
      body: t("deviceBody"),
      icon: "tablet",
      show: true,
    },
    { key: "hours", href: "/settings/hours", label: t("hours"), body: t("hoursBody"), icon: "clock", show: true },
    {
      key: "erp",
      href: "/settings/erp",
      label: t("erp"),
      body: t("erpBody"),
      icon: "warehouse",
      show: can("factory_inventory.read"),
    },
    {
      key: "documents",
      href: can("factory_profile.read") ? "/settings/documents" : "/settings/documents#my-signature",
      label: t("documents"),
      body: t("documentsBody"),
      icon: "signature",
      show: true,
    },
    {
      key: "support",
      href: "/settings/support",
      label: t("support"),
      body: t("supportBody"),
      icon: "shield",
      show: can("factory_support.grant"),
    },
  ];
  const items = all.filter((item) => item.show);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10 xl:gap-12">
      <div className="hidden lg:sticky lg:top-20 lg:block">
        <SettingsNav
          label={t("title")}
          current={current}
          items={items.map(({ key, href, label, anchor }) => ({ key, href, label, ...(anchor ? { anchor } : {}) }))}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-6 md:gap-8">
        {current === "overview" ? (
          <div className="lg:hidden">
            <RowList label={t("title")}>
              {items.map((item) => (
                <Row key={item.key} href={item.href} icon={item.icon} title={item.label} meta={item.body} />
              ))}
            </RowList>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
