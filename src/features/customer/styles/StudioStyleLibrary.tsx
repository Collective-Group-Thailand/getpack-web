import { STYLES, type BoxCategory } from "@getpack/dieline";
import { getLocale, getTranslations } from "next-intl/server";

import { studioHref } from "@/features/customer/studio/paths";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { ProductPlate, type ProductFamily } from "@/ui/components/ProductIllustration";

const FAMILY: Record<BoxCategory, ProductFamily> = {
  folding_carton: "tuck",
  corrugated: "shipping",
  tray_lid: "rigid",
  specialty: "display",
  flat: "tag",
};
const ORDER: BoxCategory[] = ["folding_carton", "corrugated", "tray_lid", "specialty", "flat"];

/**
 * The studio's own box styles (`@getpack/dieline`), shown when the API's style library has nothing
 * published yet (UX audit: "/styles แสดง 0 แบบ ทั้งที่ studio มีแบบกล่องหลายสิบแบบ"). The API lists
 * only styles that are publishable — a verified recipe and a factory able to make it (D-243) — so
 * an empty library is honest about ordering, but the studio can still draw every one of these.
 * Each card opens the studio on that style at its default size; nothing here is priced.
 */
export async function StudioStyleLibrary() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("styles.studioLibrary")]);
  const pick = (value: { th: string; en: string }) => (locale === "en" ? value.en : value.th);
  const groups = ORDER.map((category) => ({
    category,
    styles: STYLES.filter((style) => style.category === category),
  })).filter((group) => group.styles.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <Callout tone="info" title={t("title", { count: STYLES.length })}>
        {t("body")}
      </Callout>
      {groups.map((group) => (
        <section key={group.category} aria-labelledby={`studio-styles-${group.category}`}>
          <h2 id={`studio-styles-${group.category}`} className="mb-4 text-xl font-semibold">
            {t(`categories.${group.category}`)}{" "}
            <span className="text-muted text-sm font-normal">{t("count", { count: group.styles.length })}</span>
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.styles.map((style) => {
              const l = Number(style.defaults.length ?? 100);
              const w = Number(style.defaults.width ?? 100);
              const h = Number(style.defaults.height ?? 50);
              return (
                <li
                  key={style.id}
                  className="border-border bg-surface rounded-card hover:shadow-lift duration-base ease-standard flex flex-col overflow-hidden border transition-shadow"
                >
                  <ProductPlate family={FAMILY[style.category]} />
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <h3 className="leading-snug font-semibold">{pick(style.name)}</h3>
                    {style.codes?.fefco || style.codes?.ecma ? (
                      <p className="flex flex-wrap gap-1">
                        {style.codes.fefco ? <Badge size="sm">{t("fefco", { code: style.codes.fefco })}</Badge> : null}
                        {style.codes.ecma ? <Badge size="sm">{t("ecma", { code: style.codes.ecma })}</Badge> : null}
                      </p>
                    ) : null}
                    <p className="text-muted line-clamp-2 text-sm">{pick(style.description)}</p>
                    <Button asChild size="sm" className="mt-auto self-start" iconEnd="arrow-right">
                      <Link href={studioHref({ style: style.id, dims: { l, w, h } })}>{t("design")}</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
