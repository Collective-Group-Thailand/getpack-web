import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SAMPLE_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { SampleEvidence } from "@/features/partner/samples/SampleEvidence";
import { StatusChip } from "@/features/partner/status";
import { getFormat } from "@/features/shared/format/server";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerJobs.samples"))("title") };
}

/**
 * The factory's sample jobs (U2.F3, `partner.samples.list`): what to make — no customer, no price
 * (D-142, D-050) — and, before each ships, its evidence: measured size, material used and photos.
 */
export default async function SamplesPage() {
  const [t, tEvidence, format, context] = await Promise.all([
    getTranslations("partnerJobs.samples"),
    getTranslations("common.sampleEvidence"),
    getFormat(),
    factoryContext(),
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

  return (
    <PartnerPage title={t("title")} description={t("body")}>
      {list.data ? (
        rows.length ? (
          <div className="flex flex-col gap-6">
            {toRecord.map((sample) => {
              const config = sample.configuration as Record<string, unknown>;
              return (
                <section
                  key={sample.id}
                  aria-labelledby={`sample-${sample.id}`}
                  className="border-border flex flex-col gap-3 rounded-xl border p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id={`sample-${sample.id}`} className="font-semibold">
                      {t("job", { job: sample.jobNo ?? "—" })}
                    </h2>
                    <StatusChip map={SAMPLE_STATUS} value={sample.status} />
                  </div>
                  <DescriptionList
                    columns={2}
                    items={[
                      { term: t("kind"), description: t(`mockup.${sample.mockupOption}`) },
                      { term: t("quantity"), description: format.number(sample.quantity) },
                      {
                        term: t("size"),
                        description:
                          [config.l, config.w, config.d]
                            .filter((n) => typeof n === "number")
                            .map((n) => format.number(n as number))
                            .join(" × ") || "—",
                      },
                      ...(typeof config.material === "string"
                        ? [{ term: t("material"), description: config.material }]
                        : []),
                    ]}
                  />
                  <h3 className="text-sm font-semibold">{t("recordTitle")}</h3>
                  <SampleEvidence sampleId={sample.id} flat={typeof config.d !== "number"} />
                </section>
              );
            })}
            {others.length ? (
              <section aria-labelledby="samples-done" className="flex flex-col gap-2">
                <h2 id="samples-done" className="font-semibold">
                  {t("others")}
                </h2>
                <ul className="flex flex-col gap-2">
                  {others.map((sample) => (
                    <li
                      key={sample.id}
                      className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                    >
                      <span>{t("job", { job: sample.jobNo ?? "—" })}</span>
                      <span className="flex items-center gap-2">
                        {sample.evidence.recordedAt ? (
                          <span className="text-muted">{tEvidence("recorded")}</span>
                        ) : null}
                        <StatusChip map={SAMPLE_STATUS} value={sample.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : (
          <EmptyState icon="package-check" title={t("empty")} description={t("emptyBody")} />
        )
      ) : (
        <PageError error={list.error} />
      )}
    </PartnerPage>
  );
}
