"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  ConfirmAction,
  FormDialog,
  FormError,
  problemMessage,
  QueryError,
  Section,
  useCan,
} from "../console";
import { POSTCODE } from "./rates";

type Carrier = Schemas["CarrierDto"];
type Account = Schemas["CarrierAccountDto"];
type Quote = Schemas["CarrierQuoteDto"];
type Test = {
  carrier: Carrier;
  from: string;
  to: string;
  fromLat: string;
  fromLng: string;
  toLat: string;
  toLng: string;
  kg: string;
  result: Quote | null;
};

const coordinate = (text: string) => (text.trim() && Number.isFinite(Number(text)) ? Number(text) : null);

/**
 * How goods travel (D-013, D-114): the factory's own fleet by default, and the carriers Packio books
 * when a factory cannot serve a zone. Each carrier runs on Packio's account — only a reference to the
 * secret is kept here, never the credentials (D-005) — and is asked for quotes only when enabled.
 */
export function CarriersDesk() {
  const t = useTranslations("shipping.carriers");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canManage = useCan("carriers.manage");
  const [adding, setAdding] = useState<{ carrier: Carrier; label: string; ref: string; sandbox: boolean } | null>(null);
  const [deactivating, setDeactivating] = useState<Account | null>(null);
  const [testing, setTesting] = useState<Test | null>(null);
  const [asking, setAsking] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.list("admin", "carrier", {}),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/shipping/carriers")).data!,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "carrier") });
  const toggle = async (carrier: Carrier) => {
    const params = { path: { code: carrier.code } };
    try {
      if (carrier.enabled)
        await adminBrowserApis().contract.POST("/v1/admin/shipping/carriers/{code}/actions/disable", { params });
      else await adminBrowserApis().contract.POST("/v1/admin/shipping/carriers/{code}/actions/enable", { params });
      toast.success(t(carrier.enabled ? "disabled" : "enabled", { name: carrier.name }));
      refresh();
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    }
  };

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <div className="flex flex-col gap-4">
      {(query.data ?? []).map((carrier) => {
        const fleet = carrier.code === "factory_fleet";
        const active = carrier.accounts.filter((a) => a.active);
        return (
          <Section
            key={carrier.code}
            title={carrier.name}
            description={fleet ? t("fleetIntro") : t("fallbackIntro")}
            actions={
              <span className="flex flex-wrap items-center gap-2">
                <Badge tone={carrier.enabled ? "success" : "neutral"}>{t(carrier.enabled ? "on" : "off")}</Badge>
                {canManage && !fleet ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => void toggle(carrier)}>
                      {t(carrier.enabled ? "disable" : "enable")}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={active.length === 0}
                      onClick={() =>
                        setTesting({
                          carrier,
                          from: "",
                          to: "",
                          fromLat: "",
                          fromLng: "",
                          toLat: "",
                          toLng: "",
                          kg: "1",
                          result: null,
                        })
                      }
                    >
                      {t("test")}
                    </Button>
                    <Button
                      size="sm"
                      iconStart="plus"
                      onClick={() => setAdding({ carrier, label: "", ref: "", sandbox: true })}
                    >
                      {t("addAccount")}
                    </Button>
                  </>
                ) : null}
              </span>
            }
          >
            <p className="text-muted mb-2 text-xs">
              {t("supports")}: {carrier.supports.map((s) => t(`capabilities.${s}`)).join(" · ") || "—"}
            </p>
            {!fleet && carrier.enabled && active.length === 0 ? (
              <Callout tone="warning" title={t("noActiveAccount")} />
            ) : null}
            {carrier.accounts.length ? (
              <ul className="divide-border flex flex-col divide-y text-sm">
                {carrier.accounts.map((account) => (
                  <li key={account.id} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="font-medium">{account.label}</span>
                    <Badge size="sm" tone={account.sandbox ? "warning" : "info"}>
                      {t(account.sandbox ? "sandbox" : "production")}
                    </Badge>
                    <Badge size="sm" tone={account.active ? "success" : "neutral"}>
                      {t(account.active ? "active" : "inactive")}
                    </Badge>
                    <span className="text-muted text-xs">
                      {account.entityCode} · <When at={account.createdAt} />
                    </span>
                    {canManage && account.active ? (
                      <Button size="sm" variant="ghost" className="ms-auto" onClick={() => setDeactivating(account)}>
                        {t("deactivate")}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : !fleet ? (
              <p className="text-muted text-sm">{t("noAccounts")}</p>
            ) : null}
          </Section>
        );
      })}

      {adding ? (
        <FormDialog
          title={t("addTitle", { name: adding.carrier.name })}
          description={t("addIntro")}
          submitLabel={t("save")}
          onClose={() => setAdding(null)}
          onSubmit={async () => {
            if (adding.label.trim().length < 2 || adding.ref.trim().length < 3) throw new FormError(t("incomplete"));
            await adminBrowserApis().contract.POST("/v1/admin/shipping/carriers/{code}/accounts", {
              params: { path: { code: adding.carrier.code } },
              body: { label: adding.label.trim(), credentialsSecretRef: adding.ref.trim(), sandbox: adding.sandbox },
            });
            toast.success(t("accountAdded"));
            refresh();
          }}
        >
          <Field label={t("label")} required>
            <Input value={adding.label} onChange={(e) => setAdding({ ...adding, label: e.target.value })} />
          </Field>
          <Field label={t("secretRef")} hint={t("secretRefHint")} required>
            <Input
              className="font-mono"
              value={adding.ref}
              onChange={(e) => setAdding({ ...adding, ref: e.target.value })}
            />
          </Field>
          <Switch
            label={t("sandboxLabel")}
            checked={adding.sandbox}
            onCheckedChange={(sandbox) => setAdding({ ...adding, sandbox })}
          />
        </FormDialog>
      ) : null}

      {testing ? (
        <Dialog
          open
          size="lg"
          onOpenChange={(open) => !open && setTesting(null)}
          title={t("testTitle", { name: testing.carrier.name })}
          description={t("testIntro")}
          closeLabel={t("close")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setTesting(null)}>
                {t("close")}
              </Button>
              <Button type="submit" form="carrier-test" loading={asking}>
                {t("ask")}
              </Button>
            </>
          }
        >
          <form
            id="carrier-test"
            className="flex flex-col gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!POSTCODE.test(testing.from.trim()) || !POSTCODE.test(testing.to.trim()) || !(Number(testing.kg) > 0))
                return void toast.error(t("testIncomplete"));
              setAsking(true);
              try {
                const { data } = await adminBrowserApis().contract.POST(
                  "/v1/admin/shipping/carriers/{code}/actions/test-quote",
                  {
                    params: { path: { code: testing.carrier.code } },
                    body: {
                      from: {
                        postcode: testing.from.trim(),
                        lat: coordinate(testing.fromLat),
                        lng: coordinate(testing.fromLng),
                      },
                      to: {
                        postcode: testing.to.trim(),
                        lat: coordinate(testing.toLat),
                        lng: coordinate(testing.toLng),
                      },
                      parcels: [{ weightG: Math.round(Number(testing.kg) * 1000) }],
                    },
                  },
                );
                setTesting({ ...testing, result: data! });
              } catch (error) {
                toast.error(problemMessage(error, t("failed")));
              } finally {
                setAsking(false);
              }
            }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t("fromPostcode")} required>
                <Input
                  inputMode="numeric"
                  value={testing.from}
                  onChange={(e) => setTesting({ ...testing, from: e.target.value })}
                />
              </Field>
              <Field label={t("lat")}>
                <Input
                  inputMode="decimal"
                  value={testing.fromLat}
                  onChange={(e) => setTesting({ ...testing, fromLat: e.target.value })}
                />
              </Field>
              <Field label={t("lng")}>
                <Input
                  inputMode="decimal"
                  value={testing.fromLng}
                  onChange={(e) => setTesting({ ...testing, fromLng: e.target.value })}
                />
              </Field>
              <Field label={t("toPostcode")} required>
                <Input
                  inputMode="numeric"
                  value={testing.to}
                  onChange={(e) => setTesting({ ...testing, to: e.target.value })}
                />
              </Field>
              <Field label={t("lat")}>
                <Input
                  inputMode="decimal"
                  value={testing.toLat}
                  onChange={(e) => setTesting({ ...testing, toLat: e.target.value })}
                />
              </Field>
              <Field label={t("lng")}>
                <Input
                  inputMode="decimal"
                  value={testing.toLng}
                  onChange={(e) => setTesting({ ...testing, toLng: e.target.value })}
                />
              </Field>
            </div>
            <Field
              label={t("weight")}
              hint={testing.carrier.code === "deliveree" ? t("delivereeHint") : undefined}
              className="w-40"
            >
              <Input
                inputMode="decimal"
                value={testing.kg}
                onChange={(e) => setTesting({ ...testing, kg: e.target.value })}
              />
            </Field>
            {testing.result ? (
              <Callout
                tone="success"
                title={t("quoted", {
                  amount: format.thb(testing.result.amount),
                  days: testing.result.transitDays ?? "—",
                })}
              />
            ) : null}
          </form>
        </Dialog>
      ) : null}

      {deactivating ? (
        <ConfirmAction
          open
          onOpenChange={(open) => !open && setDeactivating(null)}
          title={t("deactivateTitle", { label: deactivating.label })}
          description={t("deactivateBody")}
          confirmLabel={t("deactivate")}
          tone="destructive"
          onConfirm={async () => {
            try {
              await adminBrowserApis().contract.POST(
                "/v1/admin/shipping/carriers/accounts/{accountId}/actions/deactivate",
                {
                  params: { path: { accountId: deactivating.id } },
                },
              );
              toast.success(t("deactivated"));
              refresh();
              setDeactivating(null);
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        />
      ) : null}
    </div>
  );
}
