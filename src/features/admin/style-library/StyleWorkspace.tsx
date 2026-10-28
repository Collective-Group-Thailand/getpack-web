"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { USE_CASES } from "@/domain/style-use-cases";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { Pagination } from "@/ui/components/Pagination";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { Switch } from "@/ui/components/Switch";
import { Tabs } from "@/ui/components/Tabs";
import { toast } from "@/ui/components/Toast";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { uploadFile } from "@/features/shared/files/upload";

import { FileImage } from "../catalogue/FileImage";
import { adminBrowserApis, FormDialog, problemMessage, QueryError, Section, useCan, useProductTypes } from "../console";
import {
  type AdminStyleDetail,
  type AdminStyleVariant,
  LIBRARY_HREF,
  PUBLISH_REASONS,
  type PublishReason,
} from "./resources";
import { StyleCommercial } from "./StyleCommercial";
import { StyleLibraryNav } from "./StyleLibraryNav";

interface Loaded {
  style: AdminStyleDetail;
  etag: string;
}

async function readStyle(id: string): Promise<Loaded> {
  const { data, response } = await adminBrowserApis().contract.GET("/v1/admin/styles/{styleId}", {
    params: { path: { styleId: id } },
  });
  return { style: data!, etag: response.headers.get("ETag") ?? "" };
}

type Translate = ReturnType<typeof useTranslations>;
const word = (t: Translate, key: string, fallback: string) => (t.has(key) ? t(key) : fallback);

/** A variant's options in words: `ฝาบน ฝาเสียบสลับ · ก้นกล่อง ก้นล็อกอัตโนมัติ`, `none` left out. */
function optionsInWords(tStyles: Translate, options: Record<string, unknown>) {
  return Object.entries(options)
    .flatMap(([axis, value]) => {
      const values = (Array.isArray(value) ? value : [value]).map(String).filter((v) => v && v !== "none");
      return values.length
        ? [
            `${word(tStyles, `axes.${axis}`, axis)} ${values
              .map((v) => word(tStyles, `values.${axis}.${v}`, v))
              .join(" + ")}`,
          ]
        : [];
    })
    .join(" · ");
}

/**
 * One base of the style library (D-411): what stands between it and the storefront — names
 * approved by Marketing and by Prepress (D-212), Prepress's approval of its latest recipe (never by
 * whoever imported it), a product type, the reasons its variants are held back — each with the
 * sign-off that clears it for those who may give it; how it is shown (names, descriptions, use
 * cases, synonyms, featured, hidden, order — saved under `If-Match`); every variant with its
 * reasons and price path; and its recipes.
 */
export function StyleWorkspace({ styleId, storefront }: { styleId: string; storefront: string | null }) {
  const t = useTranslations("styleLibrary.detail");
  const tStyles = useTranslations("styles");
  const queryClient = useQueryClient();
  const key = queryKeys.detail("admin", "style", styleId);
  const query = useQuery({ queryKey: key, queryFn: () => readStyle(styleId) });
  const [tab, setTab] = useState("readiness");
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return null;
  const { style, etag } = query.data;

  // A sign-off or a save answers the base, but not its new ETag: read it again for the next If-Match.
  const changed = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "style") });
  };
  const shown = style.variants.publishable;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("library"), href: LIBRARY_HREF }, { label: style.code }]}
          />
        }
        title={style.nameTh}
        description={style.nameEn}
        meta={
          <>
            <span className="text-muted text-sm tabular-nums">{style.code}</span>
            <Badge tone={shown > 0 ? "success" : "warning"}>
              {shown > 0 ? t("shownCount", { shown, total: style.variants.active }) : t("notShown")}
            </Badge>
            {style.featured ? <Badge tone="primary">{t("featured")}</Badge> : null}
            {style.hidden ? <Badge tone="warning">{t("hidden")}</Badge> : null}
            {style.status === "retired" ? <Badge>{t("retired")}</Badge> : null}
          </>
        }
        actions={
          storefront && shown > 0 ? (
            <Button asChild variant="secondary" iconEnd="external">
              <a href={`${storefront}/styles/${style.code.toLowerCase()}`} target="_blank" rel="noreferrer">
                {t("openStorefront")}
              </a>
            </Button>
          ) : null
        }
      />
      <StyleLibraryNav />
      <Tabs
        label={t("tabsLabel")}
        value={tab}
        onValueChange={setTab}
        items={[
          {
            value: "readiness",
            label: t("tabs.readiness"),
            content: <Readiness style={style} onChanged={changed} onReason={() => setTab("variants")} />,
          },
          {
            value: "storefront",
            label: t("tabs.storefront"),
            content: (
              <>
                <div className="pt-4">
                  <PhotoPanel key={`photo-${style.version}`} style={style} etag={etag} onChanged={changed} />
                </div>
                <Curation key={style.version} style={style} etag={etag} onChanged={changed} />
              </>
            ),
          },
          {
            value: "commercial",
            label: t("tabs.commercial"),
            content: (
              <StyleCommercial key={`commercial-${style.version}`} style={style} etag={etag} onChanged={changed} />
            ),
          },
          {
            value: "variants",
            label: t("tabs.variants", { count: style.variants.total }),
            content: <Variants styleId={style.id} reasons={style.reasonCounts} tStyles={tStyles} />,
          },
          {
            value: "recipes",
            label: t("tabs.recipes", { count: style.recipes.length }),
            content: <Recipes style={style} onChanged={changed} />,
          },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------------- readiness */

function Readiness({
  style,
  onChanged,
  onReason,
}: {
  style: AdminStyleDetail;
  onChanged: () => void;
  onReason: () => void;
}) {
  const t = useTranslations("styleLibrary.detail");
  const tStyles = useTranslations("styles");
  const tReasons = useTranslations("styleLibrary.reasons");
  const format = useFormat();
  const canNames = useCan("styles.approve_names");
  const canRecipe = useCan("styles.approve_recipe");
  const canReference = useCan("styles.verify_reference");
  const types = useProductTypes();
  const [reference, setReference] = useState<string | null>(null);
  const latest = style.recipes[0] ?? null;

  const approveNames = useMutation({
    mutationFn: async (as: Schemas["StyleNameApproverRole"]) =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/styles/{styleId}/actions/approve-names", {
          params: { path: { styleId: style.id } },
          body: { as },
        })
      ).data,
    onSuccess: () => {
      toast.success(t("namesApproved"));
      onChanged();
    },
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });
  const approveRecipe = useMutation({
    mutationFn: async (recipeId: string) =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/styles/{styleId}/recipes/{recipeId}/actions/approve", {
          params: { path: { styleId: style.id, recipeId } },
        })
      ).data,
    onSuccess: () => {
      toast.success(t("recipeApprovedToast"));
      onChanged();
    },
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });

  const rows: { key: string; done: boolean; label: string; detail: React.ReactNode; action?: React.ReactNode }[] = [
    {
      key: "marketing",
      done: Boolean(style.namesApproval.marketingAt),
      label: t("check.namesMarketing"),
      detail: style.namesApproval.marketingAt ? <When at={style.namesApproval.marketingAt} /> : t("check.waiting"),
      action:
        canNames && !style.namesApproval.marketingAt ? (
          <Button size="sm" loading={approveNames.isPending} onClick={() => approveNames.mutate("marketing")}>
            {t("approveAsMarketing")}
          </Button>
        ) : undefined,
    },
    {
      key: "prepress",
      done: Boolean(style.namesApproval.prepressAt),
      label: t("check.namesPrepress"),
      detail: style.namesApproval.prepressAt ? <When at={style.namesApproval.prepressAt} /> : t("check.waiting"),
      action:
        canNames && !style.namesApproval.prepressAt ? (
          <Button size="sm" loading={approveNames.isPending} onClick={() => approveNames.mutate("prepress")}>
            {t("approveAsPrepress")}
          </Button>
        ) : undefined,
    },
    {
      key: "recipe",
      done: style.recipeApproved,
      label: t("check.recipe"),
      detail: latest
        ? latest.approvedAt
          ? t("check.recipeApproved", { version: latest.version })
          : t("check.recipeWaiting", { version: latest.version })
        : t("check.noRecipe"),
      action:
        canRecipe && latest && !latest.approvedAt ? (
          <Button size="sm" loading={approveRecipe.isPending} onClick={() => approveRecipe.mutate(latest.id)}>
            {t("approveRecipe", { version: latest.version })}
          </Button>
        ) : undefined,
    },
    {
      key: "productType",
      done: Boolean(style.productTypeCode),
      label: t("check.productType"),
      detail: style.productTypeCode ? types.labelOf(style.productTypeCode) : t("check.noProductType"),
    },
    {
      key: "reference",
      // A style without an international code needs nothing here.
      done: Boolean(style.referenceVerifiedAt) || !style.referenceCode,
      label: t("check.reference"),
      detail: style.referenceVerifiedAt
        ? t("check.referenceVerified", { code: style.referenceCode ?? "" })
        : style.referenceCode
          ? t("check.referenceToVerify", { code: style.referenceCode })
          : t("check.noReference"),
      action:
        canReference && style.referenceCode && !style.referenceVerifiedAt ? (
          <Button size="sm" variant="secondary" onClick={() => setReference("")}>
            {t("verifyReference")}
          </Button>
        ) : undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-5 pt-4">
      <Section title={t("readinessTitle")} description={t("readinessIntro")}>
        <ul className="divide-border flex flex-col divide-y">
          {rows.map((row) => (
            <li key={row.key} className="flex flex-wrap items-center gap-3 py-3">
              <Badge tone={row.done ? "success" : "warning"} icon={row.done ? "check" : "clock"}>
                {row.done ? t("check.done") : t("check.open")}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{row.label}</p>
                <p className="text-muted text-sm">{row.detail}</p>
              </div>
              {row.action}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("reasonsTitle")} description={t("reasonsIntro")}>
        {style.reasonCounts.length === 0 ? (
          <p className="text-success text-sm">{t("noReasons", { count: style.variants.publishable })}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {style.reasonCounts.map((r) => (
              <li key={r.reason} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>
                  <span className="font-medium">{tReasons(`${r.reason}.label`)}</span>
                  <span className="text-muted"> — {tReasons(`${r.reason}.fix`)}</span>
                </span>
                <button type="button" className="text-primary tabular-nums hover:underline" onClick={onReason}>
                  {t("reasonCount", { count: format.number(r.count) })}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("factsTitle")}>
        <DescriptionList
          columns={2}
          items={[
            { term: t("facts.category"), description: word(tStyles, `categories.${style.category}`, style.category) },
            { term: t("facts.family"), description: word(tStyles, `families.${style.family}`, style.family) },
            {
              term: t("facts.material"),
              description: word(tStyles, `materialClasses.${style.materialClass}`, style.materialClass),
            },
            { term: t("facts.wave"), description: String(style.wave) },
            {
              term: t("facts.axes"),
              description: style.variantAxes.map((a) => word(tStyles, `axes.${a}`, a)).join(", ") || "—",
            },
            { term: t("facts.sourceType"), description: style.sourceProductType },
            { term: t("facts.construction"), description: style.construction },
            { term: t("facts.published"), description: <When at={style.publishedAt} /> },
          ]}
        />
      </Section>

      {reference !== null ? (
        <FormDialog
          title={t("verifyReference")}
          description={t("verifyReferenceIntro", { code: style.referenceCode ?? "" })}
          submitLabel={t("verifyReference")}
          onClose={() => setReference(null)}
          onSubmit={async () => {
            await adminBrowserApis().contract.POST("/v1/admin/styles/{styleId}/actions/verify-reference", {
              params: { path: { styleId: style.id } },
              body: { referenceCode: reference.trim() },
            });
            toast.success(t("referenceVerified"));
            onChanged();
          }}
        >
          <Field label={t("referenceCode")} hint={t("referenceHint")} required>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} autoFocus />
          </Field>
        </FormDialog>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------------- curation */

interface Synonym {
  locale: "th" | "en";
  term: string;
}

/**
 * The photo on the style's card (D-426): a photograph uploaded here replaces the AI-rendered
 * reference on the card, the variant cards and the configurator preview; removing it puts the
 * rendered thumbnail back. Its own saves (`setPhoto` / `clearPhoto`), outside the curation form,
 * because a photo is placed in one move, not typed in with the names.
 */
function PhotoPanel({ style, etag, onChanged }: { style: AdminStyleDetail; etag: string; onChanged: () => void }) {
  const t = useTranslations("styleLibrary.photo");
  const canCurate = useCan("styles.curate");
  const [busy, setBusy] = useState(false);
  const photo = style.photo;

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    try {
      await work();
      toast.success(t("saved"));
      onChanged();
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(false);
    }
  }
  const headers = { "If-Match": etag };

  return (
    <Section title={t("title")} description={t("intro")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {photo ? (
          <div className="relative w-full shrink-0 sm:w-56">
            <FileImage fileId={photo.fileId} alt={photo.alt.th} className="aspect-square w-full rounded-md" />
            <div className="absolute start-2 top-2">
              {photo.source === "ai-render" ? (
                <Badge tone="warning">{t("sourceRender")}</Badge>
              ) : (
                <Badge tone="success">{t("sourcePhoto")}</Badge>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-bg-subtle text-muted flex aspect-square w-full shrink-0 items-center justify-center rounded-md text-sm sm:w-56">
            {t("none")}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {photo?.source === "ai-render" ? <Callout tone="info" title={t("renderHint")} /> : null}
          {canCurate ? (
            <>
              <FileDropzone
                accept="image/png,image/jpeg,image/webp"
                maxBytes={20 * 1024 * 1024}
                disabled={busy}
                onFiles={async ([file]) => {
                  if (!file) return;
                  await run(async () => {
                    const uploaded = await uploadFile("admin", file, "image");
                    await adminBrowserApis().contract.PUT("/v1/admin/styles/{styleId}/photo", {
                      params: { path: { styleId: style.id }, header: headers },
                      body: { fileId: uploaded.id },
                    });
                  });
                }}
                labels={{
                  prompt: busy ? t("uploading") : t("drop"),
                  browse: t("browse"),
                  tooLarge: (name) => t("tooLarge", { name }),
                  wrongType: (name) => t("wrongType", { name }),
                }}
              />
              {photo ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      adminBrowserApis().contract.DELETE("/v1/admin/styles/{styleId}/photo", {
                        params: { path: { styleId: style.id }, header: headers },
                      }),
                    )
                  }
                >
                  {t("remove")}
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

function Curation({ style, etag, onChanged }: { style: AdminStyleDetail; etag: string; onChanged: () => void }) {
  const t = useTranslations("styleLibrary.curation");
  const tStyles = useTranslations("styles");
  const canCurate = useCan("styles.curate");
  const types = useProductTypes();
  const [values, setValues] = useState({
    nameTh: style.nameTh,
    nameEn: style.nameEn,
    descriptionTh: style.descriptionTh ?? "",
    descriptionEn: style.descriptionEn ?? "",
    productTypeCode: style.productTypeCode ?? "",
    featured: style.featured,
    hidden: style.hidden,
    sort: style.sort,
    useCases: [...style.useCases],
    synonyms: style.synonyms.map((s) => ({ locale: s.locale as Synonym["locale"], term: s.term })),
  });
  const [synonym, setSynonym] = useState<Synonym>({ locale: "th", term: "" });
  const set = <K extends keyof typeof values>(field: K, value: (typeof values)[K]) =>
    setValues((current) => ({ ...current, [field]: value }));
  const namesChange = values.nameTh !== style.nameTh || values.nameEn !== style.nameEn;

  const save = useMutation({
    mutationFn: async () => {
      const { data } = await adminBrowserApis().contract.PATCH("/v1/admin/styles/{styleId}", {
        params: { path: { styleId: style.id }, header: { "If-Match": etag } },
        body: {
          nameTh: values.nameTh.trim(),
          nameEn: values.nameEn.trim(),
          descriptionTh: values.descriptionTh.trim() || null,
          descriptionEn: values.descriptionEn.trim() || null,
          productTypeCode: values.productTypeCode || null,
          featured: values.featured,
          hidden: values.hidden,
          sort: values.sort,
          useCases: values.useCases,
          synonyms: values.synonyms,
        },
      });
      return data;
    },
    onSuccess: () => {
      toast.success(t("saved"));
      onChanged();
    },
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });

  const known = new Set<string>(USE_CASES);
  const useCases = [...USE_CASES, ...values.useCases.filter((u) => !known.has(u))];

  return (
    <form
      className="flex flex-col gap-5 pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {!canCurate ? <Callout tone="info" title={t("readOnly")} /> : null}
      <Section title={t("namesTitle")} description={t("namesIntro")}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("nameTh")} required>
            <Input value={values.nameTh} disabled={!canCurate} onChange={(e) => set("nameTh", e.target.value)} />
          </Field>
          <Field label={t("nameEn")} required>
            <Input value={values.nameEn} disabled={!canCurate} onChange={(e) => set("nameEn", e.target.value)} />
          </Field>
          <Field label={t("descriptionTh")} hint={t("descriptionHint")}>
            <Textarea
              rows={4}
              value={values.descriptionTh}
              disabled={!canCurate}
              onChange={(e) => set("descriptionTh", e.target.value)}
            />
          </Field>
          <Field label={t("descriptionEn")}>
            <Textarea
              rows={4}
              value={values.descriptionEn}
              disabled={!canCurate}
              onChange={(e) => set("descriptionEn", e.target.value)}
            />
          </Field>
        </div>
        {namesChange ? <Callout tone="warning" className="mt-3" title={t("namesReset")} /> : null}
      </Section>

      <Section title={t("showingTitle")} description={t("showingIntro")}>
        <div className="grid gap-4 md:grid-cols-3">
          <Switch
            label={t("featured")}
            description={t("featuredHint")}
            checked={values.featured}
            disabled={!canCurate}
            onCheckedChange={(checked) => set("featured", checked)}
          />
          <Switch
            label={t("hidden")}
            description={t("hiddenHint")}
            checked={values.hidden}
            disabled={!canCurate}
            onCheckedChange={(checked) => set("hidden", checked)}
          />
          <Field label={t("sort")} hint={t("sortHint")}>
            <NumberInput
              value={values.sort}
              disabled={!canCurate}
              min={0}
              onChange={(e) => set("sort", Number(e.target.value) || 0)}
            />
          </Field>
          <Field label={t("productType")} hint={t("productTypeHint")}>
            <SearchableSelect
              value={values.productTypeCode || undefined}
              disabled={!canCurate}
              placeholder={t("productTypeNone")}
              onValueChange={(value) => set("productTypeCode", value)}
              options={types.options}
            />
          </Field>
        </div>
      </Section>

      <Section title={t("useCasesTitle")} description={t("useCasesIntro")}>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {useCases.map((code) => (
            <li key={code}>
              <Checkbox
                label={word(tStyles, `useCases.${code}`, code)}
                checked={values.useCases.includes(code)}
                disabled={!canCurate}
                onCheckedChange={(checked) =>
                  set(
                    "useCases",
                    checked ? [...values.useCases, code].sort() : values.useCases.filter((u) => u !== code),
                  )
                }
              />
            </li>
          ))}
        </ul>
        <p className="text-muted mt-3 text-xs">{t("useCasesImport")}</p>
      </Section>

      <Section title={t("synonymsTitle")} description={t("synonymsIntro")}>
        <ul className="flex flex-wrap gap-2">
          {values.synonyms.length === 0 ? <li className="text-muted text-sm">{t("noSynonyms")}</li> : null}
          {values.synonyms.map((s, index) => (
            <li key={`${s.locale}:${s.term}`}>
              <Badge size="md">
                <span className="text-muted me-1 uppercase">{s.locale}</span>
                {s.term}
                {canCurate ? (
                  <button
                    type="button"
                    className="ms-1.5"
                    aria-label={t("removeSynonym", { term: s.term })}
                    onClick={() =>
                      set(
                        "synonyms",
                        values.synonyms.filter((_, i) => i !== index),
                      )
                    }
                  >
                    ×
                  </button>
                ) : null}
              </Badge>
            </li>
          ))}
        </ul>
        {canCurate ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Field label={t("synonymLocale")} className="w-28">
              <SearchableSelect
                value={synonym.locale}
                onValueChange={(value) => setSynonym((s) => ({ ...s, locale: value as Synonym["locale"] }))}
                options={[
                  { value: "th", label: t("thai") },
                  { value: "en", label: t("english") },
                ]}
              />
            </Field>
            <Field label={t("synonymTerm")} className="min-w-56 flex-1">
              <Input value={synonym.term} onChange={(e) => setSynonym((s) => ({ ...s, term: e.target.value }))} />
            </Field>
            <Button
              type="button"
              variant="secondary"
              disabled={!synonym.term.trim()}
              onClick={() => {
                const term = synonym.term.trim();
                if (!values.synonyms.some((s) => s.locale === synonym.locale && s.term === term))
                  set("synonyms", [...values.synonyms, { locale: synonym.locale, term }]);
                setSynonym((s) => ({ ...s, term: "" }));
              }}
            >
              {t("addSynonym")}
            </Button>
          </div>
        ) : null}
      </Section>

      {canCurate ? (
        <div className="flex justify-end">
          <Button type="submit" loading={save.isPending}>
            {t("save")}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

/* -------------------------------------------------------------------------------- variants */

function Variants({
  styleId,
  reasons,
  tStyles,
}: {
  styleId: string;
  reasons: AdminStyleDetail["reasonCounts"];
  tStyles: Translate;
}) {
  const t = useTranslations("styleLibrary.variants");
  const tReasons = useTranslations("styleLibrary.reasons");
  const tPrice = useTranslations("styleLibrary.priceReasons");
  const tList = useTranslations("console.list");
  const format = useFormat();
  const [reason, setReason] = useState<PublishReason | "all">("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [q, setQ] = useState("");
  const query = useQuery({
    queryKey: queryKeys.list("admin", "style_variant", { styleId, reason, page, perPage, q }),
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/styles/{styleId}/variants", {
          params: {
            path: { styleId },
            query: { page, perPage, ...(reason === "all" ? {} : { reason }), ...(q.trim() ? { q: q.trim() } : {}) },
          },
        })
      ).data!,
  });
  const columns: DataTableColumn<AdminStyleVariant>[] = [
    { id: "code", header: t("code"), cell: (row) => <span className="text-sm tabular-nums">{row.code}</span> },
    {
      id: "options",
      header: t("options"),
      cell: (row) => <span className="text-sm">{optionsInWords(tStyles, row.options) || "—"}</span>,
    },
    {
      id: "shown",
      header: t("shown"),
      cell: (row) =>
        row.publishable ? (
          <Badge tone="success" size="sm" icon="check">
            {t("yes")}
          </Badge>
        ) : (
          <span className="flex flex-wrap gap-1">
            {row.reasons.map((r) => (
              <Badge key={r} tone="warning" size="sm">
                {tReasons(`${r}.label`)}
              </Badge>
            ))}
          </span>
        ),
    },
    {
      id: "price",
      header: t("price"),
      cell: (row) => (
        <div>
          <Badge tone={row.pricePath === "instant" ? "success" : "info"} size="sm">
            {t(`pricePath.${row.pricePath}`)}
          </Badge>
          {row.priceReasons.length ? (
            <p className="text-muted mt-1 text-xs">{row.priceReasons.map((r) => tPrice(r)).join(", ")}</p>
          ) : null}
        </div>
      ),
    },
  ];
  const data = query.data;
  return (
    <div className="flex flex-col gap-3 pt-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("reason")} className="min-w-56">
          <SearchableSelect
            value={reason}
            onValueChange={(value) => {
              setReason(value as PublishReason | "all");
              setPage(1);
            }}
            options={[
              { value: "all", label: t("allReasons") },
              ...PUBLISH_REASONS.filter((r) => reasons.some((x) => x.reason === r)).map((r) => ({
                value: r,
                label: `${tReasons(`${r}.label`)} (${format.number(reasons.find((x) => x.reason === r)?.count ?? 0)})`,
              })),
            ]}
          />
        </Field>
        <Field label={t("search")} className="min-w-56">
          <Input
            type="search"
            value={q}
            placeholder={t("searchPlaceholder")}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </Field>
      </div>
      {query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          caption={t("title")}
          columns={columns}
          rows={data?.data ?? []}
          getRowId={(row) => row.id}
          loading={query.isPending}
          empty={<EmptyState icon="layers" title={t("empty")} />}
        />
      )}
      {data && data.meta.total > 0 ? (
        <Pagination
          page={data.meta.page}
          perPage={perPage}
          total={data.meta.total}
          onPageChange={setPage}
          onPerPageChange={(next) => {
            setPerPage(next);
            setPage(1);
          }}
          labels={{
            nav: tList("pagination"),
            previous: tList("previous"),
            next: tList("next"),
            range: (from, to, total) =>
              tList("range", { from: format.number(from), to: format.number(to), total: format.number(total) }),
            pageOf: (current, pages) => tList("pageOf", { page: format.number(current), pages: format.number(pages) }),
            perPage: tList("perPage"),
          }}
        />
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------------------------- recipes */

function Recipes({ style, onChanged }: { style: AdminStyleDetail; onChanged: () => void }) {
  const t = useTranslations("styleLibrary.recipes");
  const canApprove = useCan("styles.approve_recipe");
  const approve = useMutation({
    mutationFn: async (recipeId: string) =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/styles/{styleId}/recipes/{recipeId}/actions/approve", {
          params: { path: { styleId: style.id, recipeId } },
        })
      ).data,
    onSuccess: () => {
      toast.success(t("approved"));
      onChanged();
    },
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });
  const columns: DataTableColumn<AdminStyleDetail["recipes"][number]>[] = [
    { id: "version", header: t("version"), numeric: true, cell: (row) => `v${row.version}` },
    { id: "created", header: t("imported"), cell: (row) => <When at={row.createdAt} /> },
    { id: "processes", header: t("processes"), cell: (row) => row.processes.join(", ") || "—" },
    {
      id: "checksum",
      header: t("checksum"),
      hideable: true,
      cell: (row) => <span className="text-muted text-xs tabular-nums">{row.checksum.slice(0, 12)}</span>,
    },
    {
      id: "approved",
      header: t("status"),
      cell: (row) =>
        row.approvedAt ? (
          <span className="text-sm">
            <Badge tone="success" size="sm" icon="check">
              {t("approvedBadge")}
            </Badge>{" "}
            <When at={row.approvedAt} />
          </span>
        ) : canApprove ? (
          <Button size="sm" loading={approve.isPending} onClick={() => approve.mutate(row.id)}>
            {t("approve")}
          </Button>
        ) : (
          <Badge tone="warning" size="sm">
            {t("waiting")}
          </Badge>
        ),
    },
  ];
  return (
    <div className="flex flex-col gap-3 pt-4">
      <p className="text-muted text-sm">{t("intro")}</p>
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={style.recipes}
        getRowId={(row) => row.id}
        empty={<EmptyState icon="document" title={t("empty")} />}
      />
    </div>
  );
}
