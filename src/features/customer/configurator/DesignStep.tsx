"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { RadioCards } from "@/ui/components/RadioCards";

import { designOptionsOf, type Configurator, type ConfiguratorState, type DesignOption } from "./state";

interface DesignStepProps {
  configurator: Configurator;
  state: ConfiguratorState;
  onChange: (patch: Partial<ConfiguratorState>) => void;
  /** Whether the online designer can draw this product (a box style `@getpack/dieline` knows). */
  designerAvailable: boolean;
}

/**
 * How the artwork gets made. (The physical mockup add-on became the sample of D-192: it is ordered
 * on its own path, U2.F3, not chosen here. The discount code moved to the price summary, `PromoCode`.)
 */
export function DesignStep({ configurator, state, onChange, designerAvailable }: DesignStepProps) {
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
    <div className="flex flex-col gap-6">
      <Field label={t("option")}>
        <RadioCards
          columns={2}
          value={state.designOption}
          onValueChange={(designOption) => onChange({ designOption: designOption as DesignOption })}
          options={designOptions.map((option) => ({
            value: option,
            label: t(`options.${option}.label`),
            description: t(`options.${option}.description`),
          }))}
        />
      </Field>

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
    </div>
  );
}
