"use client";
import { btnPrimary, Modal } from "./Modal";

const RULES: [string, string][] = [
  ["เขตปลอดภัย", "วางข้อความและโลโก้ห่างจากเส้นตัด/เส้นพับอย่างน้อย 3 มม. (เส้นประสีเขียว)"],
  ["ระยะตกขอบ (Bleed)", "พื้นหลังและลวดลายควรเลยเส้นตัดออกไป 3 มม. ระบบจะส่งออก PDF พร้อมระยะนี้ให้"],
  ["ความละเอียดภาพ", "รูปภาพควรมีความละเอียดอย่างน้อย 300 dpi ที่ขนาดจริง"],
  ["ขนาดตัวอักษร", "ไม่ควรเล็กกว่า 6pt (ประมาณ 2.1 มม.) และเส้นไม่บางกว่า 0.25pt"],
  ["สี", "สีบนจออาจต่างจากงานพิมพ์ (RGB → CMYK) โดยเฉพาะสีสดและสีนีออน"],
  ["วัสดุลูกฟูก", "ผิวกระดาษน้ำตาลจะทำให้สีเข้มขึ้น ควรเลือกสีเข้ม/คอนทราสต์สูง"],
];

export function PrintRulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ข้อกำหนดงานพิมพ์"
      footer={
        <button className={btnPrimary} onClick={onClose}>
          เข้าใจแล้ว
        </button>
      }
    >
      <dl className="space-y-3 text-sm">
        {RULES.map(([t, d]) => (
          <div key={t}>
            <dt className="font-medium">{t}</dt>
            <dd className="text-slate-600">{d}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
