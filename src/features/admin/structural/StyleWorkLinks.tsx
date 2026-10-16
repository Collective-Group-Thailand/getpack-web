import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { can, getActor } from "@/lib/auth/actor";
import { Button } from "@/ui/components/Button";

/**
 * The way into structural design requests and factory dieline offers (U3.6): getpack-api's menu has
 * no entries for them yet (CONTRACT-REQUEST admin.menu-styles), so the catalogue, prepress and
 * orders pages link them for whoever holds the permission.
 */
export async function StyleWorkLinks() {
  const [t, actor] = await Promise.all([getTranslations("catalogue.links"), getActor("admin")]);
  const requests = can(actor, "structural_requests.manage") || can(actor, "structural_requests.design");
  const intakes = can(actor, "styles.import") || can(actor, "styles.approve_recipe");
  if (!requests && !intakes) return null;
  return (
    <span className="flex flex-wrap gap-2">
      {requests ? (
        <Button asChild variant="secondary" iconStart="ruler">
          <Link href="/structural-requests">{t("requests")}</Link>
        </Button>
      ) : null}
      {intakes ? (
        <Button asChild variant="secondary" iconStart="upload">
          <Link href="/style-intakes">{t("intakes")}</Link>
        </Button>
      ) : null}
    </span>
  );
}
