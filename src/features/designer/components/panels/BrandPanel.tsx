"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/ui/components/Button";
import { ColorField } from "@/ui/components/ColorField";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { toast } from "@/ui/components/Toast";

import { newImage } from "../../lib/create";
import { useEditor } from "../../store/editor";
import type { DesignElement, ImageElement } from "../../types";
import { applyBrand } from "../../templates/layout";
import { useDesigner } from "../DesignerContext";
import { readBrandKit, saveBrandKit, type BrandKit } from "./brand-kit";
import { CompanyBrandKits } from "./CompanyBrandKits";

/**
 * The brand kit: the customer's own colours and logo, one click away in every design, beside the
 * colours the catalogue offers. Kept in this browser (no account endpoint for it yet — a business
 * account's shared brand assets are F3 3.7's). Applying a colour recolours the selection.
 */
export function BrandPanel() {
  const t = useTranslations("designer.brand");
  const { center, catalog } = useDesigner();
  const addElement = useEditor((s) => s.addElement);
  const selectedIds = useEditor((s) => s.selectedIds);
  const elements = useEditor((s) => s.content.elements);
  const updateElements = useEditor((s) => s.updateElements);
  const [kit, setKit] = useState<BrandKit>({ colours: [], logo: null });
  const [draft, setDraft] = useState("#0f5f58");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // A one-off read of browser storage on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKit(readBrandKit());
  }, []);

  const update = (next: BrandKit) => {
    setKit(next);
    saveBrandKit(next);
  };

  const recolour = (hex: string) => {
    const selected = elements.filter((e) => selectedIds.includes(e.id));
    if (!selected.length) {
      toast.info(t("selectFirst"));
      return;
    }
    updateElements(
      selected.flatMap((e): { id: string; patch: Partial<DesignElement> }[] =>
        e.type === "image"
          ? []
          : e.type === "code"
            ? [{ id: e.id, patch: { fill: hex } }]
            : [{ id: e.id, patch: { fill: hex } }],
      ),
    );
  };

  const swatch = (hex: string, label: string, removable = false) => (
    <li key={`${label}-${hex}`} className="relative">
      <button
        type="button"
        aria-label={t("apply", { colour: label })}
        onClick={() => recolour(hex)}
        className="border-border focus-visible:ring-focus-ring block h-9 w-9 rounded-full border outline-none focus-visible:ring-2"
        style={{ backgroundColor: hex }}
      />
      {removable ? (
        <IconButton
          name="close"
          size="sm"
          variant="ghost"
          label={t("remove", { colour: hex })}
          className="absolute -end-2 -top-2 h-5 w-5"
          onClick={() => update({ ...kit, colours: kit.colours.filter((c) => c !== hex) })}
        />
      ) : null}
    </li>
  );

  // "ใช้แบรนด์ของฉัน" for the browser's kit: its colours by role (primary, accent, ink, paper) and its logo.
  const applyLocal = () => {
    const editor = useEditor.getState();
    const roles = ["primary", "accent", "ink", "paper"] as const;
    editor.commit((content) =>
      applyBrand(content, {
        palette: Object.fromEntries(kit.colours.slice(0, 4).map((hex, i) => [roles[i], hex])),
        fonts: {},
        logo: kit.logo,
      }),
    );
    toast.success(t("appliedLocal"));
  };

  return (
    <div className="space-y-5">
      <CompanyBrandKits />
      <section>
        <h3 className="mb-2 text-sm font-semibold">{t("myColours")}</h3>
        <p className="text-muted mb-2 text-xs">{t("browserOnly")}</p>
        <ul className="flex flex-wrap gap-2">{kit.colours.map((hex) => swatch(hex, hex, true))}</ul>
        <Field label={t("addColour")} className="mt-3">
          <div className="flex items-end gap-2">
            <ColorField value={draft} onValueChange={setDraft} hexLabel={t("addColour")} />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => !kit.colours.includes(draft) && update({ ...kit, colours: [...kit.colours, draft] })}
            >
              {t("add")}
            </Button>
          </div>
        </Field>
      </section>

      {catalog?.colours.length ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold">{t("catalogColours")}</h3>
          <ul className="flex flex-wrap gap-2">{catalog.colours.map((c) => swatch(c.hex, c.name))}</ul>
        </section>
      ) : null}

      {kit.colours.length || kit.logo ? (
        <Button size="sm" onClick={applyLocal}>
          {t("applyMine")}
        </Button>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t("logo")}</h3>
        {kit.logo ? (
          <button
            type="button"
            aria-label={t("placeLogo")}
            onClick={() => {
              const c = center();
              addElement({
                ...kit.logo!,
                type: "image",
                x: c.x - kit.logo!.width / 2,
                y: c.y - kit.logo!.height / 2,
              } as Parameters<typeof addElement>[0]);
            }}
            className="border-border hover:bg-surface-subtle block h-24 w-full rounded-md border p-2"
          >
            {/* A data URL kept in the browser: next/image cannot optimise it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={kit.logo.src} alt="" className="h-full w-full object-contain" />
          </button>
        ) : null}
        <Button size="sm" variant="secondary" iconStart="upload" onClick={() => fileRef.current?.click()}>
          {kit.logo ? t("replaceLogo") : t("uploadLogo")}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/svg+xml,image/webp,image/jpeg"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            try {
              const image = (await newImage({ x: 0, y: 0 }, file)) as Omit<ImageElement, "id">;
              const { x: _x, y: _y, ...logo } = image;
              void _x;
              void _y;
              update({ ...kit, logo });
            } catch {
              toast.error(t("logoFailed"));
            }
          }}
        />
      </section>
    </div>
  );
}
