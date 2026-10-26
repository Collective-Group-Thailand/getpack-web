"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRefresh } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { problemMessage } from "@/features/shared/actions";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Field } from "@/ui/components/Field";
import { FilePickButton } from "@/ui/components/FilePickButton";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";
import { uploadFile } from "@/features/shared/files/upload";

import { trimZeros } from "./format";

type Settings = Schemas["ErpSettingsDto"];
type Warehouse = Schemas["ErpWarehouseDto"];
const MODULES = [
  "inventory",
  "procurement",
  "partners",
  "planning",
  "floor",
  "sales",
  "accounting",
  "maintenance",
  "documents",
  "quality",
  "insight",
  "people",
] as const;
const PREFIXES = [
  "po",
  "gr",
  "adj",
  "trf",
  "iss",
  "pr",
  "ap",
  "pv",
  "mo",
  "rfq",
  "mt",
  "qt",
  "so",
  "do",
  "iv",
  "cn",
  "dr",
  "rc",
  "bn",
  "wht",
  "qc",
  "ncr",
] as const;
const POLICIES = ["off", "warn", "enforce"] as const;
/** Modules that exist today (E1 – E5); the rest are shown as coming and stay as they are. */
const LIVE = new Set<string>([
  "inventory",
  "procurement",
  "partners",
  "planning",
  "floor",
  "sales",
  "accounting",
  "maintenance",
  "documents",
  "quality",
  "insight",
  "people",
]);

/** The factory's ERP rules (D-318, D-322, D-323, D-325): modules, negative stock, over-receipt, prefixes. */
export function ErpSettingsForm({
  settings,
  etag,
  canEdit,
}: {
  settings: Settings;
  etag: string | null;
  canEdit: boolean;
}) {
  const t = useTranslations("partnerErp.settings");
  const tCommon = useTranslations("partnerErp.common");
  const tOps = useTranslations("partnerOps.settings");
  const { factoryId } = useFactory();
  const [refresh] = useRefresh();
  const [modules, setModules] = useState<string[]>(settings.modules);
  const [allowNegative, setAllowNegative] = useState(settings.allowNegativeStock);
  const [overReceipt, setOverReceipt] = useState(trimZeros(settings.overReceiptPct));
  const [tolerance, setTolerance] = useState(trimZeros(settings.priceTolerancePct));
  const [approval, setApproval] = useState(settings.requireRequestApproval);
  const [priceAlert, setPriceAlert] = useState(trimZeros(settings.priceAlertPct));
  const [quoteDays, setQuoteDays] = useState(String(settings.quoteExpiryDays));
  const [policy, setPolicy] = useState<Settings["supplierApproval"]>(settings.supplierApproval);
  const [prefixes, setPrefixes] = useState<Record<string, string>>(settings.prefixes);
  const tSales = useTranslations("partnerSales.settings");
  const [validDays, setValidDays] = useState(String(settings.quoteValidDays));
  const [signatory, setSignatory] = useState(settings.signatoryName ?? "");
  const [footer, setFooter] = useState(settings.documentFooter ?? "");
  const [bank, setBank] = useState(settings.bankDetails ?? "");
  const [logoId, setLogoId] = useState<string | null>(settings.documentLogoFileId);
  const [logoBusy, setLogoBusy] = useState(false);
  const [labour, setLabour] = useState(trimZeros(settings.labourRatePerHour));
  const [overhead, setOverhead] = useState(trimZeros(settings.overheadPct));
  const [oeeAlert, setOeeAlert] = useState(trimZeros(settings.oeeAlertPct));
  const [daily, setDaily] = useState(settings.dailySummary);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await browserApi().PATCH("/v1/partner/factories/{factoryId}/erp/settings", {
        params: { path: { factoryId }, header: { "If-Match": etag ?? "" } },
        body: {
          modules: modules as Settings["modules"],
          allowNegativeStock: allowNegative,
          overReceiptPct: overReceipt || "0",
          priceTolerancePct: tolerance || "0",
          requireRequestApproval: approval,
          priceAlertPct: priceAlert || "0",
          quoteExpiryDays: Math.max(0, Math.min(90, Number.parseInt(quoteDays || "0", 10) || 0)),
          supplierApproval: policy,
          prefixes: Object.fromEntries(Object.entries(prefixes).map(([k, v]) => [k, v.trim().toUpperCase()])),
          quoteValidDays: Math.max(1, Math.min(365, Number.parseInt(validDays || "30", 10) || 30)),
          signatoryName: signatory.trim() || null,
          documentFooter: footer.trim() || null,
          bankDetails: bank.trim() || null,
          documentLogoFileId: logoId,
          labourRatePerHour: labour || "0",
          overheadPct: overhead || "0",
          oeeAlertPct: oeeAlert || "0",
          dailySummary: daily,
        },
      });
      toast.success(tCommon("saved"));
      refresh();
    } catch (error) {
      if (isApiError(error)) setErrors(Object.fromEntries(error.errors.map((e) => [e.path, e.message])));
      const stale = isApiError(error) && error.status === 412;
      toast.error(stale ? tCommon("stale") : problemMessage(error, tCommon("failed")));
      if (stale) refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-6" noValidate>
      <p className="text-muted">{settings.vatRegistered ? t("vatRegistered") : t("vatNotRegistered")}</p>
      <fieldset className="flex flex-col gap-3" disabled={!canEdit}>
        <legend className="mb-1 text-lg font-semibold">{t("rules")}</legend>
        <Checkbox
          label={t("allowNegative")}
          description={t("allowNegativeHint")}
          checked={allowNegative}
          onCheckedChange={(checked) => setAllowNegative(checked === true)}
        />
        <div className="max-w-48">
          <Field label={t("overReceipt")} hint={t("overReceiptHint")} error={errors.overReceiptPct}>
            <NumberInput
              min={0}
              max={100}
              step="any"
              unit="%"
              value={overReceipt}
              onChange={(event) => setOverReceipt(event.target.value)}
            />
          </Field>
        </div>
        <Checkbox
          label={t("requireApproval")}
          description={t("requireApprovalHint")}
          checked={approval}
          onCheckedChange={(checked) => setApproval(checked === true)}
        />
        <div className="max-w-48">
          <Field label={t("priceTolerance")} hint={t("priceToleranceHint")} error={errors.priceTolerancePct}>
            <NumberInput
              min={0}
              max={100}
              step="any"
              unit="%"
              value={tolerance}
              onChange={(event) => setTolerance(event.target.value)}
            />
          </Field>
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-3" disabled={!canEdit}>
        <legend className="mb-1 text-lg font-semibold">{tOps("sourcingTitle")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tOps("priceAlertPct")} hint={tOps("priceAlertHint")} error={errors.priceAlertPct}>
            <NumberInput
              min={0}
              max={100}
              step="any"
              unit="%"
              value={priceAlert}
              onChange={(event) => setPriceAlert(event.target.value)}
            />
          </Field>
          <Field label={tOps("quoteExpiryDays")} hint={tOps("quoteExpiryHint")} error={errors.quoteExpiryDays}>
            <NumberInput
              min={0}
              max={90}
              step={1}
              unit={tOps("days")}
              value={quoteDays}
              onChange={(event) => setQuoteDays(event.target.value)}
            />
          </Field>
        </div>
        <SegmentedControl
          label={tOps("supplierApproval")}
          size="md"
          value={policy}
          onValueChange={setPolicy}
          options={POLICIES.map((p) => ({ value: p, label: tOps(`policies.${p}`) }))}
        />
        <p className="text-muted text-sm">{tOps("supplierApprovalHint")}</p>
      </fieldset>
      <fieldset className="flex flex-col gap-3" disabled={!canEdit}>
        <legend className="mb-1 text-lg font-semibold">{tSales("title")}</legend>
        <p className="text-muted text-sm">{tSales("body")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tSales("quoteValidDays")} hint={tSales("quoteValidDaysHint")} error={errors.quoteValidDays}>
            <NumberInput
              min={1}
              max={365}
              step={1}
              unit={tOps("days")}
              value={validDays}
              onChange={(event) => setValidDays(event.target.value)}
            />
          </Field>
          <Field label={tSales("signatory")} hint={tSales("signatoryHint")}>
            <Input value={signatory} onChange={(event) => setSignatory(event.target.value)} />
          </Field>
        </div>
        <Field label={tSales("bank")} hint={tSales("bankHint")}>
          <Textarea
            rows={2}
            value={bank}
            placeholder={tSales("bankPlaceholder")}
            onChange={(event) => setBank(event.target.value)}
          />
        </Field>
        <Field label={tSales("footer")} hint={tSales("footerHint")}>
          <Textarea
            rows={2}
            value={footer}
            placeholder={tSales("footerPlaceholder")}
            onChange={(event) => setFooter(event.target.value)}
          />
        </Field>
        <Field
          label={tSales("logo")}
          hint={logoId ? tSales("logoSet") : tSales("logoHint")}
          error={errors.documentLogoFileId}
        >
          <span className="flex flex-wrap items-center gap-2">
            <FilePickButton
              label={logoId ? tSales("logoReplace") : tSales("logoChoose")}
              accept="image/png,image/jpeg"
              icon="image"
              disabled={!canEdit}
              loading={logoBusy}
              onFiles={async ([file]) => {
                if (!file) return;
                setLogoBusy(true);
                try {
                  const uploaded = await uploadFile("partner", file, "document", { factoryId });
                  setLogoId(uploaded.id);
                  toast.success(tSales("logoUploaded"));
                } catch (error) {
                  toast.error(problemMessage(error, tCommon("failed")));
                } finally {
                  setLogoBusy(false);
                }
              }}
            />
            {logoId ? (
              <Button size="sm" variant="ghost" iconStart="trash" onClick={() => setLogoId(null)}>
                {tSales("logoRemove")}
              </Button>
            ) : null}
          </span>
        </Field>
      </fieldset>
      <fieldset className="flex flex-col gap-3" disabled={!canEdit}>
        <legend className="mb-1 text-lg font-semibold">{t("insight.title")}</legend>
        <p className="text-muted text-sm">{t("insight.body")}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("insight.labour")} hint={t("insight.labourHint")} error={errors.labourRatePerHour}>
            <NumberInput
              min={0}
              step="any"
              unit="฿"
              value={labour}
              onChange={(event) => setLabour(event.target.value)}
            />
          </Field>
          <Field label={t("insight.overhead")} hint={t("insight.overheadHint")} error={errors.overheadPct}>
            <NumberInput
              min={0}
              max={500}
              step="any"
              unit="%"
              value={overhead}
              onChange={(event) => setOverhead(event.target.value)}
            />
          </Field>
          <Field label={t("insight.oeeAlert")} hint={t("insight.oeeAlertHint")} error={errors.oeeAlertPct}>
            <NumberInput
              min={0}
              max={100}
              step="any"
              unit="%"
              value={oeeAlert}
              onChange={(event) => setOeeAlert(event.target.value)}
            />
          </Field>
        </div>
        <Checkbox
          label={t("insight.dailySummary")}
          description={t("insight.dailySummaryHint")}
          checked={daily}
          onCheckedChange={(checked) => setDaily(checked === true)}
        />
        <p className="text-muted text-sm">{t("insight.rates")}</p>
      </fieldset>
      <fieldset className="flex flex-col gap-3" disabled={!canEdit}>
        <legend className="mb-1 text-lg font-semibold">{t("prefixes")}</legend>
        <p className="text-muted text-sm">{t("prefixesHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PREFIXES.map((key) => (
            <Field key={key} label={t(`prefix.${key}`)} error={errors[`prefixes.${key}`]}>
              <Input
                maxLength={6}
                autoCapitalize="characters"
                value={prefixes[key] ?? ""}
                placeholder={key.toUpperCase()}
                onChange={(event) =>
                  setPrefixes({ ...prefixes, [key]: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })
                }
              />
            </Field>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-3" disabled={!canEdit}>
        <legend className="mb-1 text-lg font-semibold">{t("modules")}</legend>
        <p className="text-muted text-sm">{t("modulesHint")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODULES.map((key) => (
            <Checkbox
              key={key}
              label={t(`module.${key}`)}
              disabled={!LIVE.has(key)}
              checked={modules.includes(key)}
              onCheckedChange={(checked) =>
                setModules((current) =>
                  checked === true ? [...new Set([...current, key])] : current.filter((m) => m !== key),
                )
              }
            />
          ))}
        </div>
      </fieldset>
      {canEdit ? (
        <Button type="submit" size="xl" loading={busy} iconStart="save" className="self-start">
          {t("save")}
        </Button>
      ) : (
        <p className="text-muted text-sm">{t("ownerOnly")}</p>
      )}
    </form>
  );
}

/** The factory's warehouses (D-320): add one, rename by re-adding, make one main, archive the rest. */
export function WarehouseManager({ warehouses, canEdit }: { warehouses: Warehouse[]; canEdit: boolean }) {
  const t = useTranslations("partnerErp.settings");
  const tCommon = useTranslations("partnerErp.common");
  const { factoryId } = useFactory();
  const [refresh] = useRefresh();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!code.trim() || !name.trim()) return;
    setBusy("add");
    try {
      await browserApi().POST("/v1/partner/factories/{factoryId}/erp/warehouses", {
        params: { path: { factoryId } },
        body: { code: code.trim(), name: name.trim() },
      });
      toast.success(t("warehouseAdded", { name: name.trim() }));
      setCode("");
      setName("");
      refresh();
    } catch (error) {
      toast.error(problemMessage(error, tCommon("failed")));
    } finally {
      setBusy(null);
    }
  }

  async function patch(warehouse: Warehouse, body: { isDefault?: boolean; status?: "active" | "archived" }) {
    setBusy(warehouse.id);
    try {
      await browserApi().PATCH("/v1/partner/factories/{factoryId}/erp/warehouses/{warehouseId}", {
        params: {
          path: { factoryId, warehouseId: warehouse.id },
          // The API's ETag of a warehouse is its id and version; the list carries the version.
          header: { "If-Match": "*" },
        },
        body,
      });
      toast.success(tCommon("saved"));
      refresh();
    } catch (error) {
      toast.error(problemMessage(error, tCommon("failed")));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="border-border bg-surface divide-border divide-y rounded-xl border">
        {warehouses.map((warehouse) => (
          <li key={warehouse.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="font-medium">{warehouse.name}</span>{" "}
              <span className="text-muted text-sm tabular-nums">{warehouse.code}</span>
            </span>
            {warehouse.isDefault ? <Badge tone="primary">{t("default")}</Badge> : null}
            {warehouse.status === "archived" ? <Badge tone="neutral">{tCommon("archived")}</Badge> : null}
            {canEdit && !warehouse.isDefault ? (
              <span className="flex gap-2">
                {warehouse.status === "active" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busy === warehouse.id}
                    onClick={() => void patch(warehouse, { isDefault: true })}
                  >
                    {t("makeDefault")}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy === warehouse.id}
                  onClick={() =>
                    void patch(warehouse, { status: warehouse.status === "active" ? "archived" : "active" })
                  }
                >
                  {warehouse.status === "active" ? t("archive") : t("restore")}
                </Button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <form
          onSubmit={(event) => void add(event)}
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end"
        >
          <Field label={t("warehouseCode")}>
            <Input
              maxLength={20}
              value={code}
              placeholder={t("warehouseCodePlaceholder")}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
          </Field>
          <Field label={t("warehouseName")}>
            <Input
              value={name}
              placeholder={t("warehouseNamePlaceholder")}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Button type="submit" size="lg" iconStart="plus" loading={busy === "add"} className="h-11 md:h-10">
            {t("addWarehouse")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
