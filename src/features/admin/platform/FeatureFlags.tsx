"use client";

import { useTranslations } from "next-intl";
import { z } from "zod";

import { When } from "@/features/shared/format";
import { Badge } from "@/ui/components/Badge";
import { Checkbox } from "@/ui/components/Checkbox";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { CrudList, defineResource, type FieldDef, type InitialPage } from "../console";
import { flagsList, type FeatureFlag } from "./resources";

const AUDIENCES = ["customer", "staff", "partner"] as const;

const schema = z.object({
  enabled: z.boolean(),
  description: z.string().min(1),
  percentage: z.number().int().min(0).max(100).nullable(),
  audiences: z.array(z.enum(AUDIENCES)),
});
type Values = z.infer<typeof schema>;

/**
 * Feature flags (B1.3): the switches for R2 capabilities (D-111) and for rolling a change out to
 * a share of users. Flags are defined in code, so they can be edited here but never created or
 * deleted — which is exactly what `defineResource` without `create`/`remove` gives.
 */
const flags = defineResource<FeatureFlag, Values>({
  list: flagsList,
  manage: "feature_flags.manage",
  form: {
    schema,
    empty: { enabled: false, description: "", percentage: null, audiences: [] },
    toValues: (flag) => ({
      enabled: flag.enabled,
      description: flag.description,
      percentage: flag.rules.percentage ?? null,
      audiences: [...(flag.rules.audiences ?? [])],
    }),
    update: async ({ contract }, flag, values) =>
      (
        await contract.PUT("/v1/admin/feature-flags/{key}", {
          params: { path: { key: flag.key } },
          body: {
            enabled: values.enabled,
            description: values.description,
            rules: {
              ...flag.rules,
              ...(values.percentage === null ? { percentage: undefined } : { percentage: values.percentage }),
              audiences: values.audiences.length > 0 ? values.audiences : undefined,
            },
          },
        })
      ).data,
  },
});

export function FeatureFlags({ initial }: { initial: InitialPage<FeatureFlag> | null }) {
  const t = useTranslations("platform.flags");

  const fields: FieldDef<Values>[] = [
    { name: "enabled", label: t("fields.enabled"), kind: "switch", description: t("fields.enabledHint") },
    { name: "description", label: t("fields.description"), kind: "textarea", rows: 2, required: true },
    {
      name: "percentage",
      label: t("fields.percentage"),
      kind: "number",
      unit: "%",
      min: 0,
      max: 100,
      hint: t("fields.percentageHint"),
    },
    {
      name: "audiences",
      label: t("fields.audiences"),
      kind: "custom",
      hint: t("fields.audiencesHint"),
      render: ({ value, onChange }) => {
        const selected = (value as string[] | undefined) ?? [];
        return (
          <div className="flex flex-wrap gap-3">
            {AUDIENCES.map((audience) => (
              <Checkbox
                key={audience}
                label={t(`audiences.${audience}`)}
                checked={selected.includes(audience)}
                onCheckedChange={(checked) =>
                  onChange(checked ? [...selected, audience] : selected.filter((item) => item !== audience))
                }
              />
            ))}
          </div>
        );
      },
    },
  ];

  const columns: DataTableColumn<FeatureFlag>[] = [
    {
      id: "key",
      header: t("columns.key"),
      cell: (row) => <span className="text-xs font-medium tabular-nums">{row.key}</span>,
    },
    { id: "description", header: t("columns.description"), cell: (row) => row.description },
    {
      id: "enabled",
      header: t("columns.state"),
      cell: (row) => (
        <Badge size="sm" tone={row.enabled ? "success" : "neutral"} icon={row.enabled ? "check" : "pause"}>
          {row.enabled ? t("on") : t("off")}
        </Badge>
      ),
    },
    {
      id: "rules",
      header: t("columns.rules"),
      cell: (row) =>
        [
          row.rules.percentage !== undefined ? t("rulePercentage", { pct: row.rules.percentage }) : null,
          row.rules.audiences?.length
            ? row.rules.audiences.map((audience) => t(`audiences.${audience}`)).join(", ")
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || t("everyone"),
    },
    { id: "updatedAt", header: t("columns.updatedAt"), cell: (row) => <When at={row.updatedAt} /> },
  ];

  return (
    <CrudList
      config={flags}
      fields={fields}
      columns={columns}
      caption={t("title")}
      initial={initial}
      labels={{ editTitle: (flag) => t("editTitle", { key: flag.key }) }}
    />
  );
}
