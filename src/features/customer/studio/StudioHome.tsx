import { getTranslations } from "next-intl/server";

import { DesignThumb } from "@/features/customer/account/DesignThumb";
import type { StyleCard } from "@/features/customer/catalog/api.server";
import type { MyDesign } from "@/features/customer/designer/api.server";
import { DielineGlyph } from "@/features/customer/home/DielineGlyph";
import { HOME_WRAP, TemplateCard } from "@/features/customer/home/parts";
import { styleDieline } from "@/features/customer/home/style-dielines.server";
import { facetLabel, type StylesT } from "@/features/customer/styles/labels";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/lib/cn";

const UNDERLINE = "border-b border-current pb-px font-medium";

/**
 * Packio Studio's front door, to the V4 "StudioStart" board (Phase 4 §4.4): the question, four
 * ways in — choose a template · I have the product · I have a file · reorder — each with its own
 * picture, the templates people start from most (the style library's own "popular" order) and the
 * customer's latest designs with where each stands. A server page: nothing here needs a script.
 */
export async function StudioHome({
  signedIn,
  popular,
  templateCount,
  designs,
  designTotal,
  locale,
}: {
  signedIn: boolean;
  popular: StyleCard[];
  templateCount: number | null;
  designs: MyDesign[];
  designTotal: number;
  locale: string;
}) {
  const [t, tStyles, format] = await Promise.all([
    getTranslations("studio.home"),
    getTranslations("styles"),
    getFormat(),
  ]);
  const words = tStyles as unknown as StylesT;
  const reorderHref = signedIn ? "/account/orders" : `/sign-in?returnTo=${encodeURIComponent("/account/orders")}`;

  const paths = [
    {
      key: "box",
      href: "/studio/templates",
      body: templateCount ? t("paths.box.body", { count: templateCount }) : t("paths.box.bodyNoCount"),
      picture: <DielineGlyph family="tuck" className="h-20 w-28" />,
      lead: true,
    },
    {
      key: "product",
      href: "/studio/new?start=product",
      body: t("paths.product.body"),
      picture: <ProductSizePicture />,
      tint: true,
    },
    { key: "file", href: "/studio/upload", body: t("paths.file.body"), picture: <FilePicture /> },
    { key: "reorder", href: reorderHref, body: t("paths.reorder.body"), picture: <ReorderPicture />, tint: true },
  ] as const;

  const statusOf = (design: MyDesign) =>
    design.orders[0]
      ? t("status.ordered", { code: design.orders[0].orderCode })
      : design.lengthMm === null || design.widthMm === null
        ? t("status.size")
        : t("status.ready");
  // "มีรายการควรตรวจ" only when the API says so: `hasIssues` is requested (store.designs.list,
  // with `issueCount`) and read here only once a response carries it — no line otherwise.
  const flagged = (design: MyDesign) => (design as unknown as Record<string, unknown>).hasIssues === true;

  return (
    <div className={cn(HOME_WRAP, "pt-10 pb-20 md:pt-14")}>
      <div className="grid items-end gap-6 lg:grid-cols-[7fr_5fr] lg:gap-12">
        <div>
          <h1 className="text-[2.125rem] leading-[1.1] md:text-[3.25rem]">{t("title")}</h1>
          <p className="text-muted mt-4 max-w-[34em] text-[1.0625rem]">{signedIn ? t("lead") : t("leadGuest")}</p>
        </div>
        <p className="text-muted max-w-[26em] text-[13px] lg:mb-1.5">
          {t.rich("unsure", {
            suggest: (chunks) => (
              <Link href="/studio/new?start=product" className={cn("text-fg", UNDERLINE)}>
                {chunks}
              </Link>
            ),
            chat: (chunks) => (
              <Link href="/help/chat" className={cn("text-fg", UNDERLINE)}>
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>

      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {paths.map((path) => (
          <li key={path.key}>
            <Link
              href={path.href}
              // A card that looks pressable — a surface with a hairline that darkens on hover,
              // the lead path with the brand hairline — rather than a bare rule over text that
              // read as a column heading (owner walkthrough 2026-10-14).
              className={cn(
                "group bg-surface rounded-card duration-base ease-standard flex h-full flex-col gap-3 border p-5 transition-colors outline-none",
                "hover:border-primary focus-visible:border-primary",
                "lead" in path && path.lead ? "border-primary" : "border-border",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid h-30 place-items-center overflow-hidden rounded-xl",
                  "tint" in path && path.tint ? "bg-sage-subtle" : "bg-bg-subtle",
                )}
              >
                {path.picture}
              </span>
              <h2 className="text-xl">{t(`paths.${path.key}.title`)}</h2>
              <p className="text-muted text-[0.90625rem]">{path.body}</p>
              <span className="text-primary mt-auto inline-flex items-center gap-1.5 text-[0.90625rem] font-semibold group-hover:underline group-focus-visible:underline">
                {t(`paths.${path.key}.go`)}
                <span aria-hidden="true">→</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-20 grid items-start gap-12 lg:grid-cols-[7fr_5fr]">
        {popular.length > 0 ? (
          <section aria-labelledby="studio-popular">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <h2 id="studio-popular" className="text-[1.75rem] leading-tight">
                {t("popular")}
              </h2>
              <Link href="/studio/templates" className={cn("text-sm", UNDERLINE)}>
                {templateCount ? t("allTemplates", { count: templateCount }) : t("allTemplatesShort")}
              </Link>
            </div>
            <ul className="grid gap-5 sm:grid-cols-3">
              {popular.map((style) => (
                <TemplateCard
                  key={style.code}
                  style={style}
                  locale={locale}
                  photo={null}
                  narrow
                  dieline={{ card: styleDieline(style.code, "card"), thumb: styleDieline(style.code, "thumb") }}
                  meta={`${facetLabel(words, "category", style.category)} · ${facetLabel(words, "materialClass", style.materialClass)}`}
                />
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="studio-recent">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <h2 id="studio-recent" className="text-[1.75rem] leading-tight">
              {t("recent")}
            </h2>
            {designTotal > designs.length ? (
              <Link href="/account/designs" className={cn("text-sm", UNDERLINE)}>
                {t("recentAll", { count: designTotal })}
              </Link>
            ) : null}
          </div>
          {!signedIn ? (
            <p className="text-muted border-border border-y py-4 text-sm">
              {t.rich("recentGuest", {
                signIn: (chunks) => (
                  <Link
                    href={`/sign-in?returnTo=${encodeURIComponent("/studio")}`}
                    className={cn("text-fg", UNDERLINE)}
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          ) : designs.length === 0 ? (
            <p className="text-muted border-border border-y py-4 text-sm">{t("recentNone")}</p>
          ) : (
            <ul className="border-border border-b">
              {designs.map((design) => (
                <li key={design.id}>
                  <Link
                    href={`/studio/${design.id}`}
                    className="border-border grid grid-cols-[4.5rem_1fr_auto] items-center gap-3.5 border-t py-3.5"
                  >
                    <span className="border-border bg-surface grid h-14 w-18 place-items-center overflow-hidden border">
                      <DesignThumb fileId={design.thumbnailFileId} empty="" />
                    </span>
                    <span className="min-w-0">
                      <b className="block truncate text-[0.90625rem] font-semibold">{design.title}</b>
                      <small className="text-muted mt-0.5 block text-[0.78125rem]">
                        {[
                          t("edited", { when: format.relative(design.updatedAt) }),
                          design.versionNo !== null ? t("version", { n: design.versionNo }) : null,
                          flagged(design) ? t("status.issues") : null,
                          statusOf(design),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </span>
                    <span className={cn("text-[0.84375rem]", UNDERLINE)}>{t("open")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="text-muted mt-4 text-[13px]">{t("help")}</p>
        </section>
      </div>
    </div>
  );
}

/** A box with a ruler along it — "I have the product". */
function ProductSizePicture() {
  return (
    <svg viewBox="0 0 120 80" className="h-20 w-30" aria-hidden="true">
      <path
        d="M30 30 60 18l30 12v26L60 68 30 56z M30 30l30 12 30-12 M60 42v26"
        fill="var(--color-surface)"
        stroke="var(--color-fg)"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <path d="M22 62 52 74" stroke="var(--color-primary)" strokeWidth={1.4} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M${22 + i * 6} ${62 + i * 2.4}l-1.6 3.6`} stroke="var(--color-primary)" strokeWidth={1.2} />
      ))}
    </svg>
  );
}

/** A file with a check — "I have a design file". */
function FilePicture() {
  return (
    <svg viewBox="0 0 120 80" className="h-20 w-30" aria-hidden="true">
      <path
        d="M42 10h26l12 12v48H42z M68 10v12h12"
        fill="var(--color-surface)"
        stroke="var(--color-fg)"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <path d="M49 34h24M49 41h24M49 48h14" stroke="var(--color-border-strong)" strokeWidth={1.2} />
      <circle cx="78" cy="60" r="10" fill="var(--color-primary)" />
      <path
        d="m73.5 60 3 3 6-6"
        fill="none"
        stroke="var(--color-primary-fg)"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Two order rows — "reorder past work". */
function ReorderPicture() {
  return (
    <svg viewBox="0 0 120 80" className="h-20 w-30" aria-hidden="true">
      {[20, 44].map((y, index) => (
        <g key={y} opacity={index === 0 ? 1 : 0.7}>
          <rect
            x="18"
            y={y}
            width="84"
            height="18"
            fill="var(--color-surface)"
            stroke="var(--color-border-strong)"
            strokeWidth={1}
          />
          <path d={`M26 ${y + 9}h34`} stroke="var(--color-fg)" strokeWidth={1.4} />
          <path d={`M78 ${y + 9}h16`} stroke="var(--color-subtle)" strokeWidth={1.4} />
        </g>
      ))}
    </svg>
  );
}
