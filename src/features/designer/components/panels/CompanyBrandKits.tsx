"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { ColorField } from "@/ui/components/ColorField";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import { extractPalette, imagePixels } from "../../lib/palette";
import { useEditor } from "../../store/editor";
import { applyBrand, type ColourRole } from "../../templates/layout";
import { useDesigner } from "../DesignerContext";

type Kit = Schemas["BrandKitDto"];
type Asset = Schemas["CompanyAssetDto"];
/** A kit's palette in order fills the template roles: the first colour is primary, then accent, ink, paper. */
const ROLES: ColourRole[] = ["primary", "accent", "ink", "paper"];
const DEFAULT_PALETTE = ["#1f6f78", "#f2c14e", "#1b2a2f", "#ffffff"];

/** A file the customer may read, as a data URL — so it is stored with the design as its own asset. */
async function asDataUrl(fileId: string): Promise<{ src: string; naturalWidth: number; naturalHeight: number }> {
  const { data } = await browserApi().GET("/v1/store/files/{fileId}/download", { params: { path: { fileId } } });
  const blob = await (await fetch(data!.url)).blob();
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const size = await new Promise<{ naturalWidth: number; naturalHeight: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
    img.onerror = () => resolve({ naturalWidth: 1, naturalHeight: 1 });
    img.src = src;
  });
  return { src, ...size };
}

/**
 * The company's brand kits (U4.4, D-227, D-282): logos from the company's brand assets, a palette
 * (extracted from the logo, then edited), the studio's print-licensed font pairs and usage notes —
 * kept by getpack-api for the whole company. "ใช้แบรนด์ของฉัน" restyles every template piece on the
 * box in one click: colours and fonts by role, the logo into the logo slots. The Company Admin
 * keeps the kits; getpack-api refuses anyone else's edit, and the panel says so.
 */
export function CompanyBrandKits() {
  const t = useTranslations("designer.brandKits");
  const { catalog, mode } = useDesigner();
  const client = useQueryClient();
  const companies = useQuery({
    queryKey: [...queryKeys.zone("customer"), "my-companies"],
    queryFn: async () => (await browserApi().GET("/v1/store/companies")).data!,
    enabled: mode === "store",
    staleTime: 10 * 60_000,
  });
  const company = companies.data?.[0] ?? null;
  const kitsKey = [...queryKeys.zone("customer"), "brand-kits", company?.id];
  const kits = useQuery({
    queryKey: kitsKey,
    queryFn: async () =>
      (
        await browserApi().GET("/v1/store/companies/{companyId}/brand-kits", {
          params: { path: { companyId: company!.id } },
        })
      ).data!,
    enabled: !!company,
  });
  const assets = useQuery({
    queryKey: [...queryKeys.zone("customer"), "brand-assets", company?.id],
    queryFn: async () =>
      (
        await browserApi().GET("/v1/store/companies/{companyId}/brand-assets", {
          params: { path: { companyId: company!.id } },
        })
      ).data!,
    enabled: !!company,
  });
  const [editing, setEditing] = useState<Kit | "new" | null>(null);

  const fontFamily = (id: string | undefined) => catalog?.fonts.find((f) => f.id === id)?.family;

  const apply = useMutation({
    mutationFn: async (kit: Kit) => {
      const logo = kit.logos.find((l) => l.role === "primary") ?? kit.logos[0];
      // A logo that cannot be read (not scanned yet, gone) leaves the logo slots as they are.
      const image = logo ? await asDataUrl(logo.fileId).catch(() => null) : null;
      const pair = kit.fontPairs[0];
      const editor = useEditor.getState();
      const branded = applyBrand(editor.content, {
        palette: Object.fromEntries(kit.palette.slice(0, 4).map((c, i) => [ROLES[i], c.hex])),
        fonts: {
          ...(fontFamily(pair?.heading) ? { heading: fontFamily(pair?.heading) } : {}),
          ...(fontFamily(pair?.body) ? { body: fontFamily(pair?.body) } : {}),
        },
        logo: image,
      });
      editor.commit(() => branded);
      return kit;
    },
    onSuccess: (kit) => toast.success(t("applied", { name: kit.name })),
    onError: () => toast.error(t("applyFailed")),
  });

  if (mode !== "store" || !company) return null;

  return (
    <section className="space-y-3" aria-labelledby="brand-kits">
      <h3 id="brand-kits" className="text-sm font-semibold">
        {t("title", { company: company.tradeName ?? company.legalName })}
      </h3>
      {kits.data && kits.data.length === 0 ? <p className="text-muted text-sm">{t("none")}</p> : null}
      <ul className="space-y-2">
        {(kits.data ?? [])
          .filter((kit) => kit.status === "active")
          .map((kit) => (
            <li key={kit.id} className="border-border rounded-card space-y-2 border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{kit.name}</span>
                <span className="flex gap-1" aria-hidden="true">
                  {kit.palette.slice(0, 4).map((c) => (
                    <span
                      key={c.hex}
                      className="border-border h-5 w-5 rounded-full border"
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" loading={apply.isPending} onClick={() => apply.mutate(kit)}>
                  {t("apply")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(kit)}>
                  {t("edit")}
                </Button>
              </div>
            </li>
          ))}
      </ul>
      <Button size="sm" variant="secondary" iconStart="plus" onClick={() => setEditing("new")}>
        {t("create")}
      </Button>
      {editing ? (
        <KitEditor
          companyId={company.id}
          kit={editing === "new" ? null : editing}
          logos={(assets.data ?? []).filter((a) => a.kind === "logo")}
          fonts={catalog?.fonts ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void client.invalidateQueries({ queryKey: kitsKey });
          }}
        />
      ) : null}
    </section>
  );
}

function KitEditor({
  companyId,
  kit,
  logos,
  fonts,
  onClose,
  onSaved,
}: {
  companyId: string;
  kit: Kit | null;
  logos: Asset[];
  fonts: { id: string; family: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("designer.brandKits");
  const [name, setName] = useState(kit?.name ?? "");
  const [logo, setLogo] = useState(kit?.logos[0]?.brandAssetId ?? logos[0]?.id ?? "");
  const [palette, setPalette] = useState<string[]>(
    kit?.palette.length ? kit.palette.map((c) => c.hex) : DEFAULT_PALETTE,
  );
  const [heading, setHeading] = useState(kit?.fontPairs[0]?.heading ?? fonts[0]?.id ?? "");
  const [body, setBody] = useState(kit?.fontPairs[0]?.body ?? fonts[0]?.id ?? "");
  const [notes, setNotes] = useState(kit?.usageNotes ?? "");

  const extract = useMutation({
    mutationFn: async () => {
      const asset = logos.find((a) => a.id === logo);
      if (!asset) return [];
      const { src } = await asDataUrl(asset.fileId);
      return extractPalette(await imagePixels(src), 4);
    },
    onSuccess: (found) => {
      if (found.length === 0) return void toast.info(t("noColours"));
      setPalette((current) => current.map((hex, i) => found[i] ?? hex));
    },
    onError: () => toast.error(t("extractFailed")),
  });

  const save = useMutation({
    mutationFn: async () => {
      const body_: Schemas["BrandKitInputDto"] = {
        name: name.trim(),
        logos: logo ? [{ brandAssetId: logo, role: "primary" }] : [],
        palette: palette.map((hex, i) => ({ hex, name: t(`roles.${ROLES[i]!}`) })),
        fontPairs: heading && body ? [{ heading, body }] : [],
        usageNotes: notes.trim() || null,
      };
      if (kit) {
        // Kits are edited under If-Match: the version read now, so another admin's edit is not lost.
        const { response } = await browserApi().GET("/v1/store/companies/{companyId}/brand-kits/{kitId}", {
          params: { path: { companyId, kitId: kit.id } },
        });
        await browserApi().PUT("/v1/store/companies/{companyId}/brand-kits/{kitId}", {
          params: { path: { companyId, kitId: kit.id }, header: { "If-Match": response.headers.get("etag") ?? "" } },
          body: body_,
        });
      }
      else
        await browserApi().POST("/v1/store/companies/{companyId}/brand-kits", {
          params: { path: { companyId } },
          body: body_,
        });
    },
    onSuccess: onSaved,
    onError: (error) =>
      toast.error(
        isApiError(error) && error.status === 403 ? t("adminOnly") : isApiError(error) ? error.detail : t("saveFailed"),
      ),
  });

  const fontOptions = fonts.map((f) => ({ value: f.id, label: f.family }));
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={kit ? t("editTitle") : t("createTitle")}
      description={t("editorBody")}
      size="md"
      footer={
        <Button disabled={!name.trim()} loading={save.isPending} onClick={() => save.mutate()}>
          {t("save")}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label={t("name")}>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label={t("logo")} hint={logos.length ? undefined : t("noLogos")}>
          <Select
            value={logo}
            onValueChange={setLogo}
            disabled={logos.length === 0}
            options={logos.map((a) => ({ value: a.id, label: a.name }))}
          />
        </Field>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t("palette")}</span>
            <Button
              size="sm"
              variant="ghost"
              disabled={!logo}
              loading={extract.isPending}
              onClick={() => extract.mutate()}
            >
              {t("extract")}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {palette.map((hex, i) => (
              <Field key={ROLES[i]} label={t(`roles.${ROLES[i]!}`)}>
                <ColorField
                  value={hex}
                  hexLabel={t(`roles.${ROLES[i]!}`)}
                  onValueChange={(next) => setPalette((p) => p.map((c, j) => (j === i ? next : c)))}
                />
              </Field>
            ))}
          </div>
        </div>
        {fontOptions.length ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("heading")}>
              <Select value={heading} onValueChange={setHeading} options={fontOptions} />
            </Field>
            <Field label={t("body")}>
              <Select value={body} onValueChange={setBody} options={fontOptions} />
            </Field>
          </div>
        ) : null}
        <Field label={t("notes")}>
          <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
