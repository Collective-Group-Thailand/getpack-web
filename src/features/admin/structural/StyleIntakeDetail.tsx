"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { STYLE_INTAKE_STATUS } from "@/domain/status";
import { When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, FormDialog, problemMessage, QueryError, Section, StatusChip } from "../console";
import { useCan } from "../console/actor";
import { useFileDownload } from "../logistics/files";

type Intake = Schemas["StyleIntakeDto"];

// The style library and the DXF reader load only here, on demand.
const IntakeMatcher = dynamic(() => import("./IntakeMatcher").then((m) => m.IntakeMatcher), {
  ssr: false,
});

const BASE_CODE = /^PK-[A-Z]{2}-\d{2,3}$/;
const DECIDED: Intake["status"][] = ["approved_recipe", "approved_template", "rejected"];

/**
 * One dieline offer from a factory (U3.6, D-272): its provenance (factory, file and its sha256, the
 * terms version accepted), the review — matched to a recipe with the deviation report
 * (`styles.import`), approved as a new recipe (imported through D-242) or a fixed template of a
 * base, or rejected with a reason (`styles.approve_recipe`, Prepress).
 */
export function StyleIntakeDetail({ intakeId }: { intakeId: string }) {
  const t = useTranslations("catalogue.intakes");
  const queryClient = useQueryClient();
  const canImport = useCan("styles.import");
  const canApprove = useCan("styles.approve_recipe");
  const file = useFileDownload();
  const key = queryKeys.detail("admin", "style-intake", intakeId);
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);
  const [as, setAs] = useState<"recipe" | "template">("recipe");
  const [baseCode, setBaseCode] = useState("");
  const [reason, setReason] = useState("");
  const [matching, setMatching] = useState(false);

  const query = useQuery({
    queryKey: key,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/style-intakes/{intakeId}", {
          params: { path: { intakeId } },
        })
      ).data!,
  });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const intake = query.data;
  if (!intake) return null;
  const path = { params: { path: { intakeId } } };
  const settle = (updated: Intake | undefined) => {
    if (updated) queryClient.setQueryData(key, updated);
    void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "style-intakes") });
    setDialog(null);
  };
  const open = !DECIDED.includes(intake.status);
  const isDxf = /\.dxf$/i.test(intake.file.originalName) || intake.file.mimeType.includes("dxf");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("title"), href: "/style-intakes" }, { label: intake.title }]}
          />
        }
        title={intake.title}
        meta={<StatusChip map={STYLE_INTAKE_STATUS} value={intake.status} size="md" />}
        actions={
          canApprove && open ? (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setBaseCode(intake.matchedRecipe?.baseCode ?? intake.proposedBaseCode ?? "");
                  setDialog("approve");
                }}
              >
                {t("approve")}
              </Button>
              <Button variant="ghost" className="text-danger" onClick={() => setDialog("reject")}>
                {t("reject")}
              </Button>
            </div>
          ) : null
        }
      />

      <Section title={t("provenance")}>
        <DescriptionList
          columns={2}
          items={[
            { term: t("factory"), description: `${intake.factory.code} · ${intake.factory.name}` },
            { term: t("proposedBase"), description: intake.proposedBaseCode ?? "—" },
            {
              term: t("file"),
              description: (
                <Button size="sm" variant="secondary" iconStart="download" onClick={() => file.mutate(intake.file.id)}>
                  {intake.file.originalName}
                </Button>
              ),
            },
            {
              term: t("sha256"),
              description: <span className="text-xs break-all tabular-nums">{intake.fileSha256}</span>,
            },
            { term: t("terms"), description: t("termsVersion", { version: intake.termsVersion }) },
            { term: t("submitted"), description: <When at={intake.createdAt} /> },
            { term: t("note"), description: intake.note ?? "—" },
            ...(intake.reviewedBy
              ? [{ term: t("reviewed"), description: t("reviewedBy", { name: intake.reviewedBy.displayName }) }]
              : []),
            ...(intake.matchedRecipe
              ? [
                  {
                    term: t("matchedRecipe"),
                    description: `${intake.matchedRecipe.baseCode} · ${intake.matchedRecipe.id}`,
                  },
                ]
              : []),
            ...(intake.templateBaseCode ? [{ term: t("templateOf"), description: intake.templateBaseCode }] : []),
            ...(intake.resultRecipe
              ? [
                  {
                    term: t("resultRecipe"),
                    description: `${intake.resultRecipe.baseCode} · ${intake.resultRecipe.id}`,
                  },
                ]
              : []),
            ...(intake.rejectReason ? [{ term: t("rejectReason"), description: intake.rejectReason }] : []),
          ]}
        />
      </Section>

      {intake.deviations?.length ? (
        <Section title={t("deviations")}>
          <ul className="flex flex-col gap-1 text-sm">
            {intake.deviations.map((d) => (
              <li key={d.aspect}>
                <span className="font-medium">{d.aspect}</span>
                <span className="text-muted">{t("deviationSep")}</span>
                <span className="tabular-nums">{d.note}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {canImport && open ? (
        <Section title={t("matchTitle")} description={isDxf ? t("matchBody") : t("pdfBody")}>
          {isDxf ? (
            <IntakeMatcher
              proposedBaseCode={intake.proposedBaseCode}
              busy={matching}
              onMatch={async (body) => {
                setMatching(true);
                try {
                  const { data } = await adminBrowserApis().contract.POST(
                    "/v1/admin/style-intakes/{intakeId}/actions/match",
                    { ...path, body },
                  );
                  settle(data);
                  toast.success(t("matched"));
                } catch (error) {
                  toast.error(problemMessage(error, t("failed")));
                } finally {
                  setMatching(false);
                }
              }}
            />
          ) : null}
        </Section>
      ) : null}

      {dialog === "approve" ? (
        <FormDialog
          title={t("approveTitle")}
          description={t("approveBody")}
          submitLabel={t("approve")}
          onClose={() => setDialog(null)}
          onSubmit={async () => {
            if (!BASE_CODE.test(baseCode.trim())) throw new Error(t("baseCodeInvalid"));
            if (as === "recipe" && !intake.matchedRecipe) throw new Error(t("matchFirst"));
            const body: Schemas["ApproveStyleIntakeDto"] =
              as === "recipe"
                ? { as, baseCode: baseCode.trim(), recipeId: intake.matchedRecipe!.id }
                : { as, baseCode: baseCode.trim() };
            const { data } = await adminBrowserApis().contract.POST(
              "/v1/admin/style-intakes/{intakeId}/actions/approve",
              {
                ...path,
                body,
              },
            );
            settle(data);
            toast.success(t("approved"));
          }}
        >
          <SegmentedControl
            label={t("approveAs")}
            value={as}
            onValueChange={(v) => setAs(v as "recipe" | "template")}
            options={[
              { value: "recipe", label: t("asRecipe") },
              { value: "template", label: t("asTemplate") },
            ]}
          />
          <p className="text-muted text-sm">{as === "recipe" ? t("asRecipeBody") : t("asTemplateBody")}</p>
          <Field label={t("baseCode")} hint={t("baseCodeHint")}>
            <Input value={baseCode} onChange={(e) => setBaseCode(e.target.value.toUpperCase())} />
          </Field>
        </FormDialog>
      ) : null}

      {dialog === "reject" ? (
        <FormDialog
          title={t("rejectTitle")}
          submitLabel={t("reject")}
          destructive
          onClose={() => setDialog(null)}
          onSubmit={async () => {
            if (!reason.trim()) throw new Error(t("reasonRequired"));
            const { data } = await adminBrowserApis().contract.POST(
              "/v1/admin/style-intakes/{intakeId}/actions/reject",
              {
                ...path,
                body: { reason: reason.trim() },
              },
            );
            settle(data);
            toast.success(t("rejected"));
          }}
        >
          <Field label={t("reason")}>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </Field>
        </FormDialog>
      ) : null}
    </div>
  );
}
