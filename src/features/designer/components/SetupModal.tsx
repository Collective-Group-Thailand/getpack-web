"use client";
import { useMemo, useState } from "react";
import { BOX_STYLES, dimsFromProduct, getPaper, getStyle, papersFor } from "@/features/designer/catalog";
import type { BoxDims, BoxStyleId, DesignSpec } from "@/features/designer/types";
import { BoxPreview } from "./BoxPreview";
import { btnGhost, btnPrimary, inputCls, Modal } from "./Modal";

const DIM_FIELDS: { key: keyof BoxDims; label: string }[] = [
  { key: "length", label: "ยาว (L)" },
  { key: "width", label: "กว้าง (W)" },
  { key: "height", label: "สูง (H)" },
];

export function SetupModal({
  open,
  initial,
  onConfirm,
  onClose,
  hasContent,
}: {
  open: boolean;
  initial: DesignSpec | null;
  onConfirm: (spec: DesignSpec) => void;
  onClose?: () => void;
  hasContent: boolean;
}) {
  const [style, setStyle] = useState<BoxStyleId>(initial?.style ?? "rsc");
  const [mode, setMode] = useState<"preset" | "custom">(
    initial?.productDims ? "custom" : initial ? "custom" : "preset",
  );
  const [presetIdx, setPresetIdx] = useState(0);
  const [product, setProduct] = useState<BoxDims>(
    initial?.productDims ?? initial?.dims ?? { length: 200, width: 150, height: 100 },
  );
  const [paperId, setPaperId] = useState(initial?.paperId ?? papersFor("rsc")[0].id);

  const styleDef = getStyle(style);
  const papers = papersFor(style);
  const paper = papers.find((p) => p.id === paperId) ?? papers[0];

  const dims: BoxDims = useMemo(
    () =>
      mode === "preset"
        ? (styleDef.presets[presetIdx]?.dims ?? styleDef.presets[0].dims)
        : dimsFromProduct(product, paper.thickness),
    [mode, styleDef, presetIdx, product, paper.thickness],
  );

  const errors = useMemo(() => {
    if (mode !== "custom") return [];
    const { min, max } = styleDef.limits;
    return DIM_FIELDS.filter(({ key }) => !(dims[key] >= min && dims[key] <= max)).map(
      ({ label }) => `${label} ต้องอยู่ระหว่าง ${min}–${max} มม. (รวมระยะเผื่อแล้ว)`,
    );
  }, [mode, dims, styleDef]);

  const changeStyle = (s: BoxStyleId) => {
    setStyle(s);
    setPresetIdx(0);
    const ps = papersFor(s);
    if (!ps.some((p) => p.id === paperId)) setPaperId(ps[0].id);
  };

  const submit = () => {
    if (errors.length) return;
    if (
      hasContent &&
      initial &&
      !confirm("การเปลี่ยนขนาด/รูปแบบกล่องอาจทำให้ตำแหน่งงานออกแบบเดิมคลาดเคลื่อน ต้องการดำเนินการต่อหรือไม่?")
    )
      return;
    onConfirm({ style, dims, paperId: paper.id, productDims: mode === "custom" ? product : undefined });
  };

  return (
    <Modal
      open={open}
      title="ตั้งค่ากล่อง"
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <>
          {onClose && (
            <button className={btnGhost} onClick={onClose}>
              ยกเลิก
            </button>
          )}
          <button className={btnPrimary} onClick={submit} disabled={!!errors.length}>
            {initial ? "อัปเดตกล่อง" : "เริ่มออกแบบ"}
          </button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[1fr_260px]">
        <div className="space-y-5">
          <section>
            <h3 className="mb-2 text-sm font-medium text-slate-700">1. รูปแบบกล่อง</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {BOX_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => changeStyle(s.id)}
                  className={`rounded-xl border p-3 text-left text-sm transition ${
                    s.id === style
                      ? "border-teal-600 bg-teal-50 ring-2 ring-teal-600/20"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="font-medium">{s.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{s.description}</div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium text-slate-700">2. ขนาด</h3>
            <div className="mb-3 flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={mode === "preset"}
                  onChange={() => setMode("preset")}
                  className="accent-teal-600"
                />
                ขนาดมาตรฐาน
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={mode === "custom"}
                  onChange={() => setMode("custom")}
                  className="accent-teal-600"
                />
                กำหนดเองจากขนาดสินค้า
              </label>
            </div>
            {mode === "preset" ? (
              <select className={inputCls} value={presetIdx} onChange={(e) => setPresetIdx(Number(e.target.value))}>
                {styleDef.presets.map((p, i) => (
                  <option key={p.label} value={i}>
                    {p.label} มม.
                  </option>
                ))}
              </select>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {DIM_FIELDS.map(({ key, label }) => (
                    <label key={key} className="text-xs text-slate-600">
                      {label} มม.
                      <input
                        type="number"
                        min={1}
                        step={0.5}
                        className={`${inputCls} mt-1`}
                        value={product[key]}
                        onChange={(e) => setProduct({ ...product, [key]: Number(e.target.value) })}
                      />
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  ระบบบวกระยะเผื่อด้านละ 1.5 มม. และความหนากระดาษให้อัตโนมัติ → ขนาดภายในกล่อง{" "}
                  <b>
                    {dims.length} × {dims.width} × {dims.height} มม.
                  </b>
                </p>
                {errors.map((e) => (
                  <p key={e} className="mt-1 text-xs text-rose-600">
                    {e}
                  </p>
                ))}
              </>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium text-slate-700">3. วัสดุ</h3>
            <select className={inputCls} value={paper.id} onChange={(e) => setPaperId(e.target.value)}>
              {papers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (หนา {p.thickness} มม.){p.printable ? "" : " — ไม่รองรับงานพิมพ์สี"}
                </option>
              ))}
            </select>
            {!getPaper(paper.id).printable && (
              <p className="mt-1 text-xs text-amber-600">วัสดุนี้เหมาะกับการพิมพ์โลโก้สีเดียว (flexo) เท่านั้น</p>
            )}
          </section>
        </div>

        <aside className="flex flex-col rounded-xl bg-slate-50 p-3">
          <div className="aspect-square w-full">
            <BoxPreview style={style} dims={dims} color={paper.color} />
          </div>
          <dl className="mt-3 space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <dt>ขนาดภายใน</dt>
              <dd>
                {dims.length} × {dims.width} × {dims.height}
              </dd>
            </div>
            <div className="flex gap-3 pt-2">
              <span className="flex items-center gap-1">
                <i className="inline-block h-0.5 w-4 bg-rose-600" /> เส้นตัด
              </span>
              <span className="flex items-center gap-1">
                <i className="inline-block h-0.5 w-4 border-t-2 border-dashed border-blue-600" /> เส้นพับ
              </span>
            </div>
          </dl>
        </aside>
      </div>
    </Modal>
  );
}
