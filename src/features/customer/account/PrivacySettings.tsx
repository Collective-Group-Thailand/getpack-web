"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import type { Schemas } from "@/lib/api/types";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DisclosureList } from "@/ui/components/DisclosureList";
import { Field } from "@/ui/components/Field";
import { Switch } from "@/ui/components/Switch";
import { Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

type Consent = Schemas["ConsentDto"];
type PrivacyRequest = ResponseOf<Requests, "GET /v1/store/me/privacy-requests">["data"][number];

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/**
 * PDPA in the account (F3 3.4): every consent purpose with the text it was given for, the optional
 * ones withdrawable at once (published `store.me.consents`); a copy of one's data or its deletion
 * as a request the privacy team answers by a deadline (CONTRACT-REQUEST store.privacy).
 */
export function PrivacySettings({
  consents: initialConsents,
  requests,
}: {
  consents: Consent[];
  requests: PrivacyRequest[];
}) {
  const t = useTranslations("account.privacy");
  const format = useFormat();
  const router = useRouter();
  const [consents, setConsents] = useState(initialConsents);
  const [asking, setAsking] = useState<"export" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());

  async function decide(purpose: string, granted: boolean) {
    try {
      const { data } = await browserApi().POST("/v1/store/me/consents", { body: { purpose, granted, source: "web" } });
      if (data) setConsents(data);
      toast.success(granted ? t("granted") : t("withdrawn"));
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    }
  }

  async function submit() {
    if (!asking) return;
    setBusy(true);
    try {
      await browserRequests().call("POST /v1/store/me/privacy-requests", {
        body: { kind: asking, ...(reason.trim() ? { reason: reason.trim() } : {}) },
        idempotencyKey: key.current,
      });
      key.current = newKey();
      setAsking(null);
      setReason("");
      router.refresh();
      toast.success(t("requestSent"));
    } catch (error) {
      if (isApiError(error)) key.current = newKey();
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="privacy-consents">
        <h2 id="privacy-consents" className="text-lg font-semibold">
          {t("consents")}
        </h2>
        <ul className="mt-4 flex flex-col gap-3">
          {consents.map((consent) => (
            <li key={consent.purpose} className="border-border flex flex-col gap-2 rounded-lg border p-4">
              {consent.required ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{consent.summary ?? consent.purpose}</p>
                  <Badge tone="neutral">{t("required")}</Badge>
                </div>
              ) : (
                <Switch
                  labelPosition="start"
                  className="justify-between"
                  checked={consent.granted === true}
                  onCheckedChange={(value) => void decide(consent.purpose, value)}
                  label={consent.summary ?? consent.purpose}
                  description={consent.outdated ? t("outdated") : undefined}
                />
              )}
              {consent.text ? <DisclosureList items={[{ summary: t("readText"), content: consent.text }]} /> : null}
            </li>
          ))}
        </ul>
        <p className="text-muted mt-3 text-xs">{t("requiredNote")}</p>
      </section>

      <section aria-labelledby="privacy-requests">
        <h2 id="privacy-requests" className="text-lg font-semibold">
          {t("rights")}
        </h2>
        <p className="text-muted mt-1 text-sm">{t("rightsIntro")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" iconStart="download" onClick={() => setAsking("export")}>
            {t("export")}
          </Button>
          <Button variant="ghost" iconStart="trash" onClick={() => setAsking("delete")}>
            {t("delete")}
          </Button>
        </div>
        {requests.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {requests.map((request) => (
              <li key={request.id} className="border-border rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  {t(`kinds.${request.kind}`)} · {t(`statuses.${request.status}`)}
                </p>
                <p className="text-muted text-xs">
                  {t("requestedAt", { date: format.date(request.requestedAt), due: format.date(request.dueAt) })}
                </p>
                {request.note ? <p className="mt-1">{request.note}</p> : null}
                {request.download ? (
                  <a
                    href={request.download.url}
                    className="text-primary mt-1 inline-block underline-offset-4 hover:underline"
                  >
                    {t("downloadExport")}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <AlertDialog
        open={asking !== null}
        onOpenChange={(open) => !open && setAsking(null)}
        title={asking === "delete" ? t("deleteTitle") : t("exportTitle")}
        description={asking === "delete" ? t("deleteBody") : t("exportBody")}
        confirmLabel={asking === "delete" ? t("deleteConfirm") : t("exportConfirm")}
        cancelLabel={t("cancel")}
        tone={asking === "delete" ? "destructive" : "primary"}
        loading={busy}
        onConfirm={() => void submit()}
      >
        <Field label={t("reason")} hint={t("reasonHint")}>
          <Textarea rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </AlertDialog>
    </div>
  );
}
