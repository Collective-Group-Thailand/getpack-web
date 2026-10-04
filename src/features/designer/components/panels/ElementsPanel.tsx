"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import { barModules, qrMatrix } from "../../lib/codes";
import { newCode, newShape } from "../../lib/create";
import { blockElements, type DataBlock } from "../../lib/datablocks";
import { measureText } from "../../lib/measure";
import { SHAPES } from "../../lib/shapes";
import { useDebounced } from "../../lib/useDebounced";
import { useEditor } from "../../store/editor";
import type { NewElement } from "../../types";
import { useDesigner } from "../DesignerContext";

type Symbology = Schemas["BarcodeSymbology"];
type QrLevel = Schemas["QrErrorCorrection"];
type StudioElement = Schemas["StoreStudioElementDto"];
const SYMBOLOGIES: Symbology[] = ["qr", "ean13", "ean8", "upca", "code128"];

/**
 * Shapes, Packio's own elements, codes and data blocks (U4.4).
 *
 * - **Elements** come from the studio catalogue (`store.studio.listElements`): shapes, icons and
 *   packaging marks drawn by Packio; a mark with legal meaning is placed only after the customer
 *   declares the right to use it (`declareRight`, D-282) — the placed shape remembers its element.
 * - **Codes**: QR (with its error-correction level), EAN-13, EAN-8, UPC-A and Code 128, drawn here
 *   with their quiet zones and checked by packio-api's one validation service (check digit,
 *   character set, payload length, the GS1 minimum width, D-283); the symbol is placed at least as
 *   wide as that minimum.
 * - **Data blocks**: ingredients, nutrition and the manufacturer, typed as facts and set as text with
 *   Thai line breaks at word boundaries.
 */
export function ElementsPanel() {
  const t = useTranslations("designer.elements");
  const addElement = useEditor((s) => s.addElement);
  const { center, mode } = useDesigner();

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold">{t("shapes")}</h3>
        <div className="grid grid-cols-4 gap-2">
          {(["rect", "circle"] as const).map((type) => (
            <button
              key={type}
              type="button"
              aria-label={t(`shape.${type}`)}
              onClick={() => addElement(newShape(center(), type))}
              className="border-border hover:bg-surface-subtle focus-visible:ring-focus-ring flex aspect-square items-center justify-center rounded-lg border outline-none focus-visible:ring-2"
            >
              <svg viewBox="0 0 100 100" className="text-fg h-8 w-8" aria-hidden="true">
                {type === "rect" ? (
                  <rect x="10" y="10" width="80" height="80" fill="currentColor" />
                ) : (
                  <circle cx="50" cy="50" r="42" fill="currentColor" />
                )}
              </svg>
            </button>
          ))}
          {SHAPES.map((shape) => (
            <button
              key={shape.id}
              type="button"
              aria-label={t(`shape.${shape.id}`)}
              onClick={() => addElement(newShape(center(), "shape", shape.path))}
              className="border-border hover:bg-surface-subtle focus-visible:ring-focus-ring flex aspect-square items-center justify-center rounded-lg border outline-none focus-visible:ring-2"
            >
              <svg viewBox="0 0 100 100" className="text-fg h-8 w-8" aria-hidden="true">
                <path d={shape.path} fill="currentColor" />
              </svg>
            </button>
          ))}
        </div>
      </section>

      {mode !== "admin" ? <StudioElements /> : null}
      <Codes />
      <DataBlocks />
    </div>
  );
}

function StudioElements() {
  const t = useTranslations("designer.elements");
  const locale = useLocale() as "th" | "en";
  const addElement = useEditor((s) => s.addElement);
  const { center } = useDesigner();
  const client = useQueryClient();
  const key = [...queryKeys.zone("customer"), "studio-elements"];
  const elements = useQuery({
    queryKey: key,
    queryFn: async () => (await browserApi().GET("/v1/store/studio/elements")).data!,
    staleTime: 10 * 60_000,
  });
  const [asking, setAsking] = useState<StudioElement | null>(null);
  const [statement, setStatement] = useState("");
  const place = (element: StudioElement) =>
    addElement({
      ...newShape(center(), "shape", element.path),
      name: locale === "en" ? element.nameEn : element.nameTh,
      studioElementId: element.id,
    } as NewElement);
  const declare = useMutation({
    mutationFn: async (element: StudioElement) =>
      (
        await browserApi().POST("/v1/store/studio/elements/{elementId}/right-declarations", {
          params: { path: { elementId: element.id } },
          body: { statement: statement.trim() },
        })
      ).data!,
    onSuccess: async (_data, element) => {
      await client.invalidateQueries({ queryKey: key });
      setAsking(null);
      setStatement("");
      place(element);
    },
    onError: (error) => toast.error(isApiError(error) ? error.detail : t("declareFailed")),
  });

  const list = elements.data ?? [];
  if (list.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{t("packio")}</h3>
      {(["shape", "icon", "mark"] as const).map((kind) => {
        const ofKind = list.filter((e) => e.kind === kind);
        if (ofKind.length === 0) return null;
        return (
          <div key={kind} className="space-y-1">
            <p className="text-muted text-xs">{t(`kinds.${kind}`)}</p>
            <div className="grid grid-cols-4 gap-2">
              {ofKind.map((element) => {
                const name = locale === "en" ? element.nameEn : element.nameTh;
                return (
                  <button
                    key={element.id}
                    type="button"
                    aria-label={element.usable ? name : t("needsRight", { name })}
                    title={name}
                    onClick={() => (element.usable ? place(element) : setAsking(element))}
                    className="border-border hover:bg-surface-subtle focus-visible:ring-focus-ring relative flex aspect-square items-center justify-center rounded-lg border outline-none focus-visible:ring-2"
                  >
                    <svg viewBox="0 0 100 100" className="text-fg h-8 w-8" aria-hidden="true">
                      <path d={element.path} fill="currentColor" fillRule="evenodd" />
                    </svg>
                    {!element.usable ? (
                      <span
                        aria-hidden="true"
                        className="bg-warning-subtle text-warning-subtle-fg absolute end-0.5 top-0.5 rounded px-1 text-[10px]"
                      >
                        {t("rightBadge")}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <Dialog
        open={asking !== null}
        onOpenChange={(open) => !open && setAsking(null)}
        title={t("declareTitle", { name: asking ? (locale === "en" ? asking.nameEn : asking.nameTh) : "" })}
        description={t("declareBody")}
        size="md"
        footer={
          <Button
            disabled={statement.trim().length < 10}
            loading={declare.isPending}
            onClick={() => asking && declare.mutate(asking)}
          >
            {t("declareConfirm")}
          </Button>
        }
      >
        <Field label={t("declareStatement")} hint={t("declareHint")}>
          <Textarea value={statement} onChange={(event) => setStatement(event.target.value)} rows={3} />
        </Field>
      </Dialog>
    </section>
  );
}

function Codes() {
  const t = useTranslations("designer.elements");
  const addElement = useEditor((s) => s.addElement);
  const { center, mode } = useDesigner();
  const [kind, setKind] = useState<Symbology>("qr");
  const [level, setLevel] = useState<QrLevel>("M");
  const [value, setValue] = useState("");
  const local = value.length > 0 && (kind === "qr" ? qrMatrix(value) !== null : barModules(kind, value) !== null);
  // packio-api's validation service is the authority (D-283); the local encoder draws the symbol.
  const request = value ? JSON.stringify({ symbology: kind, value, ...(kind === "qr" ? { level } : {}) }) : null;
  const settled = useDebounced(request, 350);
  const check = useQuery({
    queryKey: [...queryKeys.zone("customer"), "barcode-check", settled],
    queryFn: async () =>
      (
        await browserApi().POST("/v1/store/studio/barcodes/actions/validate", {
          body: JSON.parse(settled!) as Schemas["ValidateBarcodeDto"],
        })
      ).data!,
    // The back office has no store surface: staff copies are checked by the local encoder only.
    enabled: settled !== null && mode !== "admin",
    retry: false,
    staleTime: Infinity,
  });
  const result = settled === request ? check.data : undefined;
  const valid = local && (mode === "admin" || !!result?.valid);
  const problem = (code: string) => (t.has(`problems.${code}`) ? t(`problems.${code}` as never) : code);

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{t("codes")}</h3>
      <Field label={t("codeKind")}>
        <Select
          value={kind}
          onValueChange={(next) => {
            setKind(next as Symbology);
            setValue("");
          }}
          options={SYMBOLOGIES.map((s) => ({ value: s, label: t(`symbology.${s}`) }))}
        />
      </Field>
      {kind === "qr" ? (
        <Field label={t("qrLevel")} hint={t("qrLevelHint")}>
          <Select
            value={level}
            onValueChange={(next) => setLevel(next as QrLevel)}
            options={(["L", "M", "Q", "H"] as const).map((l) => ({ value: l, label: t(`qrLevels.${l}`) }))}
          />
        </Field>
      ) : null}
      <Field
        label={kind === "qr" ? t("qrValue") : t("barValue")}
        hint={t(`hints.${kind}`)}
        error={
          value && result && !result.valid
            ? result.problems.map(problem).join(" · ")
            : value && !local
              ? t("invalid")
              : undefined
        }
      >
        <Input
          inputSize="sm"
          value={value}
          inputMode={kind === "qr" || kind === "code128" ? undefined : "numeric"}
          onChange={(event) => setValue(event.target.value.trim())}
        />
      </Field>
      {result?.valid && result.minWidthMm ? (
        <p className="text-muted text-xs">{t("minWidth", { mm: result.minWidthMm })}</p>
      ) : null}
      <Button
        size="sm"
        disabled={!valid}
        onClick={() => addElement(newCode(center(), kind, result?.normalised ?? value, result?.minWidthMm ?? null))}
      >
        {t("addCode")}
      </Button>
    </section>
  );
}

function DataBlocks() {
  const t = useTranslations("designer.elements.blocks");
  const addElement = useEditor((s) => s.addElement);
  const { center } = useDesigner();
  const [kind, setKind] = useState<DataBlock["kind"]>("ingredients");
  const [ingredients, setIngredients] = useState("");
  const [facts, setFacts] = useState({ serving: "", energyKcal: "", fatG: "", sugarG: "", sodiumMg: "" });
  const [maker, setMaker] = useState({ name: "", address: "", phone: "", fdaNumber: "" });

  const block: DataBlock =
    kind === "ingredients"
      ? { kind, text: ingredients }
      : kind === "nutrition"
        ? { kind, facts }
        : { kind, details: maker };
  const ready =
    kind === "ingredients" ? ingredients.trim().length > 0 : kind === "nutrition" ? !!facts.energyKcal : !!maker.name;

  const add = () => {
    const at = center();
    const elements = blockElements(
      block,
      {
        title: { ingredients: t("ingredients"), nutrition: t("nutrition"), manufacturer: t("manufacturer") },
        serving: t("fields.serving"),
        energy: t("fields.energyKcal"),
        fat: t("fields.fatG"),
        sugar: t("fields.sugarG"),
        sodium: t("fields.sodiumMg"),
        phone: t("fields.phone"),
        fda: t("fields.fdaNumber"),
      },
      { x: at.x - 30, y: at.y - 10 },
      {
        widthMm: 60,
        fontSizeMm: 2.5,
        fontFamily: "Sarabun",
        fill: "#000000",
        groupId: nanoid(6),
        measure: (text, size) => measureText({ text, fontSize: size, fontFamily: "Sarabun", fontStyle: "normal" }).width,
      },
    );
    for (const el of elements) addElement(el);
  };

  const field = (label: string, value: string, set: (v: string) => void) => (
    <Field label={label}>
      <Input inputSize="sm" value={value} onChange={(event) => set(event.target.value)} />
    </Field>
  );

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{t("title")}</h3>
      <Field label={t("kind")}>
        <Select
          value={kind}
          onValueChange={(next) => setKind(next as DataBlock["kind"])}
          options={(["ingredients", "nutrition", "manufacturer"] as const).map((k) => ({ value: k, label: t(k) }))}
        />
      </Field>
      {kind === "ingredients" ? (
        <Field label={t("ingredients")} hint={t("ingredientsHint")}>
          <Textarea rows={3} value={ingredients} onChange={(event) => setIngredients(event.target.value)} />
        </Field>
      ) : kind === "nutrition" ? (
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(facts) as (keyof typeof facts)[]).map((k) => (
            <div key={k}>{field(t(`fields.${k}`), facts[k], (v) => setFacts((f) => ({ ...f, [k]: v })))}</div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {(Object.keys(maker) as (keyof typeof maker)[]).map((k) => (
            <div key={k}>{field(t(`fields.${k}`), maker[k], (v) => setMaker((m) => ({ ...m, [k]: v })))}</div>
          ))}
        </div>
      )}
      <Button size="sm" disabled={!ready} onClick={add}>
        {t("add")}
      </Button>
    </section>
  );
}
