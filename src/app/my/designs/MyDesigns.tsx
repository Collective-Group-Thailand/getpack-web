"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { nanoid } from "nanoid";
import { designRepo } from "@/lib/storage";
import { getPaper, getStyle } from "@/lib/catalog";
import type { SavedDesign } from "@/lib/types";

const fmt = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });

export default function MyDesigns() {
  const [items, setItems] = useState<SavedDesign[] | null>(null);
  const [q, setQ] = useState("");
  const refresh = () => setItems(designRepo.list());
  useEffect(refresh, []);

  const filtered = (items ?? []).filter((d) => d.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">แบบของฉัน</h1>
          <p className="text-sm text-slate-500">งานออกแบบที่บันทึกไว้ในเบราว์เซอร์นี้</p>
        </div>
        <div className="flex gap-2">
          <input
            placeholder="ค้นหาชื่อแบบ"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
          <Link href="/design/new" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
            + ออกแบบใหม่
          </Link>
        </div>
      </div>

      {items === null ? null : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <p className="text-slate-600">{items.length ? "ไม่พบแบบที่ค้นหา" : "ยังไม่มีงานออกแบบ"}</p>
          {!items.length && (
            <Link href="/design/new" className="mt-4 inline-block rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white">
              เริ่มออกแบบกล่องแรก
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <li key={d.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:shadow-lg">
              <Link href={`/design/${d.id}`} className="block aspect-[4/3] bg-slate-50 p-4">
                {d.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.thumbnail} alt={d.name} className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">ไม่มีภาพตัวอย่าง</div>
                )}
              </Link>
              <div className="p-4">
                <Link href={`/design/${d.id}`} className="font-medium hover:text-teal-700">
                  {d.name}
                </Link>
                <p className="mt-1 text-xs text-slate-500">
                  {getStyle(d.spec.style).name} · {d.spec.dims.length}×{d.spec.dims.width}×{d.spec.dims.height} มม. · {getPaper(d.spec.paperId).name}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-400">แก้ไข {fmt.format(d.updatedAt)}</span>
                  <div className="flex gap-1 text-xs">
                    <button
                      className="rounded px-2 py-1 hover:bg-slate-100"
                      onClick={() => {
                        if (!designRepo.duplicate(d.id, nanoid(10))) alert("ทำสำเนาไม่สำเร็จ — พื้นที่จัดเก็บเต็ม");
                        refresh();
                      }}
                    >
                      ทำสำเนา
                    </button>
                    <button
                      className="rounded px-2 py-1 text-rose-600 hover:bg-rose-50"
                      onClick={() => {
                        if (confirm(`ลบ “${d.name}”? ไม่สามารถกู้คืนได้`)) {
                          designRepo.remove(d.id);
                          refresh();
                        }
                      }}
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
