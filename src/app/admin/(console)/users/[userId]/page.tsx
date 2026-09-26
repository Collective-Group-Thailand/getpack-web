import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { adminServerApis } from "@/features/admin/console/api.server";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { UserDetail } from "@/features/admin/iam";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("iam.user"))("title") };
}

export default async function UserPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  let initial = null;
  try {
    initial =
      (await (await adminServerApis()).contract.GET("/v1/admin/users/{userId}", { params: { path: { userId } } }))
        .data ?? null;
  } catch {
    // Rendered by the client as the API answered it.
  }
  return (
    <ConsolePage>
      <UserDetail userId={userId} initial={initial} />
    </ConsolePage>
  );
}
