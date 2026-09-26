import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getMembers } from "@/features/customer/business/api.server";
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
  const [t, members, me] = await Promise.all([getTranslations("business.members"), getMembers(), getActor("customer")]);
  const self = members?.data.find((member) => member.user.phone && member.user.phone === me?.phone) ?? null;
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted mt-2">{t("intro")}</p>
      </header>
      <MembersManager members={members?.data ?? []} canManage={company.can.manageMembers} selfId={self?.id ?? null} />
    </div>
  );
}
