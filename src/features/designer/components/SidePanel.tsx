"use client";
import { useEditor } from "@/features/designer/store/editor";
import { FONT_FAMILIES } from "@/features/designer/catalog";
import { PATTERN_OPTIONS } from "@/features/designer/patterns";
import type { DesignElement } from "@/features/designer/types";
import { inputCls } from "./Modal";
import { ICopy, ITrash } from "./Icons";

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block text-xs text-slate-600">
    <span className="mb-1 block">{label}</span>
    {children}
  </label>
);

const Color = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <div className="flex items-center gap-2">
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-10 cursor-pointer rounded border border-slate-300"
    />
    <input className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

export function PatternPanel() {
  const { content, setPattern } = useEditor();
  const p = content.pattern;
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">ลวดลายพื้นหลัง</h3>
      <div className="grid grid-cols-3 gap-2">
        {PATTERN_OPTIONS.map((o) => (
          <button
            key={o.kind}
            onClick={() => setPattern({ kind: o.kind })}
            className={`rounded-lg border px-2 py-2 text-xs ${p.kind === o.kind ? "border-teal-600 bg-teal-50 text-teal-700" : "border-slate-200 hover:bg-slate-50"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {p.kind !== "none" && (
        <>
          <Row label="สีลาย">
            <Color value={p.color} onChange={(color) => setPattern({ color })} />
          </Row>
          {p.kind !== "solid" && (
            <>
              <Row label="สีพื้น">
                <Color value={p.background} onChange={(background) => setPattern({ background })} />
              </Row>
              <Row label={`ขนาดลาย ${p.size} มม.`}>
                <input
                  type="range"
                  min={4}
                  max={60}
                  value={p.size}
                  onChange={(e) => setPattern({ size: Number(e.target.value) })}
                  className="w-full accent-teal-600"
                />
              </Row>
            </>
          )}
        </>
      )}
    </div>
  );
}

export function PropertiesPanel({ el }: { el: DesignElement }) {
  const { updateElement, removeElement, duplicateElement, reorder } = useEditor();
  const set = (patch: Partial<DesignElement>) => updateElement(el.id, patch);
  const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const titles = { text: "ข้อความ", image: "รูปภาพ", rect: "สี่เหลี่ยม", circle: "วงกลม" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{titles[el.type]}</h3>
        <div className="flex gap-1">
          <button
            title="ทำสำเนา (Ctrl+D)"
            onClick={() => duplicateElement(el.id)}
            className="rounded p-1.5 hover:bg-slate-100"
          >
            <ICopy className="h-4 w-4" />
          </button>
          <button
            title="ลบ (Delete)"
            onClick={() => removeElement(el.id)}
            className="rounded p-1.5 text-rose-600 hover:bg-rose-50"
          >
            <ITrash className="h-4 w-4" />
          </button>
        </div>
      </div>

      {el.type === "text" && (
        <>
          <Row label="ข้อความ">
            <textarea className={inputCls} rows={3} value={el.text} onChange={(e) => set({ text: e.target.value })} />
          </Row>
          <Row label="ฟอนต์">
            <select className={inputCls} value={el.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })}>
              {FONT_FAMILIES.map((f) => (
                <option key={f} style={{ fontFamily: f }}>
                  {f}
                </option>
              ))}
            </select>
          </Row>
          <div className="grid grid-cols-2 gap-2">
            <Row label="ขนาด (มม.)">
              <input
                type="number"
                min={1}
                step={0.5}
                className={inputCls}
                value={el.fontSize}
                onChange={(e) => set({ fontSize: Math.max(1, num(e.target.value)) })}
              />
            </Row>
            <Row label="รูปแบบ">
              <select
                className={inputCls}
                value={el.fontStyle}
                onChange={(e) => set({ fontStyle: e.target.value as typeof el.fontStyle })}
              >
                <option value="normal">ปกติ</option>
                <option value="bold">หนา</option>
                <option value="italic">เอียง</option>
                <option value="italic bold">หนา+เอียง</option>
              </select>
            </Row>
          </div>
          {el.fontSize * el.scaleY < 2.1 && (
            <p className="text-xs text-amber-600">ตัวอักษรเล็กกว่า 6pt อาจพิมพ์ไม่ชัด</p>
          )}
          <Row label="จัดวาง">
            <div className="grid grid-cols-3 gap-1">
              {(["left", "center", "right"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => set({ align: a })}
                  className={`rounded border py-1 text-xs ${el.align === a ? "border-teal-600 bg-teal-50" : "border-slate-200"}`}
                >
                  {{ left: "ซ้าย", center: "กลาง", right: "ขวา" }[a]}
                </button>
              ))}
            </div>
          </Row>
          <Row label="สี">
            <Color value={el.fill} onChange={(fill) => set({ fill })} />
          </Row>
        </>
      )}

      {(el.type === "rect" || el.type === "circle") && (
        <>
          <Row label="สีพื้น">
            <Color value={el.fill} onChange={(fill) => set({ fill })} />
          </Row>
          <div className="grid grid-cols-2 gap-2">
            <Row label="เส้นขอบ (มม.)">
              <input
                type="number"
                min={0}
                step={0.25}
                className={inputCls}
                value={el.strokeWidth}
                onChange={(e) => set({ strokeWidth: Math.max(0, num(e.target.value)) })}
              />
            </Row>
            {el.type === "rect" && (
              <Row label="มุมโค้ง (มม.)">
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={el.cornerRadius}
                  onChange={(e) => set({ cornerRadius: Math.max(0, num(e.target.value)) })}
                />
              </Row>
            )}
          </div>
          {el.strokeWidth > 0 && (
            <Row label="สีเส้นขอบ">
              <Color value={el.stroke} onChange={(stroke) => set({ stroke })} />
            </Row>
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Row label="X (มม.)">
          <input
            type="number"
            className={inputCls}
            value={Math.round(el.x * 10) / 10}
            onChange={(e) => set({ x: num(e.target.value) })}
          />
        </Row>
        <Row label="Y (มม.)">
          <input
            type="number"
            className={inputCls}
            value={Math.round(el.y * 10) / 10}
            onChange={(e) => set({ y: num(e.target.value) })}
          />
        </Row>
        <Row label="หมุน (°)">
          <input
            type="number"
            className={inputCls}
            value={Math.round(el.rotation)}
            onChange={(e) => set({ rotation: num(e.target.value) })}
          />
        </Row>
        <Row label={`ความทึบ ${Math.round(el.opacity * 100)}%`}>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={el.opacity}
            onChange={(e) => set({ opacity: Number(e.target.value) })}
            className="mt-2 w-full accent-teal-600"
          />
        </Row>
      </div>

      <Row label="ลำดับชั้น">
        <div className="grid grid-cols-4 gap-1">
          {(
            [
              ["top", "บนสุด"],
              ["up", "ขึ้น"],
              ["down", "ลง"],
              ["bottom", "ล่างสุด"],
            ] as const
          ).map(([d, l]) => (
            <button
              key={d}
              onClick={() => reorder(el.id, d)}
              className="rounded border border-slate-200 py-1 text-xs hover:bg-slate-50"
            >
              {l}
            </button>
          ))}
        </div>
      </Row>
    </div>
  );
}

export function EmptyPanel() {
  const { showLabels, showSafeZone, toggle } = useEditor();
  return (
    <div className="space-y-4 text-sm">
      <h3 className="font-semibold">มุมมอง</h3>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={showLabels} onChange={() => toggle("showLabels")} className="accent-teal-600" />{" "}
        แสดงชื่อด้านกล่อง
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={showSafeZone}
          onChange={() => toggle("showSafeZone")}
          className="accent-teal-600"
        />{" "}
        แสดงเขตปลอดภัย (3 มม.)
      </label>
      <div className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
        <p className="mb-1 font-medium text-slate-700">ทางลัด</p>
        <p>ลากพื้นที่ว่างเพื่อเลื่อน · ล้อเมาส์เพื่อซูม</p>
        <p>Delete ลบ · Ctrl+Z / Ctrl+Shift+Z · Ctrl+D ทำสำเนา · ลูกศรขยับ 1 มม. (Shift = 10 มม.)</p>
      </div>
    </div>
  );
}
