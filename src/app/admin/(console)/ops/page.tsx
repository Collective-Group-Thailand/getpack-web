import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { adminServerApis } from "@/features/admin/console/api.server";
import { OpsSignals, type OpsSignal } from "@/features/admin/platform/OpsSignals";
import { isApiError } from "@/lib/api/server";
import { ErrorState } from "@/ui/components/ErrorState";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("platform.ops"))("title") };
}

/** The `ops` menu entry packio-api returns to holders of `ops.read` (B6.3). */
export default async function OpsPage() {
  const [t, tErrors] = await Promise.all([getTranslations("platform.ops"), getTranslations("common.errors")]);
  const result = await loadSignals();

  return (
    <ConsolePage>
      <PageHeader title={t("title")} description={t("description")} />
      {"signals" in result ? (
        <OpsSignals signals={result.signals} />
      ) : (
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedBody")}
          code={result.requestId}
          codeLabels={{
            label: tErrors("reference"),
            copy: tErrors("copyReference"),
            copied: tErrors("referenceCopied"),
          }}
        />
      )}
    </ConsolePage>
  );
}

async function loadSignals(): Promise<{ signals: OpsSignal[] } | { requestId?: string }> {
  try {
    const { data } = await (await adminServerApis()).contract.GET("/v1/admin/ops/signals");
    return { signals: data ?? [] };
  } catch (error) {
    return { requestId: isApiError(error) ? error.requestId || undefined : undefined };
  }
}
