"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

type Client = Schemas["CompanyApiClientDto"];
type Scope = Schemas["B2bScope"];
const SCOPES: Scope[] = ["b2b_orders.read", "b2b_orders.write", "b2b_documents.read", "b2b_webhooks.manage"];

/**
 * The company's API clients (U2.F5, D-291): issued by a Company Admin with the scopes they need —
 * read or place orders, read documents, manage webhooks — the secret shown once (packio-api keeps a
 * hash), when each was last used, and revoking. Rotating is issuing a new one, then revoking the old.
 * Webhook subscriptions and their delivery log are managed through the B2B API with a client that
 * holds the webhooks scope.
 */
export function ApiClients({ companyId, initial }: { companyId: string; initial: Client[] }) {
  const t = useTranslations("business.api");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const router = useRouter();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Scope[]>(["b2b_orders.read"]);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ clientId: string; secret: string } | null>(null);
  const [revoking, setRevoking] = useState<Client | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const issue = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const { data } = await browserApi().POST("/v1/store/companies/{companyId}/api-clients", {
        params: { path: { companyId }, header: { "Idempotency-Key": newIdempotencyKey() } },
        body: { name: name.trim(), scopes },
      });
      setIssued({ clientId: data!.clientId, secret: data!.clientSecret });
      setName("");
      router.refresh();
    } catch (error) {
      setProblem(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (client: Client) => {
    try {
      await browserApi().POST("/v1/store/companies/{companyId}/api-clients/{clientId}/actions/revoke", {
        params: { path: { companyId, clientId: client.id }, header: { "Idempotency-Key": newIdempotencyKey() } },
      });
      toast.success(t("revoked", { name: client.name }));
      router.refresh();
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    }
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="api-issue" className="border-border flex flex-col gap-3 rounded-xl border p-4">
        <h2 id="api-issue" className="font-semibold">
          {t("issueTitle")}
        </h2>
        <Field label={t("name")} hint={t("nameHint")}>
          <Input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t("scopes")}</legend>
          {SCOPES.map((scope) => (
            <Checkbox
              key={scope}
              label={t(`scope.${scope.replace("b2b_", "").replace(".", "_")}`)}
              description={scope}
              checked={scopes.includes(scope)}
              onCheckedChange={(on) => setScopes((list) => (on ? [...list, scope] : list.filter((s) => s !== scope)))}
            />
          ))}
        </fieldset>
        <div>
          <Button loading={busy} disabled={!name.trim() || scopes.length === 0} onClick={() => void issue()}>
            {t("issue")}
          </Button>
        </div>
        {problem ? <Callout tone="danger" title={problem} /> : null}
        {issued ? (
          <Callout tone="warning" title={t("secretOnce")}>
            <Field label={t("clientId")}>
              <Input readOnly value={issued.clientId} onFocus={(event) => event.target.select()} />
            </Field>
            <Field label={t("clientSecret")} className="mt-2">
              <Input readOnly value={issued.secret} onFocus={(event) => event.target.select()} />
            </Field>
            <Button size="sm" className="mt-2" iconStart="copy" onClick={() => void copy(issued.secret)}>
              {t("copySecret")}
            </Button>
          </Callout>
        ) : null}
      </section>

      <section aria-labelledby="api-clients" className="flex flex-col gap-2">
        <h2 id="api-clients" className="font-semibold">
          {t("listTitle")}
        </h2>
        {initial.length === 0 ? <p className="text-muted text-sm">{t("none")}</p> : null}
        <ul className="flex flex-col gap-2">
          {initial.map((client) => (
            <li
              key={client.id}
              className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {client.name} <span className="text-muted font-mono text-xs">{client.clientId}</span>
                </p>
                <p className="text-muted text-xs">
                  {t("meta", {
                    owner: client.owner.displayName,
                    created: format.date(client.createdAt),
                    used: client.lastUsedAt ? format.dateTime(client.lastUsedAt) : t("neverUsed"),
                  })}
                </p>
                <p className="mt-1 flex flex-wrap gap-1">
                  {client.scopes.map((scope) => (
                    <Badge key={scope} tone="neutral">
                      {t(`scope.${scope.replace("b2b_", "").replace(".", "_")}`)}
                    </Badge>
                  ))}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={client.status === "active" ? "success" : "neutral"}>{t(`status.${client.status}`)}</Badge>
                {client.status === "active" ? (
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRevoking(client)}>
                    {t("revoke")}
                    <span className="sr-only"> {client.name}</span>
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Callout tone="info" title={t("webhooksTitle")}>
        {t("webhooksBody")}
      </Callout>

      <AlertDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        tone="destructive"
        title={t("revokeTitle", { name: revoking?.name ?? "" })}
        description={t("revokeBody")}
        confirmLabel={t("revoke")}
        cancelLabel={tCommon("actions.cancel")}
        onConfirm={() => {
          const client = revoking;
          setRevoking(null);
          if (client) void revoke(client);
        }}
      />
    </div>
  );
}
