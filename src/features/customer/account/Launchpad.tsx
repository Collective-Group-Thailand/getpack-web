import { getLocale, getTranslations } from "next-intl/server";

import { pick } from "@/features/customer/catalog/localize";
import { studioHref } from "@/features/customer/studio/paths";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Icon, type IconName } from "@/ui/icons";

import { DesignThumb } from "./DesignThumb";
import { stepHref } from "./launchpad-paths";

type Launchpad = Schemas["LaunchpadDto"];

const STEP_ICON: Record<Schemas["LaunchpadNextStep"], IconName> = {
  pay: "wallet",
  approve_proof: "stamp",
  upload_artwork: "upload",
  confirm_receipt: "package",
  reorder: "refresh",
  resume_design: "edit",
  start_configuration: "sparkles",
};

/**
 * The signed-in home's launchpad (U5.1 §4, D-297): the one recommended next step, in the API's
 * order (pay → approve proof → upload artwork → confirm receipt → due reorder → resume a design →
 * start a configuration), then the designs to continue and the products to order again. Every
 * choice is the API's; this only draws it.
 */
export async function LaunchpadPanel({ launchpad, hasBrandKit }: { launchpad: Launchpad; hasBrandKit: boolean }) {
  const [t, locale, format] = await Promise.all([getTranslations("account.launchpad"), getLocale(), getFormat()]);
  const step = launchpad.nextStep;
  const item = launchpad.needsAction.find((row) => row.id === step.targetId);
  const design = launchpad.designs.find((row) => row.id === step.targetId);

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="launchpad-next"
        className="border-primary/30 bg-primary-subtle flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <span className="bg-surface text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
            <Icon name={STEP_ICON[step.kind]} size={20} />
          </span>
          <div>
            <p className="text-muted text-xs font-medium tracking-wide uppercase">{t("nextLabel")}</p>
            <h2 id="launchpad-next" className="text-lg font-semibold">
              {t(`next.${step.kind}.title`, { code: item?.code ?? "", name: design?.title ?? "" })}
            </h2>
            <p className="text-muted text-sm">
              {item?.amount ? t("next.amount", { amount: format.thb(item.amount) }) : t(`next.${step.kind}.body`)}
              {item?.dueAt ? ` · ${t("due", { date: format.date(item.dueAt) })}` : ""}
            </p>
          </div>
        </div>
        <Button asChild className="shrink-0">
          <Link href={stepHref(step, launchpad)}>{t(`next.${step.kind}.action`)}</Link>
        </Button>
      </section>

      {launchpad.designs.length > 0 ? (
        <section aria-labelledby="launchpad-designs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="launchpad-designs" className="text-lg font-semibold">
              {t("designs")}
            </h2>
            <Link href="/account/designs" className="text-primary text-sm underline-offset-4 hover:underline">
              {t("allDesigns")}
            </Link>
          </div>
          {hasBrandKit ? <p className="text-muted mt-1 text-sm">{t("brandKit")}</p> : null}
          <ul className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2">
            {launchpad.designs.map((row) => (
              <li key={row.id} className="w-44 shrink-0 snap-start">
                <Link
                  href={studioHref({ designId: row.id })}
                  className="bg-surface border-border hover:border-primary focus-visible:outline-primary flex flex-col overflow-hidden rounded-xl border transition"
                >
                  <span className="bg-surface-subtle block aspect-[4/3] p-2">
                    <DesignThumb fileId={row.thumbnailFileId} empty={t("noThumbnail")} />
                  </span>
                  <span className="flex flex-col gap-0.5 p-3">
                    <span className="truncate text-sm font-medium">{row.title}</span>
                    <span className="text-muted truncate text-xs">
                      {pick(locale, row.catalogProductNameTh, row.catalogProductNameEn)}
                    </span>
                    {row.lockedByOrderCode ? (
                      <Badge size="sm" tone="info" className="mt-1 self-start">
                        {t("locked", { order: row.lockedByOrderCode })}
                      </Badge>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {launchpad.reorderCandidates.length > 0 ? (
        <section aria-labelledby="launchpad-reorder">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="launchpad-reorder" className="text-lg font-semibold">
              {t("reorder")}
            </h2>
            <Link href="/account/replenishment" className="text-primary text-sm underline-offset-4 hover:underline">
              {t("allReorder")}
            </Link>
          </div>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {launchpad.reorderCandidates.map((row) => (
              <li
                key={`${row.orderId}-${row.suggestionId ?? "order"}`}
                className="bg-surface border-border flex flex-col gap-2 rounded-xl border p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{pick(locale, row.productType.nameTh, row.productType.nameEn)}</p>
                  {row.due ? (
                    <Badge tone="warning" icon="clock">
                      {t("dueNow")}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-muted text-sm">
                  {t("lastOrder", { code: row.orderCode, quantity: format.number(row.quantity) })}
                  {row.suggestedQuantity !== null && row.suggestedOn
                    ? ` · ${t("suggested", { quantity: format.number(row.suggestedQuantity), date: format.date(row.suggestedOn) })}`
                    : ""}
                </p>
                <Button asChild size="sm" variant="secondary" className="self-start" iconStart="refresh">
                  <Link href={`/account/orders/${row.orderId}/reorder`}>{t("reorderAction")}</Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
