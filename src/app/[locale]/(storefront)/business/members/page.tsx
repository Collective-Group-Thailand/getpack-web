import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { requireMember } from "@/features/customer/business/guard.server";
import { MembersManager } from "@/features/customer/business/MembersManager";
import { getActor } from "@/lib/auth/actor";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("business.members");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The company's members and roles (F3 3.7). */
export default async function Page() {
  const company = await requireMember();
  const [t, me] = await Promise.all([getTranslations("business.members"), getActor("customer")]);
  const self = company.members.find((member) => member.user.id === me?.id) ?? null;
  return (
    <div className="flex flex-col gap-6">
      <AccountHeader title={t("title")} lede={t("intro")} />
      <MembersManager
        companyId={company.id}
        members={company.members.filter((member) => member.status !== "removed")}
        canManage={company.can.manageMembers}
        selfId={self?.id ?? null}
      />
    </div>
  );
}
