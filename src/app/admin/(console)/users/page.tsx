import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { UsersList } from "@/features/admin/iam";
import { usersList } from "@/features/admin/iam/resources";
import { Button } from "@/ui/components/Button";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("iam.users"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Staff and partner accounts and their role grants (D-140). */
export default async function UsersPage({ searchParams }: Props) {
  const t = await getTranslations("iam.users");
  const initial = await prefetchList(usersList, await searchParams);
  return (
    <ConsolePage>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button variant="secondary" size="sm" iconStart="key" asChild>
            <Link href="/users/roles">{t("rolesLink")}</Link>
          </Button>
        }
      />
      <UsersList initial={initial} />
    </ConsolePage>
  );
}
