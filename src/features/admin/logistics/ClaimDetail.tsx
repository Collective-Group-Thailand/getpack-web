"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { adminClaimActions, adminClaimResolutions, type AdminClaimActionKey } from "@/domain/next-actions/admin";
import { CLAIM_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { NumberInput, Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  ConfirmAction,
  FormDialog,
  FormError,
  problemMessage,
  QueryError,
  Section,
  StatusChip,
  useActor,
} from "../console";
import { FileList } from "./files";
import type { Claim } from "./resources";

type Resolution = Schemas["ClaimAction"];
/** The steps confirmed in one dialog; resolving and overriding have their own forms. */
type Step = Exclude<AdminClaimActionKey, "claim.resolve" | "claim.override_liability">;

const LIABILITIES = [
  "factory",
  "customer",
  "carrier",
  "packio",
  "undetermined",
] as const satisfies readonly Schemas["ClaimLiability"][];
const WITH_AMOUNT = new Set<Resolution>([
  "refund",
  "credit_note",
  "store_credit",
  "factory_deduction",
  "carrier_recovery",
]);
/** The steps that carry a note (`ClaimNoteDto`, `DecideClaimDto`, 3–2000 characters). */
const WITH_NOTE = new Set<Step>(["claim.request_info", "claim.approve", "claim.reject"]);
/** The copy key of each step, under `logistics.claim.actions`. */
const COPY: Record<Step, string> = {
  "claim.review": "review",
  "claim.request_info": "request_info",
  "claim.send_to_factory": "send_to_factory",
  "claim.approve": "approve",
  "claim.reject": "reject",
  "claim.close": "close",
};

/** One published operation per step, each under its own Idempotency-Key (`admin.claims.*`). */
async function runStep(claimId: string, step: Step, idempotencyKey: string, note: string): Promise<Claim> {
  const { contract } = adminBrowserApis();
  const params = { path: { claimId }, header: { "Idempotency-Key": idempotencyKey } };
  switch (step) {
    case "claim.review":
      return (await contract.POST("/v1/admin/claims/{claimId}/actions/review", { params })).data!;
    case "claim.request_info":
      return (await contract.POST("/v1/admin/claims/{claimId}/actions/request-info", { params, body: { note } })).data!;
    case "claim.send_to_factory":
      return (await contract.POST("/v1/admin/claims/{claimId}/actions/send-to-factory", { params })).data!;
    case "claim.approve":
    case "claim.reject":
      return (
        await contract.POST("/v1/admin/claims/{claimId}/actions/decide", {
          params,
          body: { decision: step === "claim.approve" ? "approved" : "rejected", note },
        })
      ).data!;
    case "claim.close":
      return (await contract.POST("/v1/admin/claims/{claimId}/actions/close", { params })).data!;
  }
}

/**
 * One claim (F2 2.8, D-082, D-083): the evidence the customer had to give (product and carton
 * photos), the liability the rule gave — overridden only with its own permission and a reason —
 * what the team asked and the factory answered, and the resolution, which runs an existing
 * mechanism (re-production, refund, credit note, deduction from the factory) under one
 * idempotency key.
 *
 * Not on the published claim (CONTRACT-GAP admin.claims): `allowedActions` / `allowedResolutions`
 * (offered from the status and liability, `src/domain/next-actions/admin.ts`), the message thread,
 * the rule's explanation, the approved proof (D-083), the customer, who decided or overrode, and
 * each resolution's document reference and executor.
 */
export function ClaimDetail({ claimId }: { claimId: string }) {
  const t = useTranslations("logistics.claim");
  const tClaims = useTranslations("logistics.claims");
  const format = useFormat();
  const queryClient = useQueryClient();
  const actor = useActor();
  const key = queryKeys.detail("admin", "claim", claimId);
  const [step, setStep] = useState<Step | null>(null);
  const [overriding, setOverriding] = useState<{ key: string } | null>(null);
  const [liability, setLiability] = useState<Schemas["ClaimLiability"]>("factory");
  const [reason, setReason] = useState("");
  const [resolving, setResolving] = useState<{ key: string } | null>(null);
  const [resolution, setResolution] = useState<Resolution | "">("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  const query = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/claims/{claimId}", { params: { path: { claimId } } })).data!,
  });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const claim = query.data;
  if (!claim) return null;

  const settle = (updated: Claim) => {
    queryClient.setQueryData(key, updated);
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "claim") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
  };
  const offered = adminClaimActions({ status: claim.status }, (permission) => actor.permissions.includes(permission));
  const has = (action: AdminClaimActionKey) => offered.some((item) => item.key === action);
  const steps = offered.map((item) => item.key).filter((item): item is Step => item in COPY);
  const resolutions = adminClaimResolutions(claim.liability);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("claims"), href: "/claims" }, { label: claim.claimNo }]}
          />
        }
        title={claim.claimNo}
        meta={
          <>
            <StatusChip map={CLAIM_STATUS} value={claim.status} size="md" />
            <Badge>{tClaims(`types.${claim.type}`)}</Badge>
            {claim.origin !== "customer" ? <Badge tone="info">{tClaims(`origins.${claim.origin}`)}</Badge> : null}
          </>
        }
        description={t("summary", { order: claim.orderCode, factory: claim.factoryCode ?? "–" })}
        actions={
          <>
            {has("claim.resolve") ? (
              <Button
                onClick={() => {
                  setResolution(resolutions[0] ?? "");
                  setAmount(claim.claimedAmount ?? "");
                  setQuantity(claim.claimedQuantity === null ? "" : String(claim.claimedQuantity));
                  setNote("");
                  setResolving({ key: newIdempotencyKey() });
                }}
              >
                {t("resolve")}
              </Button>
            ) : null}
            {steps.map((item) => (
              <Button
                key={item}
                variant={item === "claim.reject" ? "ghost" : item === "claim.approve" ? "primary" : "secondary"}
                onClick={() => setStep(item)}
              >
                {t(`actions.${COPY[item]}.label`)}
              </Button>
            ))}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-5">
          <Section title={t("claim")}>
            <p className="mb-3 text-sm">{claim.description}</p>
            <DescriptionList
              columns={3}
              items={[
                {
                  term: t("order"),
                  description: (
                    <Link href={`/orders/${claim.orderId}`} className="text-primary font-mono hover:underline">
                      {claim.orderCode}
                    </Link>
                  ),
                },
                { term: t("requested"), description: tClaims(`resolutions.${claim.requestedResolution}`) },
                { term: t("claimedAmount"), description: format.thb(claim.claimedAmount) },
                {
                  term: t("claimedQuantity"),
                  description: claim.claimedQuantity === null ? "–" : format.number(claim.claimedQuantity),
                },
                { term: t("received"), description: <When at={claim.receivedAt} absoluteOnly /> },
                { term: t("window"), description: <When at={claim.windowEndsAt} absoluteOnly /> },
                {
                  term: t("shipment"),
                  description: claim.shipmentId ? (
                    <Link href={`/shipments/${claim.shipmentId}`} className="text-primary hover:underline">
                      {t("openShipment")}
                    </Link>
                  ) : (
                    "–"
                  ),
                },
                { term: t("job"), description: claim.jobNo ?? "–" },
              ]}
            />
          </Section>

          <Section title={t("evidence")} description={t("evidenceNote")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FileList fileIds={claim.photos.product} label={t("productPhotos")} empty={t("noPhotos")} />
              <FileList fileIds={claim.photos.carton} label={t("cartonPhotos")} empty={t("noPhotos")} />
            </div>
          </Section>

          {claim.infoRequest ? (
            <Section title={t("info")}>
              <DescriptionList
                items={[
                  { term: t("infoRequest"), description: claim.infoRequest },
                  { term: t("infoResponse"), description: claim.infoResponse ?? t("noResponse") },
                ]}
              />
            </Section>
          ) : null}
        </div>

        <div className="flex flex-col gap-5">
          <Section
            title={t("liability")}
            actions={
              has("claim.override_liability") ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setLiability(claim.liability);
                    setReason("");
                    setOverriding({ key: newIdempotencyKey() });
                  }}
                >
                  {t("override")}
                </Button>
              ) : null
            }
          >
            <p className="text-lg font-semibold">{tClaims(`liabilities.${claim.liability}`)}</p>
            <p className="text-muted text-sm">
              {t("byRule", { liability: tClaims(`liabilities.${claim.liabilityByRule}`) })}
            </p>
            {claim.overrideReason ? (
              <Callout tone="warning" className="mt-3" title={t("overridden")}>
                {claim.overrideReason}
              </Callout>
            ) : null}
          </Section>
          {claim.factoryResponse ? (
            <Section title={t("factoryResponse")}>
              <Badge tone={claim.factoryResponse === "accepted" ? "success" : "warning"}>
                {t(`responses.${claim.factoryResponse}`)}
              </Badge>
              {claim.factoryResponseNote ? <p className="mt-2 text-sm">{claim.factoryResponseNote}</p> : null}
            </Section>
          ) : null}
          {claim.decidedAt ? (
            <Section title={t("decision")}>
              {claim.decisionNote ? <p className="text-sm">{claim.decisionNote}</p> : null}
              <p className="text-muted text-xs">
                <When at={claim.decidedAt} />
              </p>
            </Section>
          ) : null}
          {claim.resolutions.length > 0 ? (
            <Section title={t("resolutions")}>
              <ul className="divide-border divide-y text-sm">
                {claim.resolutions.map((item, at) => (
                  <li key={at} className="py-2">
                    <p className="font-medium">
                      {t(`resolutionActions.${item.action}`)}
                      {item.amount ? ` · ${format.thb(item.amount)}` : ""}
                    </p>
                    <p className="text-muted text-xs">
                      {item.jobNo ? <span className="font-mono">{item.jobNo} · </span> : null}
                      {item.quantity !== null ? `${t("pieces", { quantity: format.number(item.quantity) })} · ` : null}
                      <When at={item.executedAt} />
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
      </div>

      {step ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setStep(null))}
          title={t(`actions.${COPY[step]}.title`)}
          description={t(`actions.${COPY[step]}.body`, { no: claim.claimNo, order: claim.orderCode })}
          confirmLabel={t(`actions.${COPY[step]}.label`)}
          tone={step === "claim.reject" ? "destructive" : "primary"}
          reason={
            WITH_NOTE.has(step) ? { label: t(`actions.${COPY[step]}.reason`), required: true, minLength: 3 } : undefined
          }
          onConfirm={async ({ idempotencyKey, reason: text }) => {
            try {
              settle(await runStep(claimId, step, idempotencyKey, text));
              toast.success(t("changed"));
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        />
      ) : null}

      {overriding ? (
        <FormDialog
          title={t("overrideTitle")}
          description={t("overrideBody", { no: claim.claimNo, rule: tClaims(`liabilities.${claim.liabilityByRule}`) })}
          submitLabel={t("save")}
          onClose={() => setOverriding(null)}
          onSubmit={async () => {
            // OverrideLiabilityDto.reason is at least 10 characters.
            if (reason.trim().length < 10) throw new FormError(t("needOverrideReason"));
            try {
              const updated = (
                await adminBrowserApis().contract.POST("/v1/admin/claims/{claimId}/actions/override-liability", {
                  params: { path: { claimId }, header: { "Idempotency-Key": overriding.key } },
                  body: { liability, reason: reason.trim() },
                })
              ).data!;
              settle(updated);
              toast.success(t("saved"));
            } catch (error) {
              throw new FormError(problemMessage(error, t("failed")));
            }
          }}
        >
          <Field label={t("liability")}>
            <Select
              value={liability}
              onValueChange={(value) => setLiability(value as typeof liability)}
              options={LIABILITIES.map((value) => ({ value, label: tClaims(`liabilities.${value}`) }))}
            />
          </Field>
          <Field label={t("reason")} hint={t("overrideHint")} required>
            <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </FormDialog>
      ) : null}

      {resolving ? (
        <FormDialog
          title={t("resolveTitle")}
          description={t("resolveBody", { no: claim.claimNo, liability: tClaims(`liabilities.${claim.liability}`) })}
          submitLabel={t("execute")}
          onClose={() => setResolving(null)}
          onSubmit={async () => {
            if (!resolution) throw new FormError(t("needResolution"));
            if (WITH_AMOUNT.has(resolution) && !(Number(amount) > 0)) throw new FormError(t("needAmount"));
            const pieces = resolution === "reproduction_job" && quantity ? Math.trunc(Number(quantity)) : undefined;
            if (pieces !== undefined && !(pieces >= 1)) throw new FormError(t("needQuantity"));
            try {
              // One action per run here; `ResolveClaimDto` takes up to six in one transaction. A refund
              // names no payment — the order's payments are not listed by order (CONTRACT-GAP admin.orders).
              const updated = (
                await adminBrowserApis().contract.POST("/v1/admin/claims/{claimId}/actions/resolve", {
                  params: { path: { claimId }, header: { "Idempotency-Key": resolving.key } },
                  body: {
                    actions: [
                      {
                        action: resolution,
                        ...(WITH_AMOUNT.has(resolution) ? { amount: Number(amount).toFixed(2) } : {}),
                        ...(pieces !== undefined ? { quantity: pieces } : {}),
                        ...(note.trim() ? { note: note.trim() } : {}),
                      },
                    ],
                  },
                })
              ).data!;
              settle(updated);
              toast.success(t("executed"));
            } catch (error) {
              throw new FormError(problemMessage(error, t("failed")));
            }
          }}
        >
          <Field label={t("resolutionAction")}>
            <Select
              value={resolution || undefined}
              onValueChange={(value) => setResolution(value as Resolution)}
              options={resolutions.map((value) => ({ value, label: t(`resolutionActions.${value}`) }))}
            />
          </Field>
          {resolution && WITH_AMOUNT.has(resolution) ? (
            <Field label={t("amount")} required>
              <NumberInput
                min={0}
                step="0.01"
                unit="฿"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </Field>
          ) : null}
          {resolution === "reproduction_job" ? (
            <Field label={t("reproduceQuantity")} hint={t("optional")}>
              <NumberInput min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </Field>
          ) : null}
          <Field label={t("note")} hint={t("optional")}>
            <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
        </FormDialog>
      ) : null}
    </div>
  );
}
