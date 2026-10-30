import { getTranslations } from "next-intl/server";

import type { Configurator } from "@/features/customer/catalog/api.server";
import { fluteOf } from "@/features/customer/catalog/flute";
import { pick } from "@/features/customer/catalog/localize";
import { rfqHref } from "@/features/customer/catalog/paths";
import { FluteFigure, HubSection } from "@/features/customer/products/HubSections";
import { STYLES_HREF } from "@/features/customer/styles/paths";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { DisclosureList } from "@/ui/components/DisclosureList";
import { Icon } from "@/ui/icons";

import { SeenTracker, TrackedLink } from "./tracking";

export interface GuideGroup {
  key: string;
  flute: string | null;
  materials: { code: string; name: string; description: string | null; caliperMm: number | null }[];
  products: string[];
}

/**
 * The guide's groups from the API's board options (category Phase 1 item 6): corrugated → one card per flute
 * (`fluteOf`), each with its boards (name, caliper, approved description — DECISIONS-STAGE-A §8) and the products
 * of this category that offer it. A material guide (other categories) takes only the approved content's materials.
 * Nothing is rated or estimated: the prototype's meters and "หนาราว x มม." are sample data (open question Q5).
 */
export function guideGroups(
  configurators: readonly Configurator[],
  names: ReadonlyMap<string, string>,
  locale: string,
  materialCodes: readonly string[] | null,
): GuideGroup[] {
  const groups = new Map<string, GuideGroup>();
  for (const configurator of configurators) {
    for (const group of configurator.optionGroups) {
      if (group.kind !== "material") continue;
      for (const option of group.options) {
        const flute = materialCodes ? null : fluteOf(option);
        if (materialCodes ? !materialCodes.includes(option.code) : !flute) continue;
        const key = flute ?? option.code;
        const entry = groups.get(key) ?? { key, flute, materials: [], products: [] };
        if (!entry.materials.some((material) => material.code === option.code)) {
          const caliper = option.attributes.caliperMm;
          entry.materials.push({
            code: option.code,
            name: pick(locale, option.nameTh, option.nameEn),
            description: pick(locale, option.descriptionTh ?? "", option.descriptionEn ?? "") || null,
            caliperMm: typeof caliper === "number" && caliper > 0 ? caliper : null,
          });
        }
        const product = names.get(configurator.slug);
        if (product && !entry.products.includes(product)) entry.products.push(product);
        groups.set(key, entry);
      }
    }
  }
  return [...groups.values()];
}

export async function CategoryGuide({
  category,
  kind,
  groups,
  title,
  compareLink,
}: {
  category: string;
  kind: "flute" | "material";
  groups: readonly GuideGroup[];
  title: string;
  compareLink: boolean;
}) {
  const t = await getTranslations("catalog.categoryPage.guide");
  return (
    <HubSection
      id="guide"
      title={title}
      lede={kind === "flute" ? t("fluteLede") : undefined}
      aside={
        compareLink ? (
          <Button asChild variant="secondary">
            <Link href="/materials">{t("compare")}</Link>
          </Button>
        ) : undefined
      }
    >
      <SeenTracker track={{ event: "category_guide_view", properties: { category, kind } }}>
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 lg:grid-cols-3">
          {groups.map((group) => (
            <li key={group.key} className="border-border bg-surface rounded-card flex flex-col gap-2.5 border p-5">
              {group.flute ? (
                <span className="text-border-strong [&_svg]:h-14 [&_svg]:w-full">
                  <FluteFigure flute={group.flute} label={t("figure", { flute: group.flute })} />
                </span>
              ) : null}
              <h3 className="m-0 text-[1.0625rem] font-semibold">
                {group.flute ? t("flute", { flute: group.flute }) : group.materials[0]?.name}
              </h3>
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[0.84375rem]">
                {group.materials.map((material) => (
                  <li key={material.code}>
                    <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <span className="font-medium">{material.name}</span>
                      {material.caliperMm ? (
                        <small className="text-muted tabular-nums">{t("caliper", { mm: material.caliperMm })}</small>
                      ) : null}
                    </span>
                    {material.description ? <span className="text-muted block">{material.description}</span> : null}
                  </li>
                ))}
              </ul>
              {group.products.length ? (
                <p className="text-muted mt-auto mb-0 text-[0.78125rem]">
                  {t("usedBy", { products: group.products.join(", ") })}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </SeenTracker>
    </HubSection>
  );
}

/**
 * "ต้องการแบบอื่น" (category Phase 1 item 7, prototype `#custom`): the style library filtered to this category with
 * its live count (only when the library has styles for it), and the quotation request ("ส่งสเปกให้ทีม รับใบเสนอราคา
 * ภายในวันทำการ" — the existing copy).
 */
export async function CrossLink({
  category,
  categoryName,
  styles,
  quote,
}: {
  category: string;
  categoryName: string;
  styles: { category: string; count: number } | null;
  quote: boolean;
}) {
  const [t, tCatalog] = await Promise.all([getTranslations("catalog.categoryPage"), getTranslations("catalog")]);
  if (!styles && !quote) return null;
  const tile = "rounded-card grid grid-cols-1 items-center gap-4 p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] md:px-6";
  return (
    <HubSection id="custom" title={t("custom.title")}>
      <div className="flex flex-col gap-3">
        {styles ? (
          <TrackedLink
            href={`${STYLES_HREF}?cat=${encodeURIComponent(styles.category)}`}
            track={{ event: "category_crosslink_styles", properties: { category, styleCategory: styles.category } }}
            className={`${tile} border-border bg-surface text-fg hover:border-primary focus-visible:ring-focus-ring border outline-none focus-visible:ring-2`}
          >
            <span
              className="bg-bg-subtle text-muted rounded-control grid size-11 place-items-center"
              aria-hidden="true"
            >
              <Icon name="box" size={22} />
            </span>
            <span className="min-w-0">
              <b className="block text-[1.0625rem] font-semibold">
                {t("custom.styles", { category: categoryName, count: styles.count })}
              </b>
              <span className="text-muted text-sm">{t("custom.stylesBody")}</span>
            </span>
            <span className="border-border-strong rounded-cta inline-flex h-10 items-center justify-center border px-4 text-sm font-semibold whitespace-nowrap">
              {t("custom.stylesCta")}
            </span>
          </TrackedLink>
        ) : null}
        {quote ? (
          // Project A: the pale brand tint marks the way out, not a dark block; the green is the link.
          <div className={`${tile} bg-primary-subtle text-fg`}>
            <span
              className="rounded-control bg-surface text-primary grid size-11 place-items-center"
              aria-hidden="true"
            >
              <Icon name="chat" size={22} />
            </span>
            <span className="min-w-0">
              <b className="block text-[1.0625rem] font-semibold">{tCatalog("category.rfqTitle")}</b>
              <span className="text-muted text-sm">{tCatalog("category.rfqBody")}</span>
            </span>
            <Link
              href={rfqHref(category)}
              className="bg-primary text-primary-fg hover:bg-primary-hover rounded-cta focus-visible:ring-focus-ring inline-flex h-10 items-center justify-center px-4 text-sm font-semibold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              {tCatalog("category.rfqCta")}
            </Link>
          </div>
        ) : null}
      </div>
    </HubSection>
  );
}

/** The category FAQ (item 8): approved questions only, in two columns; the page adds its FAQPage JSON-LD. */
export async function CategoryFaq({
  title,
  items,
}: {
  title: string;
  items: readonly { question: string; answer: string }[];
}) {
  if (items.length === 0) return null;
  const list = items.map((item, index) => ({ id: `cat-faq-${index}`, summary: item.question, content: item.answer }));
  const half = Math.ceil(list.length / 2);
  return (
    <HubSection id="faq" title={title}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-x-8">
        <DisclosureList items={list.slice(0, half)} headingLevel="h3" />
        <DisclosureList items={list.slice(half)} headingLevel="h3" />
      </div>
    </HubSection>
  );
}
