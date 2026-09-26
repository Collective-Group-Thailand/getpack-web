"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { CLAIM_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { NumberInput, Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { Select } from "@/ui/components/Select";
import { Timeline } from "@/ui/components/Timeline";
import { toast } from "@/ui/components/Toast";

import {
  ConfirmAction,
  FormDialog,
  FormError,
  problemMessage,
  QueryError,
  Section,
  StatusChip,
  useCan,
} from "../console";
import type { Claim } from "./resources";

type Action = Claim["allowedActions"][number];
type Resolution = Claim["allowedResolutions"][number];
const LIABILITIES = ["factory", "customer", "carrier", "packio", "undetermined"] as const;
const WITH_AMOUNT = new Set<Resolution>([
  "refund",
  "credit_note",
  "store_credit",
  "factory_deduction",
  "carrier_recovery",
]);

async function readClaim(claimId: string) {
  return browserRequests().read("GET /v1/admin/claims/{claimId}", { path: { claimId } });
}

/**
 * One claim (F2 2.8, D-082, D-083): the evidence the customer had to give (product and carton
 * photos), the liability the rule gave and why — overridden only with its own permission and a
 * reason — the steps with their audience, and the resolution, which runs an existing mechanism
 * (re-production, refund, credit note, deduction from the factory) under one idempotency key.
 */
export function ClaimDetail({ claimId }: { claimId: string }) {
  const t = useTranslations("logistics.claim");
  const tClaims = useTranslations("logistics.claims");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canOverride = useCan("claims.override_liability");
  const key = queryKeys.detail("admin", "claim", claimId);
  const [action, setAction] = useState<Action | null>(null);
  const [overriding, setOverriding] = useState(false);
  const [liability, setLiability] = useState<(typeof LIABILITIES)[number]>("factory");
  const [reason, setReason] = useState("");
  const [resolving, setResolving] = useState<{ key: string } | null>(null);
  const [resolution, setResolution] = useState<Resolution | "">("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const query = useQuery({ queryKey: key, queryFn: async () => (await readClaim(claimId)).data });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const claim = query.data;
  if (!claim) return null;

  const settle = (updated: Claim) => {
    queryClient.setQueryData(key, updated);
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "claim") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
  };
  const photos = (files: Claim["evidence"]["productPhotos"], label: string) => (
    <div>
      <p className="text-muted mb-1 text-xs">{label}</p>
      {files.length === 0 ? (
        <p className="text-muted text-sm">{t("noPhotos")}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {files.map((file) => (
            <li key={file.id}>
              <a
                href={file.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="text-primary bg-surface-subtle flex h-16 w-24 items-center justify-center rounded-md border text-xs hover:underline"
              >
                {file.originalName}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

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
        description={t("summary", { order: claim.order.orderCode, customer: claim.customer.displayName })}
        actions={
          <>
            {claim.allowedResolutions.length > 0 ? (
              <Button
                onClick={() => {
                  setResolution(claim.allowedResolutions[0] ?? "");
                  setAmount(claim.claimedAmount ?? "");
                  setNote("");
                  setResolving({ key: newIdempotencyKey() });
                }}
              >
                {t("resolve")}
              </Button>
            ) : null}
            {claim.allowedActions.map((item) => (
              <Button
                key={item}
                variant={item === "reject" ? "ghost" : item === "approve" ? "primary" : "secondary"}
                onClick={() => setAction(item)}
              >
                {t(`actions.${item}.label`)}
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
                  description: claim.shipment ? (
                    <Link href={`/shipments/${claim.shipment.id}`} className="text-primary font-mono hover:underline">
                      {claim.shipment.shipmentNo}
                    </Link>
                  ) : (
                    "–"
                  ),
                },
              ]}
            />
          </Section>

          <Section title={t("evidence")} description={t("evidenceNote")}>
            <div className="grid gap-4 sm:grid-cols-2">
              {photos(claim.evidence.productPhotos, t("productPhotos"))}
              {photos(claim.evidence.cartonPhotos, t("cartonPhotos"))}
            </div>
          </Section>

          <Section title={t("thread")}>
            <Timeline
              label={t("thread")}
              items={[...claim.messages].reverse().map((message, at) => ({
                id: `${message.at}-${at}`,
                title: message.body,
                time: <When at={message.at} />,
                actor: `${message.author} · ${t(`audiences.${message.audience}`)}`,
                icon: message.audience === "factory" ? "factory" : message.audience === "customer" ? "user" : "lock",
              }))}
            />
          </Section>
        </div>

        <div className="flex flex-col gap-5">
          <Section
            title={t("liability")}
            actions={
              canOverride && !["resolved", "closed"].includes(claim.status) ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setLiability(claim.liability);
                    setReason("");
                    setOverriding(true);
                  }}
                >
                  {t("override")}
                </Button>
              ) : null
            }
          >
            <p className="text-lg font-semibold">{tClaims(`liabilities.${claim.liability}`)}</p>
            <p className="text-muted text-sm">
              {t("byRule", { liability: tClaims(`liabilities.${claim.liabilityByRule}`) })} · {claim.liabilityRule}
            </p>
            {claim.liabilityOverride ? (
              <Callout
                tone="warning"
                className="mt-3"
                title={t("overridden", { by: claim.liabilityOverride.by.displayName })}
              >
                {claim.liabilityOverride.reason}
              </Callout>
            ) : null}
            {claim.approvedProof ? (
              <p className="text-muted mt-3 text-sm">
                {t("approvedProof", { no: claim.approvedProof.versionNo })}{" "}
                <When at={claim.approvedProof.approvedAt} absoluteOnly />
              </p>
            ) : null}
          </Section>
          {claim.factoryResponse ? (
            <Section title={t("factoryResponse")}>
              <Badge tone={claim.factoryResponse.response === "accepted" ? "success" : "warning"}>
                {t(`responses.${claim.factoryResponse.response}`)}
              </Badge>
              {claim.factoryResponse.note ? <p className="mt-2 text-sm">{claim.factoryResponse.note}</p> : null}
            </Section>
          ) : null}
          {claim.decision ? (
            <Section title={t("decision")}>
              <p className="text-sm">{claim.decision.reason}</p>
              <p className="text-muted text-xs">
                {claim.decision.by.displayName} · <When at={claim.decision.at} />
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
                      {item.reference ? <span className="font-mono">{item.reference}</span> : null}
                      {item.reference ? " · " : ""}
                      {item.executedBy.displayName} · <When at={item.executedAt} />
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
      </div>

      {action ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setAction(null))}
          title={t(`actions.${action}.title`)}
          description={t(`actions.${action}.body`, { no: claim.claimNo, order: claim.order.orderCode })}
          confirmLabel={t(`actions.${action}.label`)}
          tone={action === "reject" ? "destructive" : "primary"}
          reason={{ label: t(`actions.${action}.reason`), required: true, minLength: 3 }}
          onConfirm={async ({ reason: text }) => {
            try {
              const { etag } = await readClaim(claimId);
              const updated = await browserRequests().call("POST /v1/admin/claims/{claimId}/actions/{action}", {
                path: { claimId, action },
                body: { reason: text },
                etag: etag ?? undefined,
              });
              settle(updated);
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
          onClose={() => setOverriding(false)}
          onSubmit={async () => {
            if (reason.trim().length < 3) throw new FormError(t("needReason"));
            try {
              const { etag } = await readClaim(claimId);
              const updated = await browserRequests().call("POST /v1/admin/claims/{claimId}/liability", {
                path: { claimId },
                body: { liability, reason: reason.trim() },
                etag: etag ?? undefined,
              });
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
          <Field label={t("reason")} required>
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
            if (note.trim().length < 3) throw new FormError(t("needReason"));
            try {
              const updated = await browserRequests().call("POST /v1/admin/claims/{claimId}/resolutions", {
                path: { claimId },
                body: {
                  action: resolution,
                  amount: WITH_AMOUNT.has(resolution) ? Number(amount).toFixed(2) : null,
                  note: note.trim(),
                },
                idempotencyKey: resolving.key,
              });
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
              options={claim.allowedResolutions.map((value) => ({ value, label: t(`resolutionActions.${value}`) }))}
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
          <Field label={t("note")} required>
            <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
        </FormDialog>
      ) : null}
    </div>
  );
}
