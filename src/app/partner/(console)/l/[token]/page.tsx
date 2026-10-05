import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DeepLinkMiss } from "@/features/shared/deep-links/DeepLinkMiss";
import { resolveDeepLink } from "@/features/shared/deep-links/resolve.server";
import { Button } from "@/ui/components/Button";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** A notification's link on this zone (U5.1 §2, D-299): the console layout has signed the reader in. */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const outcome = await resolveDeepLink("partner", token);
  if (outcome.kind === "elsewhere") redirect(outcome.url);
  if (outcome.kind === "go") redirect(outcome.path);
  const t = await getTranslations("common.deepLink");
  return (
    <DeepLinkMiss
      reason={outcome.kind}
      actions={
        <Button asChild>
          <Link href="/">{t("home")}</Link>
        </Button>
      }
    />
  );
}
