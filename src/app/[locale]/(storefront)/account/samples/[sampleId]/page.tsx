import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getMySample } from "@/features/customer/samples/api.server";
import { SampleView } from "@/features/customer/samples/SampleView";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { SAMPLE_KIND, SAMPLE_STATUS } from "@/domain/status";
import type { SampleStatus } from "@/domain/status/contract";
import { Link } from "@/i18n/navigation";
import { ProgressTracker, type ProgressState } from "@/ui/components/ProgressTracker";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("myOrders.samples");
  return { title: t("detailTitle"), robots: { index: false, follow: false } };
}

/** The sample's arc, first-class (U2.F3): asked → quoted → paid → made → shipped → delivered → decided. */
const ARC: SampleStatus[] = ["requested", "quoted", "paid", "in_production", "shipped", "delivered", "approved"];
const OFF_ARC: Partial<Record<SampleStatus, SampleStatus>> = {
  changes_requested: "approved",
  rejected: "approved",
};

export default async function Page({ params }: { params: Promise<{ sampleId: string }> }) {
  await requireCustomer();
  const { sampleId } = await params;
  const [t, tStatus, format, sample] = await Promise.all([
    getTranslations("myOrders.samples"),
    getTranslations("status"),
    getFormat(),
    getMySample(sampleId),
  ]);
  if (!sample) notFound();
  const at = ARC.indexOf(OFF_ARC[sample.status] ?? sample.status);
  const stages = ARC.map((status, i) => ({
    key: status,
    title:
      i === ARC.length - 1 && OFF_ARC[sample.status]
        ? tStatus(SAMPLE_STATUS[sample.status].labelKey)
        : tStatus(SAMPLE_STATUS[status].labelKey),
    state: (at < 0
      ? "upcoming"
      : i < at
        ? "done"
        : i === at
          ? i === ARC.length - 1
            ? "done"
            : "current"
          : "upcoming") as ProgressState,
  }));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link href="/account/samples" className="text-primary text-sm underline-offset-4 hover:underline">
          {t("back")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{t("detailTitle")}</h1>
          <StatusChip map={SAMPLE_STATUS} value={sample.status} size="md" />
          <StatusChip map={SAMPLE_KIND} value={sample.kind} />
        </div>
        <p className="text-muted text-sm">
          {t("asked", { date: format.date(sample.createdAt) })}
          {sample.orderId && sample.orderCode ? (
            <>
              {" · "}
              <Link href={`/account/orders/${sample.orderId}`} className="text-primary underline underline-offset-4">
                {t("forOrder", { code: sample.orderCode })}
              </Link>
            </>
          ) : null}
        </p>
        {sample.kind === "attached" && sample.status !== "approved" ? (
          <p className="text-sm">{t("attachedHold")}</p>
        ) : null}
      </header>
      {sample.status === "cancelled" || sample.status === "expired" ? null : (
        <ProgressTracker
          label={t("arc")}
          stages={stages}
          stateLabels={{
            done: t("state.done"),
            current: t("state.current"),
            upcoming: t("state.upcoming"),
            skipped: t("state.skipped"),
          }}
        />
      )}
      <SampleView sample={sample} />
    </div>
  );
}
