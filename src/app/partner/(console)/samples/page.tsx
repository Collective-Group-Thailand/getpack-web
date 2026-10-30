import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { SAMPLE_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection, PartnerStats } from "@/features/partner/frame";
import { PartnerTable } from "@/features/partner/table";
import { SampleEvidence } from "@/features/partner/samples/SampleEvidence";
import { StatusChip } from "@/features/partner/status";
import { getFormat } from "@/features/shared/format/server";
import { Button } from "@/ui/components/Button";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerJobs.samples"))("title") };
}

/**
 * The factory's sample jobs (U2.F3, `partner.samples.list`): what to make — no customer, no price
 * (D-142, D-050) — and, before each ships, its evidence: measured size, material used and photos.
 */
export default async function SamplesPage() {
  const [t, tEvidence, format, context, tQueue, tTable, tNav] = await Promise.all([
    getTranslations("partnerJobs.samples"),
    getTranslations("common.sampleEvidence"),
    getFormat(),
    factoryContext(),
    getTranslations("partnerJobs.qcQueue"),
    getTranslations("partnerJobs.table"),
    getTranslations("partner.sidebar.items"),
  ]);
  const { contract } = await partnerServerApis();
  const list = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/samples", {
          params: { path: { factoryId: context.factoryId } },
        })
      ).data!,
  );
  const rows = list.data?.data ?? [];
  const toRecord = rows.filter((s) => !s.evidence.recordedAt && ["paid", "in_production"].includes(s.status));
  const others = rows.filter((s) => !toRecord.includes(s));

  const sizeOf = (config: Record<string, unknown>) =>
    [config.l, config.w, config.d]
      .filter((n) => typeof n === "number")
      .map((n) => format.number(n as number))
      .join(" × ") || "—";

  return (
    <PartnerPage title={t("title")} description={t("body")} wide>
      {list.data ? (
        rows.length ? (
          <>
            <PartnerStats
              label={t("title")}
              items={[
                {
                  key: "record",
                  href: "#samples-record",
                  icon: "package-check",
                  label: tQueue("samples"),
                  value: format.number(toRecord.length),
                  highlight: toRecord.length > 0,
                },
                {
                  key: "others",
                  href: "#samples-done",
                  icon: "box",
                  label: t("others"),
                  value: format.number(others.length),
                },
              ]}
            />
            {toRecord.length ? (
              <PartnerSection id="samples-record" title={tQueue("samples")} description={t("body")}>
                <ul className="flex flex-col gap-4">
                  {toRecord.map((sample) => {
                    const config = sample.configuration as Record<string, unknown>;
                    return (
                      <li key={sample.id}>
                        {/* What to make on the left, the evidence to record on the right — one card per sample. */}
                        <section
                          id={`sample-${sample.id}`}
                          aria-labelledby={`sample-${sample.id}-title`}
                          className="border-border bg-surface rounded-card grid scroll-mt-20 gap-5 border p-4 md:p-5 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-8"
                        >
                          <div className="flex min-w-0 flex-col gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 id={`sample-${sample.id}-title`} className="text-lg font-semibold tabular-nums">
                                {t("job", { job: sample.jobNo ?? "—" })}
                              </h3>
                              <StatusChip map={SAMPLE_STATUS} value={sample.status} />
                            </div>
                            <DescriptionList
                              columns={2}
                              items={[
                                { term: t("kind"), description: t(`mockup.${sample.mockupOption}`) },
                                { term: t("quantity"), description: format.number(sample.quantity) },
                                { term: t("size"), description: sizeOf(config) },
                                ...(typeof config.material === "string"
                                  ? [{ term: t("material"), description: config.material }]
                                  : []),
                              ]}
                            />
                          </div>
                          <div className="border-border flex min-w-0 flex-col gap-3 border-t pt-4 lg:border-s lg:border-t-0 lg:ps-8 lg:pt-0">
                            <h4 className="font-semibold">{t("recordTitle")}</h4>
                            <SampleEvidence sampleId={sample.id} flat={typeof config.d !== "number"} />
                          </div>
                        </section>
                      </li>
                    );
                  })}
                </ul>
              </PartnerSection>
            ) : null}
            {others.length ? (
              <PartnerSection id="samples-done" title={t("others")}>
                <PartnerTable
                  caption={t("others")}
                  rows={others}
                  rowKey={(sample) => sample.id}
                  columns={[
                    {
                      key: "job",
                      header: tTable("no"),
                      primary: true,
                      cell: (sample) => <span className="tabular-nums">{sample.jobNo ?? "—"}</span>,
                    },
                    { key: "kind", header: t("kind"), cell: (sample) => t(`mockup.${sample.mockupOption}`) },
                    {
                      key: "quantity",
                      header: t("quantity"),
                      align: "end",
                      cell: (sample) => format.number(sample.quantity),
                    },
                    {
                      key: "size",
                      header: t("size"),
                      cell: (sample) => sizeOf(sample.configuration as Record<string, unknown>),
                    },
                    {
                      key: "evidence",
                      header: t("recordTitle"),
                      cell: (sample) =>
                        sample.evidence.recordedAt ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Icon name="check" size={16} className="text-success shrink-0" aria-hidden="true" />
                            {tEvidence("recorded")}
                          </span>
                        ) : (
                          "—"
                        ),
                    },
                    {
                      key: "status",
                      header: tTable("status"),
                      cell: (sample) => <StatusChip map={SAMPLE_STATUS} value={sample.status} />,
                      className: "whitespace-nowrap",
                    },
                  ]}
                />
              </PartnerSection>
            ) : null}
          </>
        ) : (
          <EmptyState
            icon="package-check"
            title={t("empty")}
            description={t("emptyBody")}
            action={
              <Button asChild variant="secondary" size="nav" iconEnd="arrow-right">
                <Link href="/jobs">{tNav("jobs")}</Link>
              </Button>
            }
          />
        )
      ) : (
        <PageError error={list.error} />
      )}
    </PartnerPage>
  );
}
