import { getTranslations } from "next-intl/server";

import { Card } from "@/ui";

/**
 * The partner zone's landing screen. Still a placeholder — F5 builds Today, jobs, QC, ship and
 * billing — but the shop-floor frame around it is real: bottom nav, 64 px targets, 18 px base
 * text and the high-contrast theme.
 */
export default async function PartnerHomePage() {
  const t = await getTranslations("partner.placeholder");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{t("heading")}</h1>
      <Card className="mt-6" padding="lg">
        <p className="text-muted">{t("body")}</p>
      </Card>
    </div>
  );
}
