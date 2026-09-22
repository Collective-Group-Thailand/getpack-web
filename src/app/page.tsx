import Link from "next/link";
import { SiteHeader } from "@/components/Brand";
import { BoxPreview } from "@/components/editor/BoxPreview";
import { BOX_STYLES } from "@/lib/catalog";

const STEPS = [
  ["เลือกรูปแบบและขนาด", "เลือกจากขนาดมาตรฐานหรือกรอกขนาดสินค้า ระบบคำนวณแผ่นคลี่ให้อัตโนมัติ"],
  ["ออกแบบบนแผ่นคลี่", "เพิ่มข้อความ โลโก้ รูปทรง และลวดลาย พร้อมเส้นตัด เส้นพับ และเขตปลอดภัย"],
  ["ส่งออกไฟล์", "ได้ PDF ขนาดจริงพร้อม bleed และไฟล์ SVG ไดคัทสำหรับโรงพิมพ์"],
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="bg-gradient-to-b from-teal-50 to-white">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
            <div>
              <h1 className="text-4xl font-bold leading-tight md:text-5xl">
                ออกแบบกล่องของคุณ
                <br />
                <span className="text-teal-600">ในขนาดจริง</span>
              </h1>
              <p className="mt-4 max-w-md text-lg text-slate-600">เครื่องมือออกแบบบรรจุภัณฑ์บนเว็บ ใช้งานฟรี ไม่ต้องติดตั้งโปรแกรม</p>
              <div className="mt-8 flex gap-3">
                <Link href="/design/new" className="rounded-xl bg-teal-600 px-6 py-3 font-medium text-white hover:bg-teal-700">
                  เริ่มออกแบบ
                </Link>
                <Link href="/my/designs" className="rounded-xl border border-slate-300 px-6 py-3 font-medium hover:bg-slate-50">
                  แบบของฉัน
                </Link>
              </div>
            </div>
            <div className="aspect-[4/3] rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
              <BoxPreview style="tuck-end" dims={{ length: 70, width: 40, height: 110 }} color="#f1f5f9" />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="mb-8 text-2xl font-semibold">รูปแบบกล่องที่รองรับ</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {BOX_STYLES.map((s) => (
              <div key={s.id} className="rounded-2xl border border-slate-200 p-5">
                <div className="aspect-[4/3] rounded-xl bg-slate-50 p-4">
                  <BoxPreview style={s.id} dims={s.presets[0].dims} color="#e7d6c1" />
                </div>
                <h3 className="mt-4 font-medium">{s.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{s.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-50">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 md:grid-cols-3">
            {STEPS.map(([t, d], i) => (
              <div key={t}>
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 font-semibold text-white">{i + 1}</div>
                <h3 className="font-medium">{t}</h3>
                <p className="mt-1 text-sm text-slate-600">{d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">© {new Date().getFullYear()} BoxStudio</footer>
    </>
  );
}
