"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";

import { isValidEan13, qrMatrix } from "../../lib/codes";
import { newCode, newShape } from "../../lib/create";
import { SHAPES } from "../../lib/shapes";
import { useEditor } from "../../store/editor";
import { useDesigner } from "../DesignerContext";

/** Shapes (Packio's own library) and codes — QR and EAN-13, generated here with their quiet zones. */
export function ElementsPanel() {
  const t = useTranslations("designer.elements");
  const addElement = useEditor((s) => s.addElement);
  const { center } = useDesigner();
  const [kind, setKind] = useState<"qr" | "ean13">("qr");
  const [value, setValue] = useState("");

  const valid =
    kind === "qr" ? value.length > 0 && qrMatrix(value) !== null : /^\d{12}$/.test(value) || isValidEan13(value);

  return (
    <div className="space-y-5">
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

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t("codes")}</h3>
        <SegmentedControl
          label={t("codeKind")}
          size="sm"
          value={kind}
          onValueChange={(next) => {
            setKind(next as "qr" | "ean13");
            setValue("");
          }}
          options={[
            { value: "qr", label: t("qr") },
            { value: "ean13", label: t("ean13") },
          ]}
        />
        <Field
          label={kind === "qr" ? t("qrValue") : t("eanValue")}
          hint={kind === "qr" ? t("qrHint") : t("eanHint")}
          error={value && !valid ? t("invalid") : undefined}
        >
          <Input
            inputSize="sm"
            value={value}
            inputMode={kind === "ean13" ? "numeric" : undefined}
            onChange={(event) => setValue(event.target.value.trim())}
          />
        </Field>
        <Button size="sm" disabled={!valid} onClick={() => addElement(newCode(center(), kind, value))}>
          {t("addCode")}
        </Button>
      </section>
    </div>
  );
}
