import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

/**
 * A loyalty surface that is not open to this visitor (loyalty P4, D-509, D-510; prototype `p4-customer-states.html`):
 * a quiet card — a clock on `bg-subtle`, "ส่วนนี้ยังไม่เปิดให้บริการ", one calm sentence, and where to go instead
 * ("ไปหน้าแต้มของฉัน" when signed in and the points page is theirs, "เลือกสินค้า"). It never says rollout, budget or
 * why. The page that renders it sets `robots: noindex` (`unavailableMetadata`).
 */
export function FeatureUnavailable({
  signedIn,
  pointsHref = "/account/points",
  showPoints = true,
  liff = false,
  className,
}: {
  signedIn: boolean;
  /** `/liff/points` inside LINE. */
  pointsHref?: string;
  /** False when the points page itself is the closed one (`/liff/points` with `pointsLiff` off). */
  showPoints?: boolean;
  liff?: boolean;
  className?: string;
}) {
  const t = useTranslations("storefront.unavailable");
  const points = signedIn && showPoints;
  return (
    <section
      aria-labelledby="unavailable-title"
      className={cn(
        "border-border bg-surface rounded-panel border",
        liff ? "p-5" : "mx-auto mt-8 max-w-xl px-6 py-8 sm:mt-16 sm:px-8 sm:py-9",
        className,
      )}
    >
      <span aria-hidden="true" className="bg-bg-subtle text-muted rounded-card grid size-11 place-items-center">
        <Icon name="clock" size={20} />
      </span>
      <h1
        id="unavailable-title"
        className={cn("mt-4 leading-snug font-semibold", liff ? "text-xl" : "text-[1.375rem] sm:text-2xl")}
      >
        {t("title")}
      </h1>
      <p className={cn("text-muted mt-2 max-w-[44ch]", liff ? "text-sm" : "text-[0.9375rem]")}>{t("body")}</p>
      <div className="mt-5 flex flex-wrap gap-2.5 sm:mt-6">
        {points ? (
          <Button asChild size="nav" className={cn(liff && "flex-1")}>
            <Link href={pointsHref}>{t("toPoints")}</Link>
          </Button>
        ) : null}
        <Button asChild size="nav" variant={points ? "secondary" : "primary"} className={cn(liff && "flex-1")}>
          <Link href="/products">{t("toProducts")}</Link>
        </Button>
      </div>
    </section>
  );
}

/** A closed surface's page stays out of search results (P4-PLAN §6.1). */
export const UNAVAILABLE_ROBOTS = { index: false, follow: true } as const;
