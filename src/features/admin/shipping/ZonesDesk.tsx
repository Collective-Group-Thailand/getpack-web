"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Button } from "@/ui/components/Button";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, FormDialog, FormError, QueryError, useCan } from "../console";
import { POSTCODE } from "./rates";
import { CUSTOMER_SCHEME, readZones, useSchemes, type Zone } from "./zones";

type ZoneDraft = { id: string | null; code: string; nameTh: string; nameEn: string };
type Postcodes = { zone: Zone; text: string; etag: string };

/** As getpack-api validates them. */
const ZONE_CODE = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const SCHEME_CODE = /^[a-z][a-z0-9_:.-]*$/;

/** Postcodes typed or pasted any way — spaces, commas, new lines — as a sorted, unique list. */
export function postcodesFrom(text: string): { valid: string[]; invalid: string[] } {
  const tokens = [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ];
  return {
    valid: tokens.filter((x) => POSTCODE.test(x)).sort(),
    invalid: tokens.filter((x) => !POSTCODE.test(x)),
  };
}

/**
 * Shipping zones (D-013, D-114): a scheme per rate card — `customer_default` for what customers pay
 * and what factories are paid, one per carrier — and its zones, each a set of postcodes. A
 * postcode belongs to one zone of a scheme: putting it here takes it out of the other zone.
 */
export function ZonesDesk() {
  const t = useTranslations("shipping.zones");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canManage = useCan("zones.manage");
  const schemes = useSchemes();
  const [schemeId, setSchemeId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ZoneDraft | null>(null);
  const [scheme, setScheme] = useState<{ code: string; name: string } | null>(null);
  const [postcodes, setPostcodes] = useState<Postcodes | null>(null);
  const current =
    schemes.data?.find((s) => s.id === schemeId) ??
    schemes.data?.find((s) => s.code === CUSTOMER_SCHEME) ??
    schemes.data?.[0];
  const zones = useQuery({
    queryKey: queryKeys.list("admin", "zone", { schemeId: current?.id }),
    enabled: Boolean(current),
    queryFn: () => readZones(current!.id),
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "zone") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "zone_scheme") });
  };
  const readEtag = async (id: string) => {
    const { response } = await adminBrowserApis().contract.GET("/v1/admin/shipping/zones/{id}", {
      params: { path: { id } },
    });
    return response.headers.get("ETag") ?? "*";
  };
  const openPostcodes = async (zone: Zone) => {
    const [etag, { data }] = await Promise.all([
      readEtag(zone.id),
      adminBrowserApis().contract.GET("/v1/admin/shipping/zones/{id}/postcodes", { params: { path: { id: zone.id } } }),
    ]);
    setPostcodes({ zone, etag, text: data!.postcodes.join("\n") });
  };

  const columns: DataTableColumn<Zone>[] = [
    { id: "code", header: t("code"), cell: (row) => <span className="font-mono text-sm">{row.code}</span> },
    { id: "nameTh", header: t("nameTh"), cell: (row) => row.nameTh },
    { id: "nameEn", header: t("nameEn"), cell: (row) => row.nameEn },
    {
      id: "postcodes",
      header: t("postcodes"),
      numeric: true,
      cell: (row) => (
        <Button size="sm" variant="ghost" onClick={() => void openPostcodes(row)}>
          {t("postcodeCount", { count: row.postcodeCount, shown: format.number(row.postcodeCount) })}
        </Button>
      ),
    },
    { id: "updated", header: t("updated"), cell: (row) => <When at={row.updatedAt} /> },
    ...(canManage
      ? [
          {
            id: "actions",
            header: t("actions"),
            cell: (row: Zone) => (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setDraft({ id: row.id, code: row.code, nameTh: row.nameTh, nameEn: row.nameEn })}
              >
                {t("edit")}
              </Button>
            ),
          } satisfies DataTableColumn<Zone>,
        ]
      : []),
  ];

  if (schemes.isError) return <QueryError error={schemes.error} onRetry={() => void schemes.refetch()} />;
  const parsed = postcodes ? postcodesFrom(postcodes.text) : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("scheme")} hint={t("schemeHint")} className="w-80">
          <NativeSelect
            value={current?.id ?? ""}
            onValueChange={setSchemeId}
            options={(schemes.data ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))}
          />
        </Field>
        {canManage ? (
          <span className="ms-auto flex gap-2">
            <Button variant="ghost" iconStart="plus" onClick={() => setScheme({ code: "", name: "" })}>
              {t("addScheme")}
            </Button>
            <Button
              iconStart="plus"
              disabled={!current}
              onClick={() => setDraft({ id: null, code: "", nameTh: "", nameEn: "" })}
            >
              {t("addZone")}
            </Button>
          </span>
        ) : null}
      </div>
      {zones.isError ? (
        <QueryError error={zones.error} onRetry={() => void zones.refetch()} />
      ) : (
        <DataTable
          caption={t("title")}
          columns={columns}
          rows={zones.data ?? []}
          getRowId={(row) => row.id}
          loading={zones.isPending}
          rowTone={(row) => (row.postcodeCount === 0 ? "warning" : undefined)}
          empty={<EmptyState icon="map" title={t("empty")} />}
        />
      )}

      {draft && current ? (
        <FormDialog
          title={draft.id ? t("editTitle", { code: draft.code }) : t("addTitle", { scheme: current.code })}
          submitLabel={t("save")}
          onClose={() => setDraft(null)}
          onSubmit={async () => {
            const body = { code: draft.code.trim(), nameTh: draft.nameTh.trim(), nameEn: draft.nameEn.trim() };
            if (!ZONE_CODE.test(body.code) || !body.nameTh || !body.nameEn) throw new FormError(t("incomplete"));
            if (draft.id) {
              await adminBrowserApis().contract.PATCH("/v1/admin/shipping/zones/{id}", {
                params: { path: { id: draft.id }, header: { "If-Match": await readEtag(draft.id) } },
                body,
              });
            } else {
              await adminBrowserApis().contract.POST("/v1/admin/shipping/zones", {
                body: { ...body, schemeId: current.id },
              });
            }
            toast.success(t("saved"));
            refresh();
          }}
        >
          <Field label={t("code")} hint={t("codeHint")} required>
            <Input
              className="font-mono"
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            />
          </Field>
          <Field label={t("nameTh")} required>
            <Input value={draft.nameTh} onChange={(e) => setDraft({ ...draft, nameTh: e.target.value })} />
          </Field>
          <Field label={t("nameEn")} required>
            <Input value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} />
          </Field>
        </FormDialog>
      ) : null}

      {scheme ? (
        <FormDialog
          title={t("addSchemeTitle")}
          description={t("addSchemeIntro")}
          submitLabel={t("save")}
          onClose={() => setScheme(null)}
          onSubmit={async () => {
            if (!SCHEME_CODE.test(scheme.code.trim()) || !scheme.name.trim()) throw new FormError(t("incomplete"));
            const { data } = await adminBrowserApis().contract.POST("/v1/admin/shipping/zone-schemes", {
              body: { code: scheme.code.trim(), name: scheme.name.trim() },
            });
            toast.success(t("saved"));
            refresh();
            setSchemeId(data!.id);
          }}
        >
          <Field label={t("code")} hint={t("schemeCodeHint")} required>
            <Input
              className="font-mono"
              value={scheme.code}
              onChange={(e) => setScheme({ ...scheme, code: e.target.value })}
            />
          </Field>
          <Field label={t("schemeName")} required>
            <Input value={scheme.name} onChange={(e) => setScheme({ ...scheme, name: e.target.value })} />
          </Field>
        </FormDialog>
      ) : null}

      {postcodes && parsed ? (
        canManage ? (
          <FormDialog
            title={t("postcodesTitle", { code: postcodes.zone.code })}
            description={t("postcodesIntro")}
            submitLabel={t("savePostcodes", { count: parsed.valid.length })}
            onClose={() => setPostcodes(null)}
            onSubmit={async () => {
              if (parsed.invalid.length)
                throw new FormError(t("invalidPostcodes", { list: parsed.invalid.slice(0, 5).join(", ") }));
              await adminBrowserApis().contract.PUT("/v1/admin/shipping/zones/{id}/postcodes", {
                params: { path: { id: postcodes.zone.id }, header: { "If-Match": postcodes.etag } },
                body: { postcodes: parsed.valid },
              });
              toast.success(t("postcodesSaved", { count: parsed.valid.length }));
              refresh();
            }}
          >
            <Field
              label={t("postcodes")}
              hint={t("postcodesHint", { valid: parsed.valid.length, invalid: parsed.invalid.length })}
              error={
                parsed.invalid.length
                  ? t("invalidPostcodes", { list: parsed.invalid.slice(0, 5).join(", ") })
                  : undefined
              }
            >
              <Textarea
                rows={12}
                className="font-mono text-sm"
                value={postcodes.text}
                onChange={(e) => setPostcodes({ ...postcodes, text: e.target.value })}
              />
            </Field>
          </FormDialog>
        ) : (
          <FormDialog
            title={t("postcodesTitle", { code: postcodes.zone.code })}
            submitLabel={t("close")}
            onClose={() => setPostcodes(null)}
            onSubmit={async () => undefined}
          >
            <p className="font-mono text-sm break-words">{parsed.valid.join(", ") || t("noPostcodes")}</p>
          </FormDialog>
        )
      ) : null}
    </div>
  );
}
