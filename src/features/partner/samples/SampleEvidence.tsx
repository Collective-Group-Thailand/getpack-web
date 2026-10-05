"use client";

import { useTranslations } from "next-intl";

import { useRefresh } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { problemMessage } from "@/features/shared/actions";
import { EvidenceForm } from "@/features/shared/samples/EvidenceForm";
import { browserApi } from "@/lib/api/browser";
import { toast } from "@/ui/components/Toast";

/** The factory records a sample's evidence before it ships (U2.F3, D-255): Owner, Planner or QC. */
export function SampleEvidence({ sampleId, flat }: { sampleId: string; flat: boolean }) {
  const t = useTranslations("partnerJobs.samples");
  const tEvidence = useTranslations("common.sampleEvidence");
  const { factoryId, can } = useFactory();
  const [refresh] = useRefresh();
  if (!can("factory_samples.record_evidence")) return <p className="text-muted text-sm">{t("noRight")}</p>;
  return (
    <EvidenceForm
      zone="partner"
      factoryId={factoryId}
      flat={flat}
      onSubmit={async (body) => {
        try {
          await browserApi().POST("/v1/partner/factories/{factoryId}/samples/{sampleId}/evidence", {
            params: { path: { factoryId, sampleId } },
            body,
          });
          toast.success(tEvidence("recorded"));
          refresh();
        } catch (error) {
          toast.error(problemMessage(error, t("failed")));
        }
      }}
    />
  );
}
