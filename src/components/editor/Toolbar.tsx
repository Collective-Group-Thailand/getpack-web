"use client";
import { useRef } from "react";
import { useEditor } from "@/store/editor";
import { FONT_FAMILIES } from "@/lib/catalog";
import { IBox, ICircle, IImage, IInfo, IPattern, IRect, IRedo, IReset, IText, IUndo } from "./Icons";

function Tool({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: React.FC<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex min-w-16 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] transition disabled:opacity-35 ${
        active ? "bg-teal-50 text-teal-700" : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      <Icon />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

const Sep = () => <div className="mx-1 h-8 w-px bg-slate-200" />;

export function Toolbar({
  center,
  onOpenSetup,
  onOpenRules,
  patternOpen,
  onTogglePattern,
}: {
  center: () => { x: number; y: number };
  onOpenSetup: () => void;
  onOpenRules: () => void;
  patternOpen: boolean;
  onTogglePattern: () => void;
}) {
  const { past, future, undo, redo, resetAll, resetPattern, addElement, content } = useEditor();
  const fileRef = useRef<HTMLInputElement>(null);

  const base = { rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };

  const addText = () => {
    const c = center();
    addElement({
      ...base,
      type: "text",
      x: c.x - 30,
      y: c.y - 6,
      text: "ข้อความของคุณ",
      fontSize: 10,
      fontFamily: FONT_FAMILIES[0],
      fontStyle: "bold",
      fill: "#0f172a",
      align: "center",
    });
  };
  const addShape = (type: "rect" | "circle") => {
    const c = center();
    addElement({
      ...base,
      type,
      x: c.x - 25,
      y: c.y - 25,
      width: 50,
      height: 50,
      fill: "#14b8a6",
      stroke: "#0f172a",
      strokeWidth: 0,
      cornerRadius: 0,
    });
  };
  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return alert("ไฟล์ใหญ่เกิน 8 MB");
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        const c = center();
        const w = 80;
        const h = (img.height / img.width) * w;
        addElement({ ...base, type: "image", src, x: c.x - w / 2, y: c.y - h / 2, width: w, height: h });
      };
      img.src = src;
    };
    reader.readAsDataURL(f);
  };

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-b border-slate-200 bg-white px-2 py-1">
      <Tool icon={IUndo} label="ย้อนกลับ" onClick={undo} disabled={!past.length} />
      <Tool icon={IRedo} label="ทำซ้ำ" onClick={redo} disabled={!future.length} />
      <Tool
        icon={IReset}
        label="ล้างทั้งหมด"
        onClick={() => confirm("ล้างงานออกแบบทั้งหมด? (ย้อนกลับได้)") && resetAll()}
        disabled={!content.elements.length && content.pattern.kind === "none"}
      />
      <Tool icon={IReset} label="ล้างลวดลาย" onClick={resetPattern} disabled={content.pattern.kind === "none"} />
      <Sep />
      <Tool icon={IText} label="ข้อความ" onClick={addText} />
      <Tool icon={IImage} label="รูปภาพ" onClick={() => fileRef.current?.click()} />
      <Tool icon={IRect} label="สี่เหลี่ยม" onClick={() => addShape("rect")} />
      <Tool icon={ICircle} label="วงกลม" onClick={() => addShape("circle")} />
      <Tool icon={IPattern} label="ลวดลาย" onClick={onTogglePattern} active={patternOpen} />
      <Sep />
      <Tool icon={IBox} label="ตั้งค่ากล่อง" onClick={onOpenSetup} />
      <Tool icon={IInfo} label="ข้อกำหนดงานพิมพ์" onClick={onOpenRules} />
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        hidden
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
