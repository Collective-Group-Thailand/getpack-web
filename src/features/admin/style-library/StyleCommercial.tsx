"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage, Section, useCan } from "../console";
import {
  CERTIFICATION_CODE,
  type CommercialForm,
  DIMENSIONS,
  dimensionLabelKey,
  dimensionSources,
  type FitSource,
  fitChanged,
  formOf,
  type FormError,
  sizeSearchApplies,
  toCommercial,
  type Tri,
} from "./commercial-form";
import { type AdminStyleDetail } from "./resources";

const SOURCE_TONE: Record<FitSource, "neutral" | "primary" | "info" | "accent" | "success"> = {
  business: "success",
  recipe: "primary",
  standard_sizes: "info",
  production_envelope: "accent",
  combined: "neutral",
};

/**
 * The style's commercial fields (styles redesign C0, C1c — DECISIONS-STAGE-A §11.1, §11.5): the
 * inside fit range per dimension with where each came from (the recipe, standard sizes, the
 * production envelope, or the business), MOQ, recyclable, plastic-free and certification codes.
 * Saved with the curation PATCH under `If-Match` (`styles.curate`); a changed range becomes business
 * data, which the backfill never overwrites. C1e (§13.2): the style's size class (set by the backfill)
 * names the dimensions — a bag's width × gusset × height, a round style's diameter × height — and a
 * style whose size search does not apply shows "ไม่ใช้กับการค้นหาด้วยขนาด" instead of a range.
 */
export function StyleCommercial({
  style,
  etag,
  onChanged,
}: {
  style: AdminStyleDetail;
  etag: string;
  onChanged: () => void;
}) {
  const t = useTranslations("styleLibrary.commercial");
  const canCurate = useCan("styles.curate");
  const [form, setForm] = useState<CommercialForm>(() => formOf(style.commercial));
  const [certification, setCertification] = useState("");
  const [errors, setErrors] = useState<FormError[]>([]);
  const sources = dimensionSources(style);
  const willBecomeBusiness = style.fitRangeSource !== "business" && fitChanged(form, style.commercial);

  const save = useMutation({
    mutationFn: async () => {
      const result = toCommercial(form);
      if (result.value === null) {
        setErrors(result.errors);
        throw new Error("invalid");
      }
      setErrors([]);
      const { data } = await adminBrowserApis().contract.PATCH("/v1/admin/styles/{styleId}", {
        params: { path: { styleId: style.id }, header: { "If-Match": etag } },
        body: { commercial: result.value },
      });
      return data;
    },
    onSuccess: () => {
      toast.success(t("saved"));
      onChanged();
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "invalid") return;
      toast.error(problemMessage(error, t("failed")));
    },
  });

  const errorOf = (field: string) => {
    const e = errors.find((x) => x.field === field);
    return e ? t(`errors.${e.code}`) : undefined;
  };
  const setFit = (key: keyof CommercialForm["fit"], value: string) =>
    setForm((f) => ({ ...f, fit: { ...f.fit, [key]: value } }));
  const triOptions = [
    { value: "unknown" as Tri, label: t("tri.unknown") },
    { value: "yes" as Tri, label: t("tri.yes") },
    { value: "no" as Tri, label: t("tri.no") },
  ];
  const addCertification = () => {
    const code = certification.trim().toLowerCase();
    if (!code || form.certifications.includes(code)) return setCertification("");
    setForm((f) => ({ ...f, certifications: [...f.certifications, code] }));
    setCertification("");
  };

  return (
    <form
      className="flex flex-col gap-5 pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
      data-testid="style-commercial"
    >
      {!canCurate ? <Callout tone="info" title={t("readOnly")} /> : null}
      <Section title={t("fitTitle")} description={t("fitIntro")}>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm" data-size-class={style.sizeClass}>
          <span className="text-muted text-xs">{t("sizeClassLabel")}</span>
          <Badge tone={style.sizeClass === "not_applicable" ? "neutral" : "info"}>
            {t(`sizeClass.${style.sizeClass}`)}
          </Badge>
          <span className="text-muted text-xs">{t(`sizeClassRule.${style.sizeClass}`)}</span>
        </div>
        {!sizeSearchApplies(style.sizeClass) ? (
          <Callout tone="info" title={t("notApplicableTitle")} data-testid="size-search-not-applicable">
            {t("notApplicable")}
            {sources.length.source === "business" ? <> {t("notApplicableKept")}</> : null}
          </Callout>
        ) : (
          <div className="flex flex-col gap-4">
            {DIMENSIONS.map(({ dim, min, max }) => {
              const source = sources[dim];
              return (
                <fieldset key={dim} className="grid items-end gap-3 md:grid-cols-[10rem_1fr_1fr_minmax(0,1.4fr)]">
                  <legend className="sr-only">{t(`dimensions.${dimensionLabelKey(style.sizeClass, dim)}`)}</legend>
                  <p className="text-sm font-medium md:pb-2.5" aria-hidden="true">
                    {t(`dimensions.${dimensionLabelKey(style.sizeClass, dim)}`)}
                  </p>
                  <Field label={t("min")} error={errorOf(min)}>
                    <NumberInput
                      unit="mm"
                      min={1}
                      max={5000}
                      step={1}
                      value={form.fit[min]}
                      disabled={!canCurate}
                      onChange={(e) => setFit(min, e.target.value)}
                    />
                  </Field>
                  <Field label={t("max")} error={errorOf(max) ?? errorOf(dim)}>
                    <NumberInput
                      unit="mm"
                      min={1}
                      max={5000}
                      step={1}
                      value={form.fit[max]}
                      disabled={!canCurate}
                      onChange={(e) => setFit(max, e.target.value)}
                    />
                  </Field>
                  <div className="flex flex-wrap items-center gap-1.5 md:pb-2" data-source={source.source ?? "none"}>
                    <span className="text-muted text-xs">{t("source")}</span>
                    {source.source ? (
                      <Badge tone={SOURCE_TONE[source.source]}>{t(`sources.${source.source}`)}</Badge>
                    ) : (
                      <Badge>{t("sources.none")}</Badge>
                    )}
                    {source.basis.map((b) => (
                      <span key={b} className="text-muted text-xs">
                        {t(`basis.${b}`)}
                      </span>
                    ))}
                  </div>
                </fieldset>
              );
            })}
          </div>
        )}
        {willBecomeBusiness && sizeSearchApplies(style.sizeClass) ? (
          <Callout tone="warning" className="mt-4" title={t("becomesBusiness")} />
        ) : null}
        {sizeSearchApplies(style.sizeClass) ? (
          <p className="text-muted mt-3 text-xs">{t(style.sizeClass === "cylinder" ? "fitRuleRound" : "fitRule")}</p>
        ) : null}
      </Section>

      <Section title={t("orderTitle")} description={t("orderIntro")}>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t("moq")} hint={t("moqHint")} error={errorOf("moqUnits")}>
            <NumberInput
              unit={t("pieces")}
              min={1}
              step={1}
              value={form.moqUnits}
              disabled={!canCurate}
              onChange={(e) => setForm((f) => ({ ...f, moqUnits: e.target.value }))}
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t("recyclable")}</span>
            <SegmentedControl
              label={t("recyclable")}
              options={triOptions}
              value={form.recyclable}
              onValueChange={(v) => canCurate && setForm((f) => ({ ...f, recyclable: v }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t("plasticFree")}</span>
            <SegmentedControl
              label={t("plasticFree")}
              options={triOptions}
              value={form.plasticFree}
              onValueChange={(v) => canCurate && setForm((f) => ({ ...f, plasticFree: v }))}
            />
          </div>
        </div>
        <p className="text-muted mt-3 text-xs">{t("factsHint")}</p>
      </Section>

      <Section title={t("certificationsTitle")} description={t("certificationsIntro")}>
        <ul className="flex flex-wrap gap-2">
          {form.certifications.length === 0 ? <li className="text-muted text-sm">{t("noCertifications")}</li> : null}
          {form.certifications.map((code) => (
            <li key={code}>
              <Badge size="md">
                <span className="tabular-nums">{code}</span>
                {canCurate ? (
                  <button
                    type="button"
                    className="ms-1.5 underline underline-offset-2"
                    aria-label={t("removeCertification", { code })}
                    onClick={() =>
                      setForm((f) => ({ ...f, certifications: f.certifications.filter((c) => c !== code) }))
                    }
                  >
                    {t("remove")}
                  </button>
                ) : null}
              </Badge>
            </li>
          ))}
        </ul>
        {canCurate ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Field
              label={t("certificationCode")}
              hint={t("certificationCodeHint")}
              error={
                certification.trim() && !CERTIFICATION_CODE.test(certification.trim().toLowerCase())
                  ? t("errors.code")
                  : errorOf("certifications")
              }
            >
              <Input value={certification} onChange={(e) => setCertification(e.target.value)} />
            </Field>
            <Button
              type="button"
              variant="secondary"
              disabled={!CERTIFICATION_CODE.test(certification.trim().toLowerCase())}
              onClick={addCertification}
            >
              {t("addCertification")}
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
