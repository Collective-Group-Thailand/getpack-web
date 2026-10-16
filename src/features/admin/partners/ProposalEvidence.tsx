"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage, QueryError, useCan } from "../console";
import { useFileDownload } from "../logistics/files";

/**
 * What the factory attached to support its proposal (D-040, D-042): supplier quotations, index
 * prints — each with its note, opened through the files API.
 */
export function ProposalEvidence({ proposalId }: { proposalId: string }) {
  const t = useTranslations("partners.proposalEvidence");
  const format = useFormat();
  const file = useFileDownload();
  const canReview = useCan("price_proposals.review");
  const evidence = useQuery({
    enabled: canReview,
    queryKey: queryKeys.related("admin", "price_proposal", proposalId, "evidence"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/price-proposals/{proposalId}/evidence", {
          params: { path: { proposalId } },
        })
      ).data!,
  });
  if (!canReview) return null;
  if (evidence.isError) return <QueryError error={evidence.error} onRetry={() => void evidence.refetch()} />;
  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      {evidence.data?.length === 0 ? <p className="text-muted text-sm">{t("none")}</p> : null}
      <ul className="divide-border flex flex-col divide-y text-sm">
        {(evidence.data ?? []).map((item) => (
          <li key={item.fileId} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <Button
                size="sm"
                variant="link"
                iconStart="paperclip"
                className="h-auto p-0"
                loading={file.isPending && file.variables === item.fileId}
                onClick={() => file.mutate(item.fileId)}
              >
                {item.fileName}
              </Button>
              {item.note ? <p className="text-muted text-xs">{item.note}</p> : null}
            </div>
            <span className="text-muted text-xs">
              {item.addedBy ? `${item.addedBy.displayName} · ` : ""}
              <When at={item.addedAt} />
            </span>
          </li>
        ))}
      </ul>
      {evidence.data?.length ? (
        <p className="text-muted mt-2 text-xs">{t("count", { count: format.number(evidence.data.length) })}</p>
      ) : null}
    </Card>
  );
}

/** Suggestions are computed when a proposal is submitted; after new index values or peer versions, recompute them (D-040, D-044). */
export function RecomputeSuggestions({ proposalId }: { proposalId: string }) {
  const t = useTranslations("partners.proposalEvidence");
  const queryClient = useQueryClient();
  const canSuggest = useCan("price_suggestions.read");
  const recompute = useMutation({
    mutationFn: async () =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/price-proposals/{proposalId}/suggestions/actions/recompute", {
          params: { path: { proposalId } },
        })
      ).data!,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.related("admin", "price_proposal", proposalId, "suggestions"), data);
      toast.success(t("recomputed"));
    },
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });
  if (!canSuggest) return null;
  return (
    <Button
      size="sm"
      variant="ghost"
      iconStart="refresh"
      loading={recompute.isPending}
      onClick={() => recompute.mutate()}
    >
      {t("recompute")}
    </Button>
  );
}
