import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ERP_OPERATION_STATUS, ERP_PRODUCTION_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatPlain, formatQty } from "@/features/partner/erp/format";
import { MoActions, OperationButtons, ReturnMaterial } from "@/features/partner/erp/MoActions";
import { PostedEntries } from "@/features/partner/ledger/PostedEntries";
import { ActionPanel, PageError, PartnerDetail, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { SummaryRows } from "@/features/partner/form-layout";
import { RelatedDocuments } from "@/features/partner/ops/RelatedDocuments";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { Meter } from "@/ui/components/Meter";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerFactory.planning"))("title") };
}

/**
 * One production order (D-340, D-341): where it comes from, its materials — required, held, issued, short —
 * its steps on the floor, and what it cost in materials.
 */
export default async function ProductionOrderPage({ params }: { params: Promise<{ moId: string }> }) {
  const [{ moId }, t, tCommon, format, locale, context] = await Promise.all([
    params,
    getTranslations("partnerFactory.planning"),
    getTranslations("partnerErp.common"),
    getFormat(),
    getLocale(),
    factoryContext(),
  ]);
  const [tOps, tKiosk, tSales] = await Promise.all([
    getTranslations("partnerOps.shared"),
    getTranslations("partnerOps.kiosk"),
    getTranslations("partnerSales.common"),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/production-orders/{moId}", {
          params: { path: { factoryId: context.factoryId, moId } },
        })
      ).data!,
  );
  const back = { href: "/planning", label: t("title") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const mo = read.data;
  const unit = (code: string) => tCommon(`units.${code}` as never);
  const qty = (value: string, code: string) => tCommon("inUnit", { qty: formatQty(value, locale), unit: unit(code) });
  const running = mo.status === "released" || mo.status === "in_progress";
  const canRecord = canAt(context, "factory_production.record") && running;
  const canReturn = mo.nextActions.some((a) => a.key === "erp_mo.return");

  const ordinal = (n: number) => `${n}. `;
  const progress = `${formatPlain(mo.progressPct, locale, 0)}%`;
  const nowId = [...mo.operations]
    .sort((a, b) => a.seq - b.seq)
    .find((op) => op.status !== "done" && op.status !== "skipped")?.id;
  return (
    <PartnerPage
      full
      title={`${mo.moNo} · ${mo.title}`}
      back={back}
      meta={
        <>
          <StatusChip map={ERP_PRODUCTION_STATUS} value={mo.status} />
          <Badge tone="neutral">{t(`sources.${mo.source}` as never)}</Badge>
          {mo.late ? <Badge tone="danger">{t("late")}</Badge> : null}
          {mo.short ? <Badge tone="warning">{t("short")}</Badge> : null}
        </>
      }
    >
      {/* The order on the left; what it adds up to and the one thing to do next in a panel that stays in view. */}
      <PartnerDetail
        aside={
          <ActionPanel id="mo-next" tone="neutral" title={tSales("nextSteps")}>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted">{t("table.progress")}</span>
                <span className="font-semibold tabular-nums">{progress}</span>
              </div>
              <Meter
                value={Number(mo.progressPct) || 0}
                label={t("table.progress")}
                valueText={progress}
                tone={mo.late ? "danger" : "primary"}
              />
            </div>
            <SummaryRows
              rows={[
                { key: "qty", label: t("table.quantity"), value: qty(mo.quantity, mo.unit) },
                { key: "due", label: t("table.due"), value: format.date(mo.dueOn) },
                { key: "cost", label: t("detail.materialCost"), value: format.thb(mo.materialCost) },
              ]}
            />
            <MoActions order={mo} locale={locale} layout="panel" />
          </ActionPanel>
        }
      >
        <section aria-label={t("detail.product")} className="rounded-card border-border bg-surface border p-4 sm:p-5">
          <DescriptionList
            columns={2}
            items={[
              {
                term: t("detail.product"),
                description: mo.item ? (
                  <Link href={`/stock/items/${mo.item.id}`} className="underline-offset-4 hover:underline">
                    {mo.item.name}
                  </Link>
                ) : (
                  t("detail.getpackProduct")
                ),
              },
              {
                term: t("detail.job"),
                description: mo.job ? (
                  <Link href={`/jobs/${mo.job.id}`} className="tabular-nums underline-offset-4 hover:underline">
                    {mo.job.code}
                  </Link>
                ) : (
                  "—"
                ),
              },
              {
                term: t("detail.recipe"),
                description: mo.recipe ? (
                  <Link href={`/planning/recipes/${mo.recipe.id}`} className="underline-offset-4 hover:underline">
                    {mo.recipe.name}
                  </Link>
                ) : (
                  "—"
                ),
              },
              { term: t("detail.start"), description: format.date(mo.plannedStartOn) },
              { term: t("detail.priority"), description: mo.priority },
              { term: tCommon("warehouse"), description: mo.warehouse.name },
              ...(mo.status === "completed"
                ? [
                    { term: t("detail.good"), description: qty(mo.goodQty, mo.unit) },
                    { term: t("detail.scrap"), description: qty(mo.scrapQty, mo.unit) },
                    { term: t("detail.unitCost"), description: mo.unitCost ? format.thb(mo.unitCost) : "—" },
                  ]
                : []),
              ...(mo.note ? [{ term: t("detail.note"), description: mo.note }] : []),
              ...(mo.cancelReason ? [{ term: t("detail.cancelReason"), description: mo.cancelReason }] : []),
            ]}
          />
        </section>

        <PartnerSection title={t("detail.materials")} description={t("detail.materialsBody")}>
          <PartnerTable
            caption={t("detail.materials")}
            rows={mo.materials}
            rowKey={(m) => m.id}
            rowTone={(m) => (running && m.shortQty !== "0.000" ? "warning" : undefined)}
            empty={<EmptyState icon="package" title={t("detail.noMaterials")} />}
            columns={[
              {
                key: "item",
                header: tCommon("item"),
                primary: true,
                cell: (m) => (
                  <span className="flex flex-col">
                    <Link href={`/stock/items/${m.item.id}`} className="underline-offset-4 hover:underline">
                      {m.item.name}
                    </Link>
                    <span className="text-muted text-sm">{t(`origins.${m.origin}` as never)}</span>
                  </span>
                ),
              },
              {
                key: "required",
                header: t("detail.required"),
                align: "end",
                cell: (m) => qty(m.requiredQty, m.item.baseUnit),
              },
              {
                key: "reserved",
                header: t("detail.reserved"),
                align: "end",
                hideOnPhone: true,
                cell: (m) => qty(m.reservedQty, m.item.baseUnit),
              },
              {
                key: "issued",
                header: t("detail.issued"),
                align: "end",
                cell: (m) => qty(m.issuedQty, m.item.baseUnit),
              },
              {
                key: "short",
                header: t("detail.shortQty"),
                align: "end",
                cell: (m) =>
                  m.shortQty === "0.000" ? (
                    "—"
                  ) : (
                    <span className="text-danger font-semibold">{qty(m.shortQty, m.item.baseUnit)}</span>
                  ),
              },
            ]}
          />
          {canReturn ? (
            <details className="border-border bg-surface rounded-xl border p-4">
              <summary className="cursor-pointer font-semibold">{t("detail.returnTitle")}</summary>
              <div className="mt-3">
                <ReturnMaterial order={mo} locale={locale} />
              </div>
            </details>
          ) : null}
        </PartnerSection>

        <PartnerSection title={t("detail.operations")}>
          {mo.operations.length ? (
            <ol className="border-border bg-surface divide-border divide-y overflow-hidden rounded-xl border">
              {mo.operations.map((op) => (
                <li
                  key={op.id}
                  aria-current={op.id === nowId ? "step" : undefined}
                  className="flex flex-col gap-3 px-4 py-3.5"
                >
                  <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto]">
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-9 items-center justify-center rounded-full border text-sm font-semibold tabular-nums",
                        op.status === "done"
                          ? "bg-primary border-primary text-primary-fg"
                          : op.id === nowId
                            ? "border-primary bg-primary-subtle text-primary-subtle-fg"
                            : "border-border text-muted bg-surface",
                      )}
                    >
                      {op.status === "done" ? <Icon name="check" size={16} /> : op.seq}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold [overflow-wrap:anywhere] break-keep">
                        <span className="sr-only">{ordinal(op.seq)}</span>
                        {op.name}
                      </p>
                      <p className="text-muted text-sm">
                        {op.machine?.name ?? t("detail.anyMachine")}
                        {op.plannedMinutes > 0 ? ` · ${t("detail.minutes", { n: op.plannedMinutes })}` : ""}
                        {op.status === "done"
                          ? ` · ${t("detail.output", { good: formatQty(op.goodQty, locale), scrap: formatQty(op.scrapQty, locale) })}`
                          : ""}
                      </p>
                      {op.scheduledStart && op.scheduledEnd ? (
                        <p className="text-muted text-sm">
                          <Link href="/planning/schedule" className="underline-offset-4 hover:underline">
                            {tKiosk("planned", {
                              from: format.dateTime(op.scheduledStart),
                              to: format.dateTime(op.scheduledEnd),
                            })}
                          </Link>
                          {op.pausedMinutes > 0 ? ` · ${tOps("pausedMinutes", { n: op.pausedMinutes })}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <span className="col-start-2 flex flex-wrap items-center gap-1 sm:col-start-3 sm:justify-end">
                      {op.milestone ? <Badge tone="info">{tOps("getpackStep")}</Badge> : null}
                      <StatusChip map={ERP_OPERATION_STATUS} value={op.status} />
                    </span>
                  </div>
                  {canRecord || (op.milestoneSync === "failed" && (op.status === "done" || op.status === "skipped")) ? (
                    // The step to work on now shows its buttons; a later one keeps them folded (out of order is possible, not invited).
                    op.id === nowId ||
                    op.status === "done" ||
                    op.status === "skipped" ||
                    op.status === "in_progress" ||
                    op.status === "paused" ? (
                      <OperationButtons
                        orderId={mo.id}
                        operation={op}
                        unit={unit(mo.unit)}
                        defaultGood={mo.quantity}
                        jobHref={mo.job ? `/jobs/${mo.job.id}` : undefined}
                      />
                    ) : (
                      <details className="text-sm">
                        <summary className="text-muted cursor-pointer select-none">{t("detail.outOfOrder")}</summary>
                        <div className="mt-2">
                          <OperationButtons
                            orderId={mo.id}
                            operation={op}
                            unit={unit(mo.unit)}
                            defaultGood={mo.quantity}
                            jobHref={mo.job ? `/jobs/${mo.job.id}` : undefined}
                          />
                        </div>
                      </details>
                    )
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState icon="checklist" title={t("detail.noOperations")} />
          )}
        </PartnerSection>

        <RelatedDocuments type="production_order" id={mo.id} label={mo.moNo} />
        <PostedEntries sourceId={mo.id} />
      </PartnerDetail>
    </PartnerPage>
  );
}
