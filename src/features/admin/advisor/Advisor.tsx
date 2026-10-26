"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { When } from "@/features/shared/format/When";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { PageHeader } from "@/ui/components/PageHeader";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  FormDialog,
  FormError,
  problemMessage,
  QueryError,
  ResourceList,
  Section,
  useCan,
  useProductTypes,
  type InitialPage,
} from "../console";
import { inputsOf, OUTCOMES, recommendationsList, recommendedBoard, type Recommendation } from "./resources";

type Load = Schemas["AdvisoryLoadDto"];

const FRAGILITY = ["low", "medium", "high"] as const satisfies readonly Schemas["AdvisoryFragility"][];
const HUMIDITY = ["dry", "normal", "humid", "very_humid"] as const satisfies readonly Schemas["AdvisoryHumidityBand"][];
const STORAGE = [
  "up_to_10_days",
  "up_to_30_days",
  "up_to_90_days",
  "over_90_days",
] as const satisfies readonly Schemas["AdvisoryStorageBand"][];
const TRANSPORT = [
  "pickup",
  "parcel_domestic",
  "pallet_domestic",
  "sea_export",
] as const satisfies readonly Schemas["AdvisoryTransportMode"][];
const PALLET = ["none", "column", "interlocked"] as const;

function OutcomeBadge({ outcome }: { outcome: Recommendation["outcome"] }) {
  const t = useTranslations("advisor.outcomes");
  return outcome === "recommended" ? (
    <Badge size="sm" tone="success" icon="check">
      {t(outcome)}
    </Badge>
  ) : (
    <Badge size="sm" tone="warning" icon="warning">
      {t(outcome)}
    </Badge>
  );
}

function useBoardName() {
  const locale = useLocale();
  return (board: { nameTh: string; nameEn: string } | null) =>
    board ? (locale === "en" ? board.nameEn : board.nameTh) : "–";
}

/**
 * The Structure Advisor's log (D-240): every recommendation — customers', anonymous visitors' and
 * staff runs — with its outcome, newest first. Staff can run the advisor themselves (D-239), also
 * while the flag is off, to validate rule sets and advise customers.
 */
export function RecommendationsList({ initial }: { initial: InitialPage<Recommendation> | null }) {
  const t = useTranslations("advisor.list");
  const tOutcomes = useTranslations("advisor.outcomes");
  const types = useProductTypes();
  const boardName = useBoardName();
  const canRun = useCan("advisory.evaluate");
  const [running, setRunning] = useState(false);

  const columns: DataTableColumn<Recommendation>[] = [
    {
      id: "createdAt",
      header: t("columns.when"),
      cell: (row) => (
        <Link href={`/advisor/${row.id}`} className="text-primary hover:underline">
          <When at={row.createdAt} />
        </Link>
      ),
    },
    {
      id: "productType",
      header: t("columns.productType"),
      cell: (row) => types.labelOf(inputsOf(row).productTypeCode ?? ""),
    },
    { id: "outcome", header: t("columns.outcome"), cell: (row) => <OutcomeBadge outcome={row.outcome} /> },
    { id: "board", header: t("columns.board"), cell: (row) => boardName(recommendedBoard(row)) },
    {
      id: "who",
      header: t("columns.who"),
      cell: (row) =>
        row.createdById ? (
          <Badge size="sm" icon="user">
            {t("staff")}
          </Badge>
        ) : row.customerId ? (
          <Link href={`/customers/${row.customerId}`} className="text-primary text-sm hover:underline">
            {t("customer")}
          </Link>
        ) : (
          <span className="text-muted text-sm">{t("anonymous")}</span>
        ),
    },
    {
      id: "chosen",
      header: t("columns.chosen"),
      cell: (row) =>
        row.choice ? boardName(row.options.find((o) => o.board.id === row.choice!.boardId)?.board ?? null) : "–",
    },
    { id: "quotes", header: t("columns.quotes"), numeric: true, cell: (row) => row.quoteIds.length },
  ];

  return (
    <>
      <ResourceList
        resource={recommendationsList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        searchPlaceholder={t("searchPlaceholder")}
        rowHref={(row) => `/advisor/${row.id}`}
        filters={[
          {
            id: "outcome",
            label: t("columns.outcome"),
            kind: "select",
            options: OUTCOMES.map((value) => ({ value, label: tOutcomes(value) })),
          },
        ]}
        toolbarEnd={
          canRun ? (
            <Button iconStart="play" onClick={() => setRunning(true)}>
              {t("run")}
            </Button>
          ) : null
        }
        empty={{ title: t("empty"), description: t("emptyHint") }}
      />
      {running ? <RunDialog from={null} onClose={() => setRunning(false)} /> : null}
    </>
  );
}

/** A staff run (`admin.advisory.evaluate`): the configuration as JSON, the load as fields. */
function RunDialog({ from, onClose }: { from: Recommendation | null; onClose: () => void }) {
  const t = useTranslations("advisor.run");
  const tLoad = useTranslations("advisor.load");
  const router = useRouter();
  const types = useProductTypes();
  const logged = from ? inputsOf(from) : null;
  const corrugate = types.types.filter((type) => type.calculatorKey === "corrugate");
  const [productTypeCode, setProductTypeCode] = useState(logged?.productTypeCode ?? corrugate[0]?.code ?? "");
  const [configuration, setConfiguration] = useState(
    logged?.configuration ? JSON.stringify(logged.configuration, null, 2) : "",
  );
  const [postcode, setPostcode] = useState(logged?.deliveryPostcode ?? "");
  const start = logged?.load;
  const [load, setLoad] = useState({
    productWeightG: String(start?.productWeightG ?? ""),
    unitsPerBox: String(start?.unitsPerBox ?? "1"),
    stackLayers: String(start?.stackLayers ?? "1"),
    fragility: start?.fragility ?? "low",
    humidity: start?.humidity ?? "normal",
    storage: start?.storage ?? "up_to_30_days",
    transportMode: start?.transportMode ?? "parcel_domestic",
    pallet: (start?.pallet?.pattern ?? "none") as (typeof PALLET)[number],
    overhang: start?.pallet?.overhang ?? false,
  });
  return (
    <FormDialog
      size="lg"
      title={t("title")}
      description={t("body")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        if (!productTypeCode) throw new FormError(t("needType"));
        let parsed: Record<string, unknown>;
        try {
          const value: unknown = JSON.parse(configuration);
          if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not an object");
          parsed = value as Record<string, unknown>;
        } catch {
          throw new FormError(t("badConfiguration"));
        }
        const weight = Number(load.productWeightG);
        if (!(weight > 0)) throw new FormError(t("needWeight"));
        if (!/^\d+$/.test(load.unitsPerBox) || !/^\d+$/.test(load.stackLayers)) throw new FormError(t("needCounts"));
        if (postcode && !/^\d{5}$/.test(postcode)) throw new FormError(t("badPostcode"));
        const body: Load = {
          productWeightG: weight,
          unitsPerBox: Number(load.unitsPerBox),
          stackLayers: Number(load.stackLayers),
          fragility: load.fragility,
          humidity: load.humidity,
          storage: load.storage,
          transportMode: load.transportMode,
          pallet: load.pallet === "none" ? null : { pattern: load.pallet, overhang: load.overhang },
        };
        const { data } = await adminBrowserApis().contract.POST("/v1/admin/advisory/actions/evaluate", {
          body: {
            productTypeCode,
            configuration: parsed,
            load: body,
            ...(postcode ? { deliveryPostcode: postcode } : {}),
          },
        });
        toast.success(t("done"));
        router.push(`/advisor/${data!.id}`);
      }}
    >
      <Field label={t("productType")} hint={t("productTypeHint")} required>
        <SearchableSelect
          value={productTypeCode || undefined}
          placeholder={t("choose")}
          onValueChange={setProductTypeCode}
          options={(corrugate.length ? corrugate : types.types).map((type) => ({
            value: type.code,
            label: types.labelOf(type.code),
          }))}
        />
      </Field>
      <Field label={t("configuration")} hint={t("configurationHint")} required>
        <Textarea
          rows={8}
          className="text-xs tabular-nums"
          value={configuration}
          onChange={(event) => setConfiguration(event.target.value)}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={tLoad("productWeightG")} required>
          <NumberInput
            unit="g"
            inputMode="decimal"
            value={load.productWeightG}
            onChange={(event) => setLoad({ ...load, productWeightG: event.target.value })}
          />
        </Field>
        <Field label={tLoad("unitsPerBox")} required>
          <NumberInput
            min={1}
            value={load.unitsPerBox}
            onChange={(event) => setLoad({ ...load, unitsPerBox: event.target.value })}
          />
        </Field>
        <Field label={tLoad("stackLayers")} required>
          <NumberInput
            min={1}
            value={load.stackLayers}
            onChange={(event) => setLoad({ ...load, stackLayers: event.target.value })}
          />
        </Field>
        <Field label={tLoad("fragility")}>
          <NativeSelect
            value={load.fragility}
            onValueChange={(fragility) => setLoad({ ...load, fragility: fragility as typeof load.fragility })}
            options={FRAGILITY.map((value) => ({ value, label: tLoad(`fragilities.${value}`) }))}
          />
        </Field>
        <Field label={tLoad("humidity")}>
          <NativeSelect
            value={load.humidity}
            onValueChange={(humidity) => setLoad({ ...load, humidity: humidity as typeof load.humidity })}
            options={HUMIDITY.map((value) => ({ value, label: tLoad(`humidities.${value}`) }))}
          />
        </Field>
        <Field label={tLoad("storage")}>
          <NativeSelect
            value={load.storage}
            onValueChange={(storage) => setLoad({ ...load, storage: storage as typeof load.storage })}
            options={STORAGE.map((value) => ({ value, label: tLoad(`storages.${value}`) }))}
          />
        </Field>
        <Field label={tLoad("transportMode")}>
          <NativeSelect
            value={load.transportMode}
            onValueChange={(transportMode) =>
              setLoad({ ...load, transportMode: transportMode as typeof load.transportMode })
            }
            options={TRANSPORT.map((value) => ({ value, label: tLoad(`transports.${value}`) }))}
          />
        </Field>
        <Field label={tLoad("pallet")}>
          <NativeSelect
            value={load.pallet}
            onValueChange={(pallet) => setLoad({ ...load, pallet: pallet as typeof load.pallet })}
            options={PALLET.map((value) => ({ value, label: tLoad(`pallets.${value}`) }))}
          />
        </Field>
        <Field label={t("postcode")} hint={t("postcodeHint")}>
          <Input
            inputMode="numeric"
            maxLength={5}
            value={postcode}
            onChange={(event) => setPostcode(event.target.value.replace(/\D/g, ""))}
          />
        </Field>
      </div>
      {load.pallet !== "none" ? (
        <Checkbox
          label={tLoad("overhang")}
          checked={load.overhang}
          onCheckedChange={(on) => setLoad({ ...load, overhang: on === true })}
        />
      ) : null}
    </FormDialog>
  );
}

/**
 * One recommendation (D-235 – D-240): the requirement the load sets, every board with its strength
 * against it and its price, the boards left out for missing data, what the customer chose, and a
 * replay that re-runs the engine on the logged inputs — it must come out identical.
 */
export function RecommendationDetail({ recommendationId }: { recommendationId: string }) {
  const t = useTranslations("advisor.detail");
  const tLoad = useTranslations("advisor.load");
  const tReasons = useTranslations("advisor.reasons");
  const format = useFormat();
  const types = useProductTypes();
  const boardName = useBoardName();
  const canRun = useCan("advisory.evaluate");
  const [rerun, setRerun] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.detail("admin", "advisory_recommendation", recommendationId),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/advisory/recommendations/{recommendationId}", {
          params: { path: { recommendationId } },
        })
      ).data!,
  });
  const replay = useMutation({
    mutationFn: async () =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/advisory/recommendations/{recommendationId}/actions/replay", {
          params: { path: { recommendationId } },
        })
      ).data!,
    onError: (error) => toast.error(problemMessage(error, t("replayFailed"))),
  });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const rec = query.data;
  if (!rec) return <Skeleton className="h-96" />;
  const inputs = inputsOf(rec);
  const load = inputs.load;
  const req = rec.requirement;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("log"), href: "/advisor" }, { label: format.dateTime(rec.createdAt) }]}
          />
        }
        title={t("title", { type: types.labelOf(inputs.productTypeCode ?? "") })}
        meta={
          <>
            <OutcomeBadge outcome={rec.outcome} />
            <span className="text-muted text-sm">
              {t("meta", { channel: rec.channel, engine: rec.engineVersion, rules: rec.ruleSetVersion.versionNo })}
            </span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" iconStart="refresh" loading={replay.isPending} onClick={() => replay.mutate()}>
              {t("replay")}
            </Button>
            {canRun ? (
              <Button iconStart="play" onClick={() => setRerun(true)}>
                {t("runAgain")}
              </Button>
            ) : null}
          </>
        }
      />
      {replay.data ? (
        replay.data.identical ? (
          <Callout tone="success" title={t("identical", { engine: replay.data.engineVersion })} />
        ) : (
          <Callout tone="danger" title={t("different", { engine: replay.data.engineVersion })}>
            <ul className="mt-1 list-disc ps-5 text-xs tabular-nums">
              {replay.data.differences.map((path) => (
                <li key={path}>{path}</li>
              ))}
            </ul>
          </Callout>
        )
      ) : null}
      {rec.warnings.length ? (
        <Callout tone="warning" title={t("warnings")}>
          {rec.warnings.map((warning) => t(`warningCodes.${warning}`)).join(" · ")}
        </Callout>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={t("load")}>
          {load ? (
            <DescriptionList
              columns={2}
              items={[
                { term: tLoad("productWeightG"), description: `${format.number(load.productWeightG)} g` },
                { term: tLoad("unitsPerBox"), description: format.number(load.unitsPerBox) },
                { term: tLoad("stackLayers"), description: format.number(load.stackLayers) },
                { term: tLoad("fragility"), description: tLoad(`fragilities.${load.fragility}`) },
                { term: tLoad("humidity"), description: tLoad(`humidities.${load.humidity}`) },
                { term: tLoad("storage"), description: tLoad(`storages.${load.storage}`) },
                { term: tLoad("transportMode"), description: tLoad(`transports.${load.transportMode}`) },
                {
                  term: tLoad("pallet"),
                  description: load.pallet
                    ? `${tLoad(`pallets.${load.pallet.pattern}`)}${load.pallet.overhang ? ` · ${tLoad("overhang")}` : ""}`
                    : tLoad("pallets.none"),
                },
              ]}
            />
          ) : null}
        </Section>
        <Section title={t("requirement")}>
          <DescriptionList
            columns={2}
            items={[
              { term: t("perimeter"), description: `${format.number(req.perimeterMm)} mm` },
              { term: t("boxWeight"), description: `${format.number(req.boxWeightKg)} kg` },
              { term: t("layers"), description: format.number(req.layers) },
              { term: t("loadN"), description: `${format.number(req.loadN)} N` },
              { term: t("combinedFactor"), description: format.number(req.combinedFactor) },
              { term: t("requiredBct"), description: `${format.number(req.requiredBctN)} N` },
            ]}
          />
          {rec.reasons.length ? (
            <ul className="text-muted mt-3 flex flex-col gap-0.5 text-xs">
              {rec.reasons.map((reason, index) => (
                <li key={index}>
                  {tReasons.has(reason.code) ? tReasons(reason.code) : reason.code}
                  {reason.factor ? ` · ${reason.factor}` : ""}
                  {reason.band ? ` (${reason.band})` : ""}
                  {reason.value !== undefined
                    ? `: ${format.number(reason.value)}${reason.unit ? ` ${reason.unit}` : ""}`
                    : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </Section>
      </div>

      <Section title={t("options")}>
        <div className="border-border overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <caption className="sr-only">{t("options")}</caption>
            <thead className="bg-surface-subtle text-muted text-xs">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{t("board")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("bct")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("margin")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("unitPrice")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("leadTime")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("source")}</th>
              </tr>
            </thead>
            <tbody>
              {rec.options.map((option) => {
                const data = rec.boardData.find((entry) => entry.boardId === option.board.id);
                const chosen = rec.choice?.boardId === option.board.id;
                return (
                  <tr key={option.board.id} className="border-border border-t">
                    <td className="px-3 py-2">
                      <span className="font-medium">{boardName(option.board)}</span>
                      <span className="text-muted ms-2 text-xs tabular-nums">{option.board.code}</span>
                      <span className="ms-2 inline-flex gap-1">
                        {option.board.id === rec.recommendedBoardId ? (
                          <Badge size="sm" tone="success">
                            {t("recommended")}
                          </Badge>
                        ) : null}
                        {chosen ? (
                          <Badge size="sm" tone="info">
                            {t("chosen")}
                          </Badge>
                        ) : null}
                        {option.passes ? null : (
                          <Badge size="sm" tone="danger">
                            {t("fails")}
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">
                      {t("bctValue", { low: format.number(option.bct.low), required: format.number(req.requiredBctN) })}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">
                      {option.marginPct === null ? "–" : format.percent(String(option.marginPct))}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">
                      {option.unitPrice ? format.thb(option.unitPrice) : option.instant ? "–" : t("rfq")}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">
                      {option.leadTimeDays === null ? "–" : t("days", { days: option.leadTimeDays })}
                    </td>
                    <td className="text-muted px-3 py-2 text-xs">{data?.sheetSource ?? "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rec.excluded.length ? (
          <div className="mt-4">
            <p className="text-sm font-medium">{t("excluded")}</p>
            <ul className="text-muted mt-1 flex flex-col gap-0.5 text-sm">
              {rec.excluded.map((entry) => (
                <li key={entry.board.id}>
                  {boardName(entry.board)} — {entry.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      <Section title={t("context")}>
        <DescriptionList
          columns={2}
          items={[
            {
              term: t("who"),
              description: rec.createdById ? (
                t("staffRun")
              ) : rec.customerId ? (
                <Link href={`/customers/${rec.customerId}`} className="text-primary underline">
                  {t("customerRun")}
                </Link>
              ) : (
                t("anonymousRun")
              ),
            },
            { term: t("postcode"), description: inputs.deliveryPostcode ?? "–" },
            { term: t("choices"), description: rec.choices.length ? format.number(rec.choices.length) : "–" },
            {
              term: t("quotes"),
              description: rec.quoteIds.length ? (
                <span className="flex flex-wrap gap-2">
                  {rec.quoteIds.map((id, index) => (
                    <Link key={id} href={`/quotations/${id}`} className="text-primary underline">
                      {t("quoteN", { n: index + 1 })}
                    </Link>
                  ))}
                </span>
              ) : (
                "–"
              ),
            },
          ]}
        />
        <details className="mt-3">
          <summary className="text-primary cursor-pointer text-sm">{t("configuration")}</summary>
          <pre className="bg-surface-subtle mt-2 overflow-x-auto rounded-md p-3 text-xs">
            {JSON.stringify(inputs.configuration ?? {}, null, 2)}
          </pre>
        </details>
      </Section>
      {rerun ? <RunDialog from={rec} onClose={() => setRerun(false)} /> : null}
    </div>
  );
}
