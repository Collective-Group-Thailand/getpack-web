import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getMySample } from "@/features/customer/samples/api.server";
import { SampleView } from "@/features/customer/samples/SampleView";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { SAMPLE_KIND, SAMPLE_STATUS } from "@/domain/status";
import type { SampleStatus } from "@/domain/status/contract";
import { Link } from "@/i18n/navigation";
import { Callout } from "@/ui/components/Callout";
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
    <div className="flex flex-col gap-6">
      <AccountHeader
        back={{ href: "/account/samples", label: t("back") }}
        title={t("detailTitle")}
        status={
          <>
            <StatusChip map={SAMPLE_STATUS} value={sample.status} size="md" />
            <StatusChip map={SAMPLE_KIND} value={sample.kind} />
          </>
        }
        lede={
          <>
            {t("asked", { date: format.date(sample.createdAt) })}
            {sample.orderId && sample.orderCode ? (
              <>
                {" · "}
                <Link href={`/account/orders/${sample.orderId}`} className="text-primary underline underline-offset-4">
                  {t("forOrder", { code: sample.orderCode })}
                </Link>
              </>
            ) : null}
          </>
        }
      />
      {sample.kind === "attached" && sample.status !== "approved" ? (
        <Callout tone="info">{t("attachedHold")}</Callout>
      ) : null}
      {sample.status === "cancelled" || sample.status === "expired" ? null : (
        <div className="border-border bg-surface rounded-card border p-4 sm:p-5">
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
        </div>
      )}
      <SampleView sample={sample} />
    </div>
  );
}
