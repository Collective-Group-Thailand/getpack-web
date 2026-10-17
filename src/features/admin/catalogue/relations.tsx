"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { uploadFile } from "@/features/shared/files/upload";
import { ifMatch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { IconButton } from "@/ui/components/IconButton";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { SearchInput } from "@/ui/components/SearchInput";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis, FormDialog, FormError, problemMessage, useCan } from "../console";
import { FileButton } from "../logistics/files";
import { getRow, listRows, loose, rowLabel, type CatalogueRow } from "./api";
import { FileImage } from "./FileImage";
import { listFor } from "./resources";
import type { TableDef } from "./tables";
import { useRefs } from "./useRefs";

type Kind = Schemas["OfferableOptionKind"];
type Slot = Schemas["GeometrySlot"];
type StockAttribute = Schemas["StockAttribute"];

/** The catalogue table each kind of option is chosen from (a coating is a finish). */
const KIND_TABLE: Record<Kind, string> = {
  material: "materials",
  finish: "finishes",
  coating: "finishes",
  ink_colour: "ink-colours",
  diecut: "diecut-types",
  assembly: "assemblies",
  print_type: "print-types",
  pattern: "patterns",
};
const KINDS = Object.keys(KIND_TABLE) as Kind[];
const FOLDING_SLOTS = ["dw", "dl", "nd", "nl", "nw", "aux_f", "aux_f10"] as const satisfies readonly Slot[];
const CORRUGATE_SLOTS = ["i", "j", "k", "m"] as const satisfies readonly Slot[];
const STOCK_ATTRIBUTES = [
  "material",
  "type",
  "sub_type",
  "shape",
  "shoulder",
  "neck",
  "colour",
  "size_text",
  "cap_type",
] as const satisfies readonly StockAttribute[];
const HEX = /^#[0-9A-Fa-f]{6}$/;

type RelationId =
  | "images"
  | "options"
  | "patterns"
  | "reference"
  | "attributes"
  | "colours"
  | "fonts"
  | "setDesign"
  | "flutes"
  | "geometry"
  | "categories"
  | "products"
  | "bands";

/** What can be managed on a row of each table, beyond its own fields (D-005, D-100, D-220). */
const RELATIONS: Record<string, readonly RelationId[]> = {
  "catalog-products": ["images", "options", "patterns", "reference"],
  "stock-products": ["images", "attributes"],
  "semi-designs": ["colours"],
  "semi-design-templates": ["fonts", "setDesign"],
  patterns: ["flutes", "geometry"],
  articles: ["categories"],
  faqs: ["products"],
  "geometry-band-tables": ["bands"],
};

/** Runs a write under the row's current ETag (`If-Match`), read just before. */
async function guarded(def: TableDef, id: string, write: (headers: Record<string, string>) => Promise<unknown>) {
  const { etag } = await getRow(adminBrowserApis().contract, def.path, id);
  return write(ifMatch(etag));
}

/**
 * A table's related lists — a product's images, options and patterns, a pattern's geometry, an
 * article's categories — as a "more" menu on each row and the dialog it opens. Every write
 * replaces the whole list under the row's ETag, as the contract defines them.
 */
export function useRelations(def: TableDef) {
  const t = useTranslations("catalogue.relations");
  const queryClient = useQueryClient();
  const canManage = useCan(def.manage);
  const [open, setOpen] = useState<{ id: RelationId; row: CatalogueRow } | null>(null);
  const relations = RELATIONS[def.key] ?? [];
  const done = () => {
    toast.success(t("saved"));
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", listFor(def).key) });
  };
  const column: DataTableColumn<CatalogueRow>[] =
    relations.length && canManage
      ? [
          {
            id: "relations",
            header: <span className="sr-only">{t("more")}</span>,
            cell: (row) => (
              <DropdownMenu
                label={t("more")}
                trigger={<IconButton name="more" size="sm" variant="ghost" label={t("moreFor")} />}
                items={relations.map((id) => ({ id, label: t(`${id}.menu`), onSelect: () => setOpen({ id, row }) }))}
              />
            ),
          },
        ]
      : [];
  const close = () => setOpen(null);
  const props = open ? { def, row: open.row, onClose: close, onDone: done } : null;
  const dialog = !props
    ? null
    : {
        images: <ImagesDialog {...props} />,
        options: <OptionsDialog {...props} />,
        patterns: <PatternsDialog {...props} />,
        reference: <ReferenceDialog {...props} />,
        attributes: <AttributesDialog {...props} />,
        colours: <ColoursDialog {...props} />,
        fonts: (
          <RefListDialog
            {...props}
            relation="fonts"
            refTable="design-fonts"
            field="fontIds"
            path="fonts"
            bodyKey="fontIds"
          />
        ),
        setDesign: <SetDesignDialog {...props} />,
        flutes: (
          <RefListDialog
            {...props}
            relation="flutes"
            refTable="flute-types"
            field="fluteTypeIds"
            path="flute-types"
            bodyKey="fluteTypeIds"
          />
        ),
        geometry: <GeometryDialog {...props} />,
        categories: (
          <RefListDialog
            {...props}
            relation="categories"
            refTable="article-categories"
            field="categoryIds"
            path="categories"
            bodyKey="categoryIds"
          />
        ),
        products: (
          <RefListDialog
            {...props}
            relation="products"
            refTable="catalog-products"
            field="catalogProductIds"
            path="catalog-products"
            bodyKey="catalogProductIds"
          />
        ),
        bands: <BandsDialog {...props} />,
      }[open!.id];
  return { column, dialog };
}

interface DialogProps {
  def: TableDef;
  row: CatalogueRow;
  onClose: () => void;
  onDone: () => void;
}

function useName(row: CatalogueRow) {
  const locale = useLocale();
  return rowLabel(row, locale);
}

/* ---------------------------------------------------------------------------- id lists */

/** A list of references replaced as a whole: fonts, flute types, article categories, FAQ products. */
function RefListDialog({
  def,
  row,
  onClose,
  onDone,
  relation,
  refTable,
  field,
  path,
  bodyKey,
}: DialogProps & { relation: RelationId; refTable: string; field: string; path: string; bodyKey: string }) {
  const t = useTranslations("catalogue.relations");
  const name = useName(row);
  const refs = useRefs([refTable]);
  const [chosen, setChosen] = useState<Set<string>>(new Set((row[field] as string[] | undefined) ?? []));
  const [search, setSearch] = useState("");
  const options = (refs.options[refTable] ?? []).filter((o) =>
    o.label.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <FormDialog
      size="lg"
      title={t(`${relation}.title`, { name })}
      description={t(`${relation}.intro`)}
      submitLabel={t("saveCount", { count: chosen.size })}
      onClose={onClose}
      onSubmit={async () => {
        await guarded(def, row.id, (headers) =>
          loose(adminBrowserApis().contract).PUT(`${def.path}/{id}/${path}`, {
            params: { path: { id: row.id } },
            body: { [bodyKey]: [...chosen] },
            headers,
          }),
        );
        onDone();
      }}
    >
      <Field label={t("search")}>
        <SearchInput value={search} onValueChange={setSearch} clearLabel={t("clear")} />
      </Field>
      <div className="border-border max-h-80 overflow-y-auto rounded-md border p-2">
        {options.length ? (
          <div className="grid gap-1 sm:grid-cols-2">
            {options.map((option) => (
              <Checkbox
                key={option.value}
                label={option.label}
                checked={chosen.has(option.value)}
                onCheckedChange={(on) => {
                  const next = new Set(chosen);
                  if (on === true) next.add(option.value);
                  else next.delete(option.value);
                  setChosen(next);
                }}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted p-2 text-sm">{t("none")}</p>
        )}
      </div>
    </FormDialog>
  );
}

/* ------------------------------------------------------------------------------ images */

interface ProductImage {
  id: string;
  fileId: string;
  sort: number;
  variant?: Record<string, unknown> | null;
}

/** What `variant` says the image is (D-426): a photograph uploaded here, an AI render, or unsaid. */
const imageSource = (image: ProductImage): "getpack" | "ai-render" | null => {
  const source = image.variant?.source;
  return source === "getpack" || source === "ai-render" ? source : null;
};

const sorted = (images: readonly ProductImage[]) => images.slice().sort((a, b) => a.sort - b.sort);

/**
 * A product's photos as the storefront will show them: the first is the cover. A photo uploaded
 * here leads (the API puts it first, tagged a getpack photograph), so a real photograph replaces
 * the AI-rendered reference as the cover; the renders left behind are flagged so curation can drop
 * them in one go. Reordered by drag or by the arrows (`reorderImages`); the file itself is kept.
 */
function ImagesDialog({ def, row, onClose, onDone }: DialogProps) {
  const t = useTranslations("catalogue.relations");
  const name = useName(row);
  const [images, setImages] = useState<ProductImage[]>(() => sorted((row.images as ProductImage[] | undefined) ?? []));
  const [busy, setBusy] = useState<"upload" | "order" | "remove" | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const save = (next: CatalogueRow) => {
    setImages(sorted((next.images as ProductImage[] | undefined) ?? []));
    onDone();
  };
  const api = loose(adminBrowserApis().contract);

  async function run(kind: NonNullable<typeof busy>, work: () => Promise<{ data?: unknown }>) {
    setBusy(kind);
    try {
      const { data } = await work();
      save(data as CatalogueRow);
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(null);
    }
  }
  const reorder = (ids: string[]) =>
    run(
      "order",
      () =>
        guarded(def, row.id, (headers) =>
          api.PUT(`${def.path}/{id}/images/order`, {
            params: { path: { id: row.id } },
            body: { imageIds: ids },
            headers,
          }),
        ) as Promise<{ data?: unknown }>,
    );
  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    const ids = images.map((image) => image.id);
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id!);
    void reorder(ids);
  };
  const remove = (ids: string[]) =>
    run("remove", async () => {
      let data: unknown;
      for (const imageId of ids)
        ({ data } = (await guarded(def, row.id, (headers) =>
          api.DELETE(`${def.path}/{id}/images/{imageId}`, { params: { path: { id: row.id, imageId } }, headers }),
        )) as { data?: unknown });
      return { data };
    });

  const renders = images.filter((image) => imageSource(image) === "ai-render");
  const hasPhotograph = images.some((image) => imageSource(image) === "getpack");

  return (
    <FormDialog
      size="lg"
      title={t("images.title", { name })}
      description={t("images.intro")}
      submitLabel={t("close")}
      onClose={onClose}
      onSubmit={async () => undefined}
    >
      {hasPhotograph && renders.length > 0 ? (
        // A real photograph is in: the renders it was meant to replace are still in the gallery and
        // keep the storefront's "AI render" note on — say so, with the one action that clears it.
        <div className="border-warning/40 bg-warning-subtle flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
          <Icon name="sparkles" size={18} aria-hidden="true" className="shrink-0" />
          <p className="min-w-0 flex-1">{t("images.rendersLeft", { count: renders.length })}</p>
          <Button
            size="sm"
            variant="secondary"
            loading={busy === "remove"}
            disabled={busy !== null && busy !== "remove"}
            onClick={() => void remove(renders.map((image) => image.id))}
          >
            {t("images.removeRenders", { count: renders.length })}
          </Button>
        </div>
      ) : null}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-busy={busy === "order" || undefined}>
        {images.map((image, index) => {
          const source = imageSource(image);
          const label = t("images.photoNo", { no: index + 1 });
          return (
            <li
              key={image.id}
              draggable={busy === null}
              onDragStart={(event) => {
                setDragging(image.id);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => setDragging(null)}
              onDragOver={(event) => {
                if (dragging && dragging !== image.id) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (!dragging) return;
                const from = images.findIndex((candidate) => candidate.id === dragging);
                setDragging(null);
                move(from, index);
              }}
              className={cn(
                "border-border bg-surface flex flex-col overflow-hidden rounded-md border",
                dragging === image.id && "opacity-50",
                index === 0 && "ring-primary ring-2",
              )}
            >
              <div className="relative">
                <FileImage fileId={image.fileId} alt={label} className="aspect-square w-full" />
                <div className="absolute inset-x-2 top-2 flex flex-wrap gap-1">
                  {index === 0 ? <Badge tone="primary">{t("images.cover")}</Badge> : null}
                  {source === "getpack" ? (
                    <Badge tone="success">{t("images.sourcePhoto")}</Badge>
                  ) : source === "ai-render" ? (
                    <Badge tone="warning">{t("images.sourceRender")}</Badge>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-1 p-1.5">
                <IconButton
                  name="arrow-left"
                  label={t("images.moveEarlier", { no: index + 1 })}
                  size="sm"
                  variant="ghost"
                  disabled={index === 0 || busy !== null}
                  onClick={() => move(index, index - 1)}
                />
                <IconButton
                  name="arrow-right"
                  label={t("images.moveLater", { no: index + 1 })}
                  size="sm"
                  variant="ghost"
                  disabled={index === images.length - 1 || busy !== null}
                  onClick={() => move(index, index + 1)}
                />
                {index > 0 ? (
                  <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => move(index, 0)}>
                    {t("images.makeCover")}
                  </Button>
                ) : null}
                <span className="ms-auto flex items-center">
                  <FileButton size="sm" variant="ghost" iconStart="external" fileId={image.fileId}>
                    <span className="sr-only">{t("images.open")}</span>
                  </FileButton>
                  <IconButton
                    name="trash"
                    label={t("images.removeNo", { no: index + 1 })}
                    size="sm"
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={() => void remove([image.id])}
                  />
                </span>
              </div>
            </li>
          );
        })}
        {images.length === 0 ? <li className="text-muted col-span-full text-sm">{t("images.none")}</li> : null}
      </ul>
      <p className="text-muted text-xs">{t("images.orderHint")}</p>
      <FileDropzone
        accept="image/png,image/jpeg,image/webp"
        multiple
        maxBytes={20 * 1024 * 1024}
        disabled={busy !== null}
        onFiles={async (files) => {
          // No `sort`: the API puts each upload first, so the last file dropped is the cover.
          await run("upload", async () => {
            let data: unknown;
            for (const file of files) {
              const uploaded = await uploadFile("admin", file, "image");
              ({ data } = (await guarded(def, row.id, (headers) =>
                api.POST(`${def.path}/{id}/images`, {
                  params: { path: { id: row.id } },
                  body: { fileId: uploaded.id },
                  headers,
                }),
              )) as { data?: unknown });
            }
            return { data };
          });
        }}
        labels={{
          prompt: busy === "upload" ? t("images.uploading") : t("images.drop"),
          browse: t("images.browse"),
          tooLarge: (file) => t("images.tooLarge", { name: file }),
          wrongType: (file) => t("images.wrongType", { name: file }),
        }}
      />
    </FormDialog>
  );
}

/* ----------------------------------------------------------------------------- options */

/** What a product offers the customer, per kind, with one default per kind (D-100). */
function OptionsDialog({ def, row, onClose, onDone }: DialogProps) {
  const t = useTranslations("catalogue.relations");
  const name = useName(row);
  const refs = useRefs(Object.values(KIND_TABLE));
  const initial = (row.options as Schemas["CatalogProductOptionDto"][]) ?? [];
  const [chosen, setChosen] = useState<Record<Kind, string[]>>(
    () =>
      Object.fromEntries(
        KINDS.map((k) => [
          k,
          initial
            .filter((o) => o.kind === k)
            .sort((a, b) => a.sort - b.sort)
            .map((o) => o.optionId),
        ]),
      ) as Record<Kind, string[]>,
  );
  const [defaults, setDefaults] = useState<Partial<Record<Kind, string>>>(
    () =>
      Object.fromEntries(initial.filter((o) => o.isDefault).map((o) => [o.kind, o.optionId])) as Partial<
        Record<Kind, string>
      >,
  );
  const [kind, setKind] = useState<Kind>("material");
  const [search, setSearch] = useState("");
  const options = (refs.options[KIND_TABLE[kind]] ?? []).filter((o) =>
    o.label.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const total = KINDS.reduce((sum, k) => sum + chosen[k].length, 0);
  return (
    <FormDialog
      size="lg"
      title={t("options.title", { name })}
      description={t("options.intro")}
      submitLabel={t("saveCount", { count: total })}
      onClose={onClose}
      onSubmit={async () => {
        const body = {
          options: KINDS.flatMap((k) =>
            chosen[k].map((optionId, i) => ({
              kind: k,
              optionId,
              sort: (i + 1) * 10,
              isDefault: defaults[k] === optionId,
            })),
          ),
        };
        await guarded(def, row.id, (headers) =>
          loose(adminBrowserApis().contract).PUT(`${def.path}/{id}/options`, {
            params: { path: { id: row.id } },
            body,
            headers,
          }),
        );
        onDone();
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("options.kind")} className="w-56">
          <NativeSelect
            value={kind}
            onValueChange={(value) => {
              setKind(value as Kind);
              setSearch("");
            }}
            options={KINDS.map((k) => ({
              value: k,
              label: t("options.kindCount", { kind: t(`options.kinds.${k}`), count: chosen[k].length }),
            }))}
          />
        </Field>
        <Field label={t("search")} className="min-w-48 flex-1">
          <SearchInput value={search} onValueChange={setSearch} clearLabel={t("clear")} />
        </Field>
      </div>
      <ul className="border-border max-h-80 overflow-y-auto rounded-md border p-2">
        {options.map((option) => {
          const on = chosen[kind].includes(option.value);
          return (
            <li key={option.value} className="flex items-center gap-2 py-0.5">
              <Checkbox
                label={option.label}
                checked={on}
                onCheckedChange={(next) => {
                  setChosen({
                    ...chosen,
                    [kind]:
                      next === true
                        ? [...chosen[kind], option.value]
                        : chosen[kind].filter((id) => id !== option.value),
                  });
                  if (next !== true && defaults[kind] === option.value) setDefaults({ ...defaults, [kind]: undefined });
                }}
              />
              {on ? (
                <Button
                  size="sm"
                  variant={defaults[kind] === option.value ? "secondary" : "ghost"}
                  className="ms-auto"
                  onClick={() => setDefaults({ ...defaults, [kind]: option.value })}
                >
                  {defaults[kind] === option.value ? t("options.isDefault") : t("options.makeDefault")}
                </Button>
              ) : null}
            </li>
          );
        })}
        {options.length === 0 ? <li className="text-muted p-2 text-sm">{t("none")}</li> : null}
      </ul>
    </FormDialog>
  );
}

/* ---------------------------------------------------------------------------- patterns */

type PatternLine = { key: string; patternId: string; factorNw: string; factorNl: string; factorNd: string };
let lineSeq = 0;
const lineKey = () => `l${++lineSeq}`;
const optNum = (text: string) => (text.trim() === "" ? null : Number(text));

/** The patterns a product is made in, with their indicative factors (legacy `mapping_input_rel_patterns`). */
function PatternsDialog({ def, row, onClose, onDone }: DialogProps) {
  const t = useTranslations("catalogue.relations");
  const name = useName(row);
  const refs = useRefs(["patterns"]);
  const [lines, setLines] = useState<PatternLine[]>(() =>
    ((row.patterns as Schemas["CatalogProductPatternDto"][]) ?? [])
      .slice()
      .sort((a, b) => a.sort - b.sort)
      .map((p) => ({
        key: lineKey(),
        patternId: p.patternId,
        factorNw: p.factorNw === null ? "" : String(p.factorNw),
        factorNl: p.factorNl === null ? "" : String(p.factorNl),
        factorNd: p.factorNd === null ? "" : String(p.factorNd),
      })),
  );
  const set = (key: string, patch: Partial<PatternLine>) =>
    setLines(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  return (
    <FormDialog
      size="lg"
      title={t("patterns.title", { name })}
      description={t("patterns.intro")}
      submitLabel={t("saveCount", { count: lines.length })}
      onClose={onClose}
      onSubmit={async () => {
        if (lines.some((l) => !l.patternId)) throw new FormError(t("patterns.choose"));
        if (new Set(lines.map((l) => l.patternId)).size !== lines.length) throw new FormError(t("patterns.duplicate"));
        const body = {
          patterns: lines.map((l, i) => ({
            patternId: l.patternId,
            sort: (i + 1) * 10,
            factorNw: optNum(l.factorNw),
            factorNl: optNum(l.factorNl),
            factorNd: optNum(l.factorNd),
          })),
        };
        await guarded(def, row.id, (headers) =>
          loose(adminBrowserApis().contract).PUT(`${def.path}/{id}/patterns`, {
            params: { path: { id: row.id } },
            body,
            headers,
          }),
        );
        onDone();
      }}
    >
      <ul className="flex flex-col gap-2">
        {lines.map((line) => (
          <li key={line.key} className="flex flex-wrap items-end gap-2">
            <Field label={t("patterns.pattern")} className="min-w-56 flex-1">
              <NativeSelect
                value={line.patternId}
                onValueChange={(patternId) => set(line.key, { patternId })}
                options={[{ value: "", label: t("patterns.choose") }, ...(refs.options.patterns ?? [])]}
              />
            </Field>
            {(["factorNw", "factorNl", "factorNd"] as const).map((key) => (
              <Field key={key} label={t(`patterns.${key}`)} className="w-24">
                <Input
                  inputMode="decimal"
                  value={line[key]}
                  onChange={(e) => set(line.key, { [key]: e.target.value })}
                />
              </Field>
            ))}
            <IconButton
              name="trash"
              variant="ghost"
              label={t("remove")}
              onClick={() => setLines(lines.filter((l) => l.key !== line.key))}
            />
          </li>
        ))}
      </ul>
      <Button
        size="sm"
        variant="secondary"
        iconStart="plus"
        onClick={() =>
          setLines([...lines, { key: lineKey(), patternId: "", factorNw: "", factorNl: "", factorNd: "" }])
        }
      >
        {t("add")}
      </Button>
    </FormDialog>
  );
}

/* --------------------------------------------------------------------------- reference */

/** The configuration a product card's "starting from" price is quoted at (D-220); clearing removes the price. */
function ReferenceDialog({ def, row, onClose, onDone }: DialogProps) {
  const t = useTranslations("catalogue.relations");
  const name = useName(row);
  const [text, setText] = useState(
    row.referenceConfiguration ? JSON.stringify(row.referenceConfiguration, null, 2) : "",
  );
  const [clearing, setClearing] = useState(false);
  return (
    <FormDialog
      size="lg"
      title={t("reference.title", { name })}
      description={t("reference.intro")}
      submitLabel={clearing ? t("reference.clear") : t("reference.save")}
      destructive={clearing}
      onClose={onClose}
      onSubmit={async () => {
        if (clearing) {
          await guarded(def, row.id, (headers) =>
            loose(adminBrowserApis().contract).DELETE(`${def.path}/{id}/reference-configuration`, {
              params: { path: { id: row.id } },
              headers,
            }),
          );
        } else {
          let configuration: unknown;
          try {
            configuration = JSON.parse(text);
          } catch {
            throw new FormError(t("reference.invalid"));
          }
          if (!configuration || typeof configuration !== "object" || Array.isArray(configuration))
            throw new FormError(t("reference.invalid"));
          await guarded(def, row.id, (headers) =>
            loose(adminBrowserApis().contract).PUT(`${def.path}/{id}/reference-configuration`, {
              params: { path: { id: row.id } },
              body: { configuration },
              headers,
            }),
          );
        }
        onDone();
      }}
    >
      <Field label={t("reference.configuration")} hint={t("reference.hint")}>
        <Textarea
          rows={12}
          className="font-mono text-xs"
          value={text}
          disabled={clearing}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      {row.referenceConfiguration ? (
        <Checkbox
          label={t("reference.clearLabel")}
          checked={clearing}
          onCheckedChange={(on) => setClearing(on === true)}
        />
      ) : null}
    </FormDialog>
  );
}

/* -------------------------------------------------------------------------- attributes */

/** A stock product's attributes, one value per attribute, each from that attribute's values. */
function AttributesDialog({ def, row, onClose, onDone }: DialogProps) {
  const t = useTranslations("catalogue.relations");
  const locale = useLocale();
  const name = useName(row);
  const values = useQuery({
    queryKey: queryKeys.list("admin", "catalog_stock_attribute_values", { perPage: 100, all: true }),
    queryFn: async () => {
      const rows: CatalogueRow[] = [];
      for (let page = 1; page <= 10; page++) {
        const data = await listRows(adminBrowserApis().contract, "/v1/admin/catalog/stock-attribute-values", {
          page,
          perPage: 100,
        });
        rows.push(...data.data);
        if (page * data.meta.perPage >= data.meta.total) break;
      }
      return rows;
    },
  });
  const [chosen, setChosen] = useState<Partial<Record<StockAttribute, string>>>(
    () =>
      Object.fromEntries(
        ((row.attributes as Schemas["StockProductAttributeDto"][]) ?? []).map((a) => [a.attribute, a.valueId]),
      ) as Partial<Record<StockAttribute, string>>,
  );
  return (
    <FormDialog
      size="lg"
      title={t("attributes.title", { name })}
      description={t("attributes.intro")}
      submitLabel={t("save")}
      onClose={onClose}
      onSubmit={async () => {
        const body = {
          attributes: STOCK_ATTRIBUTES.flatMap((attribute) =>
            chosen[attribute] ? [{ attribute, valueId: chosen[attribute]! }] : [],
          ),
        };
        await guarded(def, row.id, (headers) =>
          loose(adminBrowserApis().contract).PUT(`${def.path}/{id}/attributes`, {
            params: { path: { id: row.id } },
            body,
            headers,
          }),
        );
        onDone();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {STOCK_ATTRIBUTES.map((attribute) => (
          <Field key={attribute} label={t(`attributes.names.${attribute}`)}>
            <NativeSelect
              value={chosen[attribute] ?? ""}
              onValueChange={(value) => setChosen({ ...chosen, [attribute]: value || undefined })}
              options={[
                { value: "", label: t("attributes.unset") },
                ...(values.data ?? [])
                  .filter((v) => v.attribute === attribute)
                  .map((v) => ({ value: v.id, label: rowLabel(v, locale) })),
              ]}
            />
          </Field>
        ))}
      </div>
    </FormDialog>
  );
}

/* ----------------------------------------------------------------------------- colours */

/** A semi-design's palette, `#RRGGBB` each once, in display order. */
function ColoursDialog({ def, row, onClose, onDone }: DialogProps) {
  const t = useTranslations("catalogue.relations");
  const name = useName(row);
  const [colours, setColours] = useState<string[]>(((row.colours as string[]) ?? []).slice());
  return (
    <FormDialog
      title={t("colours.title", { name })}
      description={t("colours.intro")}
      submitLabel={t("saveCount", { count: colours.length })}
      onClose={onClose}
      onSubmit={async () => {
        const list = colours.map((c) => c.trim().toUpperCase());
        if (list.some((c) => !HEX.test(c))) throw new FormError(t("colours.invalid"));
        if (new Set(list).size !== list.length) throw new FormError(t("colours.duplicate"));
        await guarded(def, row.id, (headers) =>
          loose(adminBrowserApis().contract).PUT(`${def.path}/{id}/colours`, {
            params: { path: { id: row.id } },
            body: { colours: list },
            headers,
          }),
        );
        onDone();
      }}
    >
      <ul className="flex flex-col gap-2">
        {colours.map((colour, index) => (
          <li key={index} className="flex items-center gap-2">
            <input
              type="color"
              aria-label={t("colours.pick", { n: index + 1 })}
              className="border-border h-9 w-12 cursor-pointer rounded-md border"
              value={HEX.test(colour) ? colour : "#000000"}
              onChange={(e) => setColours(colours.map((c, i) => (i === index ? e.target.value.toUpperCase() : c)))}
            />
            <Input
              className="w-32 font-mono"
              aria-label={t("colours.hex", { n: index + 1 })}
              value={colour}
              onChange={(e) => setColours(colours.map((c, i) => (i === index ? e.target.value : c)))}
            />
            <IconButton
              name="trash"
              variant="ghost"
              size="sm"
              label={t("remove")}
              onClick={() => setColours(colours.filter((_, i) => i !== index))}
            />
          </li>
        ))}
      </ul>
      <Button size="sm" variant="secondary" iconStart="plus" onClick={() => setColours([...colours, "#000000"])}>
        {t("colours.add")}
      </Button>
    </FormDialog>
  );
}

/* -------------------------------------------------------------------------- set design */

/** The staff-authored design whose current version a semi-design template starts customers from (D-005). */
function SetDesignDialog({ row, onClose, onDone }: DialogProps) {
  const t = useTranslations("catalogue.relations");
  const name = useName(row);
  const [designId, setDesignId] = useState("");
  return (
    <FormDialog
      title={t("setDesign.title", { name })}
      description={t("setDesign.intro")}
      submitLabel={t("setDesign.use")}
      onClose={onClose}
      onSubmit={async () => {
        if (!/^[0-9a-f-]{36}$/i.test(designId.trim())) throw new FormError(t("setDesign.invalid"));
        await adminBrowserApis().contract.POST(
          "/v1/admin/catalog/semi-design-templates/{templateId}/actions/set-design",
          {
            params: { path: { templateId: row.id } },
            body: { designId: designId.trim() },
          },
        );
        onDone();
      }}
    >
      <Field label={t("setDesign.designId")} hint={t("setDesign.hint")} required>
        <Input className="font-mono" value={designId} onChange={(e) => setDesignId(e.target.value)} />
      </Field>
    </FormDialog>
  );
}

/* ------------------------------------------------------------------------------- bands */

type Band = { key: string; lower: string; upper: string; value: string };

/** A geometry band table's bands: inclusive bounds, never overlapping, read in order (legacy `conditions`). */
function BandsDialog({ def, row, onClose, onDone }: DialogProps) {
  const t = useTranslations("catalogue.relations");
  const name = useName(row);
  const [bands, setBands] = useState<Band[]>(() =>
    ((row.bands as Schemas["GeometryBandDto"][]) ?? []).map((b) => ({
      key: lineKey(),
      lower: String(b.lower),
      upper: String(b.upper),
      value: String(b.value),
    })),
  );
  const set = (key: string, patch: Partial<Band>) =>
    setBands(bands.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  return (
    <FormDialog
      size="lg"
      title={t("bands.title", { name })}
      description={t("bands.intro")}
      submitLabel={t("saveCount", { count: bands.length })}
      onClose={onClose}
      onSubmit={async () => {
        const parsed = bands.map((b) => ({ lower: Number(b.lower), upper: Number(b.upper), value: Number(b.value) }));
        if (bands.some((b) => [b.lower, b.upper, b.value].some((x) => x.trim() === "" || !Number.isFinite(Number(x)))))
          throw new FormError(t("bands.invalid"));
        if (parsed.some((b) => b.upper < b.lower)) throw new FormError(t("bands.order"));
        const sorted = [...parsed].sort((a, b) => a.lower - b.lower);
        if (sorted.some((b, i) => i > 0 && b.lower <= sorted[i - 1]!.upper)) throw new FormError(t("bands.overlap"));
        await guarded(def, row.id, (headers) =>
          loose(adminBrowserApis().contract).PUT(`${def.path}/{id}/bands`, {
            params: { path: { id: row.id } },
            body: { bands: parsed },
            headers,
          }),
        );
        onDone();
      }}
    >
      <table className="w-full text-sm">
        <thead className="text-muted text-xs">
          <tr>
            <th className="px-1 py-1 text-start font-medium">{t("bands.lower")}</th>
            <th className="px-1 py-1 text-start font-medium">{t("bands.upper")}</th>
            <th className="px-1 py-1 text-start font-medium">{t("bands.value")}</th>
            <th className="px-1 py-1">
              <span className="sr-only">{t("remove")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {bands.map((band, index) => (
            <tr key={band.key}>
              {(["lower", "upper", "value"] as const).map((key) => (
                <td key={key} className="px-1 py-1">
                  <Input
                    inputSize="sm"
                    inputMode="decimal"
                    aria-label={`${t(`bands.${key}`)} ${index + 1}`}
                    value={band[key]}
                    onChange={(e) => set(band.key, { [key]: e.target.value })}
                  />
                </td>
              ))}
              <td className="px-1 py-1">
                <IconButton
                  name="trash"
                  variant="ghost"
                  size="sm"
                  label={t("remove")}
                  onClick={() => setBands(bands.filter((b) => b.key !== band.key))}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button
        size="sm"
        variant="secondary"
        iconStart="plus"
        onClick={() => {
          const last = bands.at(-1);
          const from = last && last.upper.trim() !== "" ? String(Number(last.upper) + 1) : "0";
          setBands([...bands, { key: lineKey(), lower: from, upper: "", value: "" }]);
        }}
      >
        {t("add")}
      </Button>
    </FormDialog>
  );
}

/* ---------------------------------------------------------------------------- geometry */

type SlotLine = { key: string; slot: Slot; subPatternId: string; seq: string; conditionId: string };
type BlankLine = { key: string; standardSizeId: string; dwMm: string; dlMm: string };

/**
 * A pattern's geometry (U-B6): which condition each slot reads — the folding slots of the pattern
 * and its parts, or the corrugate slots — and its die-cut blank at each standard size.
 */
function GeometryDialog({ def, row, onClose, onDone }: DialogProps) {
  const t = useTranslations("catalogue.relations");
  const name = useName(row);
  const refs = useRefs(["geometry-conditions", "sub-patterns", "standard-sizes"]);
  const corrugate = Boolean(row.corrugateFormula);
  const slots: readonly Slot[] = corrugate ? CORRUGATE_SLOTS : FOLDING_SLOTS;
  const [lines, setLines] = useState<SlotLine[] | null>(null);
  const [blanks, setBlanks] = useState<BlankLine[] | null>(null);
  const geometry = useQuery({
    queryKey: queryKeys.related("admin", "catalog_pattern", row.id, "geometry"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/catalog/patterns/{id}/geometry", {
          params: { path: { id: row.id } },
        })
      ).data!,
  });
  const shownLines =
    lines ??
    (geometry.data?.conditions ?? []).map((c) => ({
      key: lineKey(),
      slot: c.slot,
      subPatternId: c.subPatternId ?? "",
      seq: String(c.seq),
      conditionId: c.conditionId,
    }));
  const shownBlanks =
    blanks ??
    (geometry.data?.standardBlanks ?? []).map((b) => ({
      key: lineKey(),
      standardSizeId: b.standardSizeId,
      dwMm: String(b.dwMm),
      dlMm: String(b.dlMm),
    }));
  const setLine = (key: string, patch: Partial<SlotLine>) =>
    setLines(shownLines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const setBlank = (key: string, patch: Partial<BlankLine>) =>
    setBlanks(shownBlanks.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  return (
    <FormDialog
      size="xl"
      title={t("geometry.title", { name })}
      description={corrugate ? t("geometry.introCorrugate") : t("geometry.introFolding")}
      submitLabel={t("save")}
      onClose={onClose}
      onSubmit={async () => {
        if (geometry.isPending) throw new FormError(t("loading"));
        if (shownLines.some((l) => !l.conditionId)) throw new FormError(t("geometry.chooseCondition"));
        if (shownBlanks.some((b) => !b.standardSizeId || !(Number(b.dwMm) > 0) || !(Number(b.dlMm) > 0)))
          throw new FormError(t("geometry.blankInvalid"));
        if (new Set(shownBlanks.map((b) => b.standardSizeId)).size !== shownBlanks.length)
          throw new FormError(t("geometry.blankDuplicate"));
        if (lines) {
          await guarded(def, row.id, (headers) =>
            loose(adminBrowserApis().contract).PUT(`${def.path}/{id}/geometry-conditions`, {
              params: { path: { id: row.id } },
              body: {
                conditions: shownLines.map((l) => ({
                  slot: l.slot,
                  conditionId: l.conditionId,
                  seq: Number(l.seq) || 1,
                  subPatternId: corrugate ? null : l.subPatternId || null,
                })),
              },
              headers,
            }),
          );
        }
        if (blanks) {
          await guarded(def, row.id, (headers) =>
            loose(adminBrowserApis().contract).PUT(`${def.path}/{id}/standard-blanks`, {
              params: { path: { id: row.id } },
              body: {
                standardBlanks: shownBlanks.map((b) => ({
                  standardSizeId: b.standardSizeId,
                  dwMm: Number(b.dwMm),
                  dlMm: Number(b.dlMm),
                })),
              },
              headers,
            }),
          );
        }
        onDone();
      }}
    >
      <section>
        <h3 className="mb-2 text-sm font-semibold">{t("geometry.slots")}</h3>
        <ul className="flex flex-col gap-2">
          {shownLines.map((line) => (
            <li key={line.key} className="flex flex-wrap items-end gap-2">
              <Field label={t("geometry.slot")} className="w-28">
                <NativeSelect
                  value={line.slot}
                  onValueChange={(slot) => setLine(line.key, { slot: slot as Slot })}
                  options={slots.map((s) => ({ value: s, label: s }))}
                />
              </Field>
              {!corrugate ? (
                <Field label={t("geometry.part")} className="w-48">
                  <NativeSelect
                    value={line.subPatternId}
                    onValueChange={(subPatternId) => setLine(line.key, { subPatternId })}
                    options={[
                      { value: "", label: t("geometry.wholePattern") },
                      ...(refs.options["sub-patterns"] ?? []),
                    ]}
                  />
                </Field>
              ) : null}
              <Field label={t("geometry.seq")} className="w-20">
                <NumberInput min={1} value={line.seq} onChange={(e) => setLine(line.key, { seq: e.target.value })} />
              </Field>
              <Field label={t("geometry.condition")} className="min-w-48 flex-1">
                <NativeSelect
                  value={line.conditionId}
                  onValueChange={(conditionId) => setLine(line.key, { conditionId })}
                  options={[
                    { value: "", label: t("geometry.chooseCondition") },
                    ...(refs.options["geometry-conditions"] ?? []),
                  ]}
                />
              </Field>
              <IconButton
                name="trash"
                variant="ghost"
                label={t("remove")}
                onClick={() => setLines(shownLines.filter((l) => l.key !== line.key))}
              />
            </li>
          ))}
        </ul>
        <Button
          size="sm"
          variant="secondary"
          iconStart="plus"
          className="mt-2"
          onClick={() =>
            setLines([...shownLines, { key: lineKey(), slot: slots[0]!, subPatternId: "", seq: "1", conditionId: "" }])
          }
        >
          {t("geometry.addSlot")}
        </Button>
      </section>
      {!corrugate ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold">{t("geometry.blanks")}</h3>
          <ul className="flex flex-col gap-2">
            {shownBlanks.map((blank) => (
              <li key={blank.key} className="flex flex-wrap items-end gap-2">
                <Field label={t("geometry.standardSize")} className="min-w-48 flex-1">
                  <NativeSelect
                    value={blank.standardSizeId}
                    onValueChange={(standardSizeId) => setBlank(blank.key, { standardSizeId })}
                    options={[
                      { value: "", label: t("geometry.chooseSize") },
                      ...(refs.options["standard-sizes"] ?? []),
                    ]}
                  />
                </Field>
                <Field label={t("geometry.dw")} className="w-28">
                  <NumberInput
                    unit="mm"
                    min={0}
                    value={blank.dwMm}
                    onChange={(e) => setBlank(blank.key, { dwMm: e.target.value })}
                  />
                </Field>
                <Field label={t("geometry.dl")} className="w-28">
                  <NumberInput
                    unit="mm"
                    min={0}
                    value={blank.dlMm}
                    onChange={(e) => setBlank(blank.key, { dlMm: e.target.value })}
                  />
                </Field>
                <IconButton
                  name="trash"
                  variant="ghost"
                  label={t("remove")}
                  onClick={() => setBlanks(shownBlanks.filter((b) => b.key !== blank.key))}
                />
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            variant="secondary"
            iconStart="plus"
            className="mt-2"
            onClick={() => setBlanks([...shownBlanks, { key: lineKey(), standardSizeId: "", dwMm: "", dlMm: "" }])}
          >
            {t("geometry.addBlank")}
          </Button>
        </section>
      ) : null}
    </FormDialog>
  );
}
