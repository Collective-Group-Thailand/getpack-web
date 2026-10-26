"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { RadioCards } from "@/ui/components/RadioCards";
import { Icon, type IconName } from "@/ui/icons";

import { designOptionsOf, type Configurator, type ConfiguratorState, type DesignOption } from "./state";

/** One icon per way in; an option the prototype has no card for (a promotion's free design) gets the designer's. */
const PATH_ICON: Partial<Record<DesignOption, IconName>> = {
  own_file: "upload",
  online_designer: "edit",
  hired_design: "palette",
};

interface DesignStepProps {
  configurator: Configurator;
  state: ConfiguratorState;
  onChange: (patch: Partial<ConfiguratorState>) => void;
  /** Whether the online designer can draw this product (a box style `@getpack/dieline` knows). */
  designerAvailable: boolean;
  /** The Studio opened on this product, size and board (`studioHref`); `null` where it cannot open. */
  studioLink?: string | null;
  /** The sample request (T5): the existing dialog, opened from here. */
  sample?: { checked: boolean; disabled: boolean; onChange: (on: boolean) => void };
}

/**
 * How the artwork gets made: three ways in as cards (own file, the Studio, a hired designer), then the
 * optional real sample. The step opens on the API's own default (`configurator.design.default`) — "มีไฟล์งานแล้ว"
 * only when the link asked for it. (The physical mockup add-on became the sample of D-192; the discount code
 * and the completeness meter live in the price summary.)
 */
export function DesignStep({
  configurator,
  state,
  onChange,
  designerAvailable,
  studioLink = null,
  sample,
}: DesignStepProps) {
  const t = useTranslations("configurator.design");
  const designOptions = designOptionsOf(configurator, designerAvailable);
  // The Studio design this order carries (the studio's "order this"): named here so the customer
  // sees it is attached, and can drop it to order the box blank or with an upload instead.
  const attached = state.designOption === "online_designer" ? state.designDocumentId : null;
  const design = useQuery({
    queryKey: [...queryKeys.zone("customer"), "design-brief", attached],
    queryFn: async ({ signal }) =>
      (await browserApi().GET("/v1/store/designs/{designId}", { params: { path: { designId: attached! } }, signal }))
        .data!,
    enabled: !!attached,
    staleTime: 60_000,
  });
  return (
    <div className="flex flex-col gap-5">
      <Field label={t("paths")}>
        <RadioCards
          columns={3}
          value={state.designOption}
          onValueChange={(designOption) => onChange({ designOption: designOption as DesignOption })}
          options={designOptions.map((option) => ({
            value: option,
            visual: <Icon name={PATH_ICON[option] ?? "palette"} size={22} aria-hidden="true" className="text-primary" />,
            label: t(`options.${option}.label`),
            description: t(`options.${option}.description`),
          }))}
        />
      </Field>

      {state.designOption === "online_designer" && studioLink && !attached ? (
        <div>
          <Button asChild size="sm" variant="secondary" iconStart="edit">
            <Link href={studioLink}>{t("openStudio")}</Link>
          </Button>
        </div>
      ) : null}

      {attached ? (
        <Callout tone="success" title={t("attached.title")}>
          <p className="text-sm">
            {design.data
              ? t("attached.body", { title: design.data.title, version: design.data.versionNo ?? 1 })
              : t("attached.loading")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href={`/studio/${attached}`}>{t("attached.open")}</Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onChange({ designDocumentId: null })}>
              {t("attached.detach")}
            </Button>
          </div>
        </Callout>
      ) : null}

      {sample ? (
        <div className="bg-bg-subtle rounded-card px-3.5 py-3">
          <Checkbox
            label={t("sample.label")}
            description={sample.disabled && !sample.checked ? t("sample.needsPrice") : t("sample.hint")}
            checked={sample.checked}
            disabled={sample.disabled && !sample.checked}
            onCheckedChange={(on) => sample.onChange(on === true)}
          />
        </div>
      ) : null}
    </div>
  );
}
