import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { OpenBoxIllustration } from "@/ui/components/ProductIllustration";

/** A miss inside the signed-in console: rendered inside its layout, so the navigation stays
 * (UX audit: a 404 without the shell is a dead end). */
export default async function ConsoleNotFound() {
  const t = await getTranslations("common.errors");

  return (
    <EmptyState
      className="my-12 border-none"
      titleAs="h1"
      illustration={<OpenBoxIllustration />}
      title={t("notFoundTitle")}
      description={t("notFoundBody")}
      action={
        <Button asChild>
          <Link href="/">{t("backHome")}</Link>
        </Button>
      }
    />
  );
}
