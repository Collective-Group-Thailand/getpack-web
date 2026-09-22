"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type Konva from "konva";
import { nanoid } from "nanoid";
import { useEditor, ZOOM_MAX, ZOOM_MIN } from "@/features/designer/store/editor";
import { buildDieline, PX_PER_MM } from "@packio/dieline";
import { getPaper, getStyle } from "@/features/designer/catalog";
import { designRepo } from "@/features/designer/storage";
import { exportDielineSvg, exportPdf, exportPng, makeThumbnail } from "@/features/designer/export";
import { BrandMark } from "@/ui/brand";
import { SetupModal } from "./SetupModal";
import { PrintRulesModal } from "./PrintRulesModal";
import { Toolbar } from "./Toolbar";
import { EmptyPanel, PatternPanel, PropertiesPanel } from "./SidePanel";
import { IClose, IDownload, IFit, ISave } from "./Icons";

const DesignCanvas = dynamic(() => import("./DesignCanvas"), { ssr: false });

function useSize<T extends HTMLElement>() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const roRef = useRef<ResizeObserver | null>(null);
  const ref = useCallback((node: T | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!node) return;
    const ro = new ResizeObserver(([e]) =>
      setSize({ width: Math.floor(e.contentRect.width), height: Math.floor(e.contentRect.height) }),
    );
    ro.observe(node);
    roRef.current = ro;
  }, []);
  return [ref, size] as const;
}

export default function Editor({ id }: { id: string }) {
  const router = useRouter();
  const st = useEditor();
  const { spec, content, selectedId, zoom, setZoom, name, dirty } = st;
  const stageRef = useRef<Konva.Stage | null>(null);
  const [wrapRef, size] = useSize<HTMLDivElement>();
  const [loaded, setLoaded] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [patternOpen, setPatternOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  // Load design
  useEffect(() => {
    const existing = id !== "new" ? designRepo.get(id) : undefined;
    if (existing) {
      useEditor
        .getState()
        .load({ id: existing.id, name: existing.name, spec: existing.spec, content: existing.content });
    } else {
      useEditor.getState().load({ id: id === "new" ? nanoid(10) : id, name: "แบบกล่องใหม่", spec: null });
      setSetupOpen(true);
    }
    setLoaded(true);
  }, [id]);

  const dieline = useMemo(() => (spec ? buildDieline(spec.style, spec.dims) : null), [spec]);
  const paper = spec ? getPaper(spec.paperId) : null;
  const selected = content.elements.find((e) => e.id === selectedId);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const save = useCallback(() => {
    const s = useEditor.getState();
    if (!s.spec || !dieline || !stageRef.current) return;
    const now = Date.now();
    const prev = designRepo.get(s.designId);
    const ok = designRepo.save({
      id: s.designId,
      name: s.name.trim() || "ไม่มีชื่อ",
      spec: s.spec,
      content: s.content,
      thumbnail: makeThumbnail(stageRef.current, dieline),
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    });
    if (!ok) return flash("บันทึกไม่สำเร็จ — พื้นที่จัดเก็บเต็ม (ลองลดขนาดรูปภาพ)");
    s.markSaved();
    if (id === "new") router.replace(`/design/${s.designId}`);
    flash("บันทึกแล้ว");
  }, [dieline, id, router]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      const s = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      } else if (mod && e.key.toLowerCase() === "d" && s.selectedId) {
        e.preventDefault();
        s.duplicateElement(s.selectedId);
      } else if ((e.key === "Delete" || e.key === "Backspace") && s.selectedId) {
        e.preventDefault();
        s.removeElement(s.selectedId);
      } else if (e.key === "Escape") {
        s.select(null);
      } else if (e.key.startsWith("Arrow") && s.selectedId) {
        e.preventDefault();
        const el = s.content.elements.find((x) => x.id === s.selectedId);
        if (!el) return;
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        s.updateElement(el.id, { x: el.x + dx, y: el.y + dy });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // Warn on unsaved changes
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (useEditor.getState().dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const viewCenter = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !dieline) return { x: 0, y: 0 };
    const s = stage.scaleX();
    return { x: (size.width / 2 - stage.x()) / s, y: (size.height / 2 - stage.y()) / s };
  }, [dieline, size]);

  const doExport = (kind: "png" | "png-guides" | "pdf" | "svg") => {
    setExportOpen(false);
    const stage = stageRef.current;
    if (!stage || !dieline) return;
    st.select(null);
    setTimeout(() => {
      if (kind === "svg") exportDielineSvg(dieline, name);
      else if (kind === "pdf") exportPdf(stage, dieline, name);
      else exportPng(stage, dieline, name, kind === "png-guides");
    }, 50);
  };

  const close = () => {
    if (dirty && !confirm("มีการแก้ไขที่ยังไม่บันทึก ต้องการออกหรือไม่?")) return;
    router.push("/my/designs");
  };

  if (!loaded) return null;

  return (
    <div className="flex h-dvh flex-col bg-slate-100 text-slate-900">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-3 bg-slate-900 px-3 text-white">
        <Link href="/" className="flex items-center gap-2" title="BoxStudio">
          <BrandMark size={30} />
        </Link>
        <input
          value={name}
          onChange={(e) => st.setName(e.target.value)}
          className="w-40 rounded-md bg-transparent px-2 py-1 text-sm font-medium outline-none hover:bg-white/10 focus:bg-white/10 sm:w-64"
          aria-label="ชื่อแบบ"
        />
        {dirty && <span className="hidden text-xs text-slate-400 sm:inline">ยังไม่บันทึก</span>}
        <div className="ml-auto hidden text-sm text-slate-300 md:block">
          {spec && dieline && (
            <>
              {getStyle(spec.style).name} · ภายใน {spec.dims.length}×{spec.dims.width}×{spec.dims.height} มม. · แผ่นคลี่{" "}
              <b className="text-white">
                {dieline.width.toFixed(0)} × {dieline.height.toFixed(0)} มม.
              </b>
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1 md:ml-4">
          <button
            onClick={save}
            disabled={!spec}
            className="flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-sm hover:bg-teal-500 disabled:opacity-50"
          >
            <ISave className="h-4 w-4" /> บันทึก
          </button>
          <div className="relative">
            <button
              onClick={() => setExportOpen((v) => !v)}
              disabled={!spec}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-50"
            >
              <IDownload className="h-4 w-4" /> ส่งออก
            </button>
            {exportOpen && (
              <div className="absolute top-full right-0 z-40 mt-1 w-64 overflow-hidden rounded-lg bg-white py-1 text-sm text-slate-800 shadow-xl">
                {(
                  [
                    ["pdf", "PDF สำหรับโรงพิมพ์", "ขนาดจริง + bleed 3 มม."],
                    ["png", "PNG งานพิมพ์ (300 dpi)", "ไม่มีเส้นไกด์"],
                    ["png-guides", "PNG พรีวิว", "พร้อมเส้นตัด/พับ"],
                    ["svg", "SVG ไดคัท", "เส้นตัด/พับ แยกเลเยอร์"],
                  ] as const
                ).map(([k, t, d]) => (
                  <button
                    key={k}
                    onClick={() => doExport(k)}
                    className="block w-full px-4 py-2 text-left hover:bg-slate-50"
                  >
                    <div>{t}</div>
                    <div className="text-xs text-slate-500">{d}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={close} className="rounded-md p-2 hover:bg-white/10" title="ปิด">
            <IClose />
          </button>
        </div>
      </header>

      <Toolbar
        center={viewCenter}
        onOpenSetup={() => setSetupOpen(true)}
        onOpenRules={() => setRulesOpen(true)}
        patternOpen={patternOpen}
        onTogglePattern={() => setPatternOpen((v) => !v)}
      />

      <div className="flex min-h-0 flex-1">
        <div
          ref={wrapRef}
          className="relative min-w-0 flex-1 overflow-hidden"
          style={{ backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: "18px 18px" }}
        >
          {dieline && paper && size.width > 0 && (
            <DesignCanvas
              dieline={dieline}
              paperColor={paper.color}
              stageRef={stageRef}
              width={size.width}
              height={size.height}
              fitSignal={fitSignal}
            />
          )}
          {!spec && !setupOpen && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button className="rounded-lg bg-teal-600 px-5 py-3 text-white" onClick={() => setSetupOpen(true)}>
                เลือกกล่องเพื่อเริ่มออกแบบ
              </button>
            </div>
          )}
          {toast && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
              {toast}
            </div>
          )}
        </div>

        {spec && (
          <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4 lg:block">
            {selected ? <PropertiesPanel el={selected} /> : patternOpen ? <PatternPanel /> : <EmptyPanel />}
            {selected && patternOpen && (
              <div className="mt-6 border-t border-slate-200 pt-4">
                <PatternPanel />
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Mobile bottom sheet for properties */}
      {spec && (selected || patternOpen) && (
        <div className="max-h-[40vh] overflow-y-auto border-t border-slate-200 bg-white p-4 lg:hidden">
          {selected ? <PropertiesPanel el={selected} /> : <PatternPanel />}
        </div>
      )}

      {/* Zoom bar */}
      <footer className="flex h-11 shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-white px-3 text-sm">
        <div className="mr-auto hidden items-center gap-3 text-xs text-slate-500 sm:flex">
          {paper && <span>วัสดุ: {paper.name}</span>}
          <span className="flex items-center gap-1">
            <i className="inline-block h-0.5 w-4 bg-rose-600" /> ตัด
          </span>
          <span className="flex items-center gap-1">
            <i className="inline-block w-4 border-t-2 border-dashed border-blue-600" /> พับ
          </span>
        </div>
        <button
          onClick={() => setFitSignal((n) => n + 1)}
          className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-slate-100"
          title="พอดีจอ"
        >
          <IFit className="h-4 w-4" /> พอดีจอ
        </button>
        <input
          type="range"
          aria-label="ซูม"
          min={ZOOM_MIN * 100}
          max={ZOOM_MAX * 100}
          value={Math.round(zoom * 100)}
          onChange={(e) => setZoom(Number(e.target.value) / 100)}
          className="w-32 accent-teal-600 sm:w-48"
        />
        <label className="flex items-center gap-1">
          <input
            type="number"
            min={ZOOM_MIN * 100}
            max={ZOOM_MAX * 100}
            value={Math.round(zoom * 100)}
            onChange={(e) => setZoom(Number(e.target.value) / 100)}
            className="w-16 rounded border border-slate-300 px-2 py-0.5 text-right"
          />
          %
        </label>
      </footer>

      <SetupModal
        key={setupOpen ? "open" : "closed"}
        open={setupOpen}
        initial={spec}
        hasContent={content.elements.length > 0}
        onClose={spec ? () => setSetupOpen(false) : () => router.push("/my/designs")}
        onConfirm={(s) => {
          st.setSpec(s);
          setSetupOpen(false);
          setFitSignal((n) => n + 1);
        }}
      />
      <PrintRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}

export { PX_PER_MM };
