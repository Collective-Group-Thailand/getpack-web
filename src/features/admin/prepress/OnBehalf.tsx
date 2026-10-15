"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  AssignDialog,
  ConfirmAction,
  FormDialog,
  FormError,
  problemMessage,
  useCan,
} from "../console";
import type { ArtworkSubmission, DesignService, Proof } from "./resources";

type Channel = Schemas["CustomerConfirmationChannel"];
const CHANNELS = ["phone", "line", "email", "in_person"] as const satisfies readonly Channel[];

/**
 * CS recording the customer's answer on a proof given by phone, LINE, e-mail or in person (D-073):
 * an approval with the same effects as the customer's own, or a change request with what to change.
 * Audited with the reason and the channel (`cs_on_behalf`).
 */
export function DecideOnBehalf({ proof, orderId }: { proof: Proof; orderId: string }) {
  const t = useTranslations("prepress.onBehalf");
  const queryClient = useQueryClient();
  const allowed = useCan("proofs.decide_on_behalf");
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<"approve" | "changes">("approve");
  const [channel, setChannel] = useState<Channel>("phone");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [key, setKey] = useState("");
  if (!allowed || proof.status !== "pending_customer") return null;
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        iconStart="phone"
        onClick={() => {
          setKey(newIdempotencyKey());
          setOpen(true);
        }}
      >
        {t("button")}
      </Button>
      {open ? (
        <FormDialog
          title={t("title", { version: proof.versionNo })}
          description={t("intro")}
          submitLabel={t(decision === "approve" ? "approve" : "requestChanges")}
          onClose={() => setOpen(false)}
          onSubmit={async () => {
            if (reason.trim().length < 3) throw new FormError(t("reasonRequired"));
            if (decision === "changes" && comment.trim().length < 3) throw new FormError(t("commentRequired"));
            const path = { proofId: proof.id };
            const body = {
              reason: reason.trim(),
              confirmedVia: channel,
              ...(comment.trim() ? { comment: comment.trim() } : {}),
            };
            // Approving takes an Idempotency-Key (it has the effects of the customer's own approval); a change request does not.
            if (decision === "approve")
              await adminBrowserApis().contract.POST("/v1/admin/proofs/{proofId}/actions/approve-on-behalf", {
                params: { path, header: { "Idempotency-Key": key } },
                body,
              });
            else
              await adminBrowserApis().contract.POST("/v1/admin/proofs/{proofId}/actions/request-changes-on-behalf", {
                params: { path },
                body,
              });
            toast.success(t(decision === "approve" ? "approved" : "changesRequested"));
            void queryClient.invalidateQueries({ queryKey: queryKeys.related("admin", "order", orderId, "proofs") });
            void queryClient.invalidateQueries({ queryKey: queryKeys.detail("admin", "order", orderId) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "proof") });
          }}
        >
          <SegmentedControl
            label={t("decision")}
            value={decision}
            onValueChange={(value) => setDecision(value as "approve" | "changes")}
            options={[
              { value: "approve", label: t("approve") },
              { value: "changes", label: t("requestChanges") },
            ]}
          />
          <Field label={t("channel")} required>
            <Select
              value={channel}
              onValueChange={(value) => setChannel(value as Channel)}
              options={CHANNELS.map((c) => ({ value: c, label: t(`channels.${c}`) }))}
            />
          </Field>
          <Field label={t("reason")} hint={t("reasonHint")} required>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Field label={t("comment")} hint={t("commentHint")} required={decision === "changes"}>
            <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          </Field>
        </FormDialog>
      ) : null}
    </>
  );
}

/** Running a submission's preflight again — after an error, or once the template or rules changed (D-070). */
export function RerunPreflight({ submission, orderId }: { submission: ArtworkSubmission; orderId: string }) {
  const t = useTranslations("prepress.onBehalf");
  const queryClient = useQueryClient();
  const allowed = useCan("prepress.review");
  const [busy, setBusy] = useState(false);
  if (!allowed || submission.preflightStatus === "pending" || submission.preflightStatus === "running") return null;
  return (
    <Button
      size="sm"
      variant="ghost"
      iconStart="refresh"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await adminBrowserApis().contract.POST(
            "/v1/admin/artwork-submissions/{submissionId}/actions/rerun-preflight",
            {
              params: { path: { submissionId: submission.id } },
            },
          );
          toast.success(t("rerunStarted"));
          void queryClient.invalidateQueries({ queryKey: queryKeys.related("admin", "order", orderId, "artwork") });
          void queryClient.invalidateQueries({ queryKey: queryKeys.detail("admin", "order", orderId) });
        } catch (error) {
          toast.error(problemMessage(error, t("failed")));
        } finally {
          setBusy(false);
        }
      }}
    >
      {t("rerun")}
    </Button>
  );
}

/** Assigning a hired design to a Packio designer, or cancelling it with a reason (D-071). */
export function DesignServiceActions({ service }: { service: DesignService }) {
  const t = useTranslations("prepress.onBehalf.design");
  const queryClient = useQueryClient();
  const allowed = useCan("design_services.manage");
  const [open, setOpen] = useState<"assign" | "cancel" | null>(null);
  if (!allowed || service.status === "cancelled" || service.status === "approved") return null;
  const settle = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.related("admin", "order", service.orderId, "design_service"),
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "prepress") });
  };
  return (
    <span className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" iconStart="user-plus" onClick={() => setOpen("assign")}>
        {service.assignee ? t("reassign") : t("assign")}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen("cancel")}>
        {t("cancel")}
      </Button>
      {open === "assign" ? (
        <AssignDialog
          title={t("assignTitle")}
          description={t("assignBody", { code: service.orderCode })}
          current={service.assignee ?? null}
          permission="design_services.manage"
          personHint={t("personHint")}
          clearable={false}
          onAssign={async (assigneeUserId) => {
            if (!assigneeUserId) return;
            try {
              await adminBrowserApis().contract.POST("/v1/admin/design-services/{designServiceId}/actions/assign", {
                params: { path: { designServiceId: service.id } },
                body: { assigneeUserId },
              });
              toast.success(t("assigned"));
              settle();
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {open === "cancel" ? (
        <ConfirmAction
          open
          onOpenChange={(next) => !next && setOpen(null)}
          title={t("cancelTitle", { code: service.orderCode })}
          description={t("cancelBody")}
          confirmLabel={t("cancel")}
          tone="destructive"
          reason={{ label: t("reason"), required: true, minLength: 3 }}
          onConfirm={async ({ reason }) => {
            try {
              await adminBrowserApis().contract.POST("/v1/admin/design-services/{designServiceId}/actions/cancel", {
                params: { path: { designServiceId: service.id } },
                body: { reason },
              });
              toast.success(t("cancelled"));
              settle();
              setOpen(null);
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        />
      ) : null}
    </span>
  );
}
