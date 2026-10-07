import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge } from "./Badge";
import { Button } from "./Button";
import { Card } from "./Card";
import { Highlight, IconTile, KraftPanel } from "./Decor";
import { ProductCard } from "./ProductCard";
import { SectionDivider } from "./SectionDivider";
import { SectionHeading, sectionLinkClass } from "./SectionHeading";

const meta = {
  title: "Storefront/Art direction",
  parameters: {
    docs: {
      description: {
        component:
          "How the D-180 tokens compose on the storefront: the warm paper page, a pill primary CTA " +
          "(customer zone only — switch the Zone toolbar to Admin and it becomes 12 px), the one " +
          "allowed wave divider into a paper band, product cards with the D-181 facts instead of " +
          "retail framing, amber for a real campaign only, and kraft for illustration only. " +
          "Layout and copy are placeholders; U-F3 builds the real page patterns.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const picture = (hue: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="hsl(${hue} 30% 94%)"/><path d="M280 230l120-60 120 60v150l-120 60-120-60z" fill="none" stroke="hsl(${hue} 20% 30%)" stroke-width="10"/></svg>`,
  )}`;

/** A tuck-end box flattened: kraft fill, ink lines — the dieline illustration style (D-180). */
function DielineIllustration() {
  return (
    <svg aria-hidden="true" viewBox="0 0 240 160" className="h-40 w-auto">
      <path
        className="fill-kraft stroke-fg"
        strokeWidth="2"
        d="M20 50h50v60H20zM70 50h60v60H70zM130 50h50v60h-50zM180 50h40v60h-40z"
      />
      <path className="fill-kraft stroke-fg" strokeWidth="2" d="M70 50l6-30h48l6 30M70 110l6 30h48l6-30" />
      <path
        className="stroke-kraft-strong"
        strokeWidth="2"
        strokeDasharray="6 4"
        fill="none"
        d="M70 50v60M130 50v60M180 50v60"
      />
    </svg>
  );
}

export const Composition: Story = {
  render: () => (
    <div className="bg-bg -m-6">
      <section className="flex flex-col items-start gap-6 px-6 pt-10 pb-8 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h1 className="text-display leading-tight font-bold">กล่องที่ใช่ ผลิตได้จริง</h1>
          <p className="text-muted mt-3 text-lg">
            ตั้งค่าขนาด วัสดุ และจำนวน แล้วเห็นราคาและวันผลิตทันที (ข้อความตัวอย่าง)
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg">คำนวณราคาจริง</Button>
            <Button size="lg" variant="secondary">
              ออกแบบออนไลน์
            </Button>
          </div>
        </div>
        <DielineIllustration />
      </section>
      <SectionDivider />
      <section className="bg-bg-subtle px-6 py-8">
        <h2 className="text-2xl">สินค้าพร้อมผลิต</h2>
        <ul className="mt-4 grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-3">
          <ProductCard
            as="li"
            title={<a href="#mailer">กล่องไปรษณีย์ (ตัวอย่าง)</a>}
            topLine="กล่องกระดาษลูกฟูก"
            image={{ src: picture(35), alt: "กล่องไปรษณีย์" }}
            price="เริ่มต้น ฿4.20 / ชิ้น ที่ 1,000 ชิ้น"
            meta="ขั้นต่ำ 500 ชิ้น · ผลิต 7–10 วันทำการ"
            badges={<Badge tone="success">ราคาทันที</Badge>}
          />
          <ProductCard
            as="li"
            title={<a href="#sleeve">ปลอกสวมกล่อง (ตัวอย่าง)</a>}
            topLine="ป้ายแท็กและปลอก"
            image={{ src: picture(160), alt: "ปลอกสวมกล่อง" }}
            price="เริ่มต้น ฿2.10 / ชิ้น ที่ 2,000 ชิ้น"
            meta="ขั้นต่ำ 1,000 ชิ้น · ผลิต 5–7 วันทำการ"
            badges={
              <>
                <Badge tone="success">ราคาทันที</Badge>
                <Badge tone="accent" appearance="solid" icon="tag">
                  ราคาพิเศษ
                </Badge>
              </>
            }
          />
          <ProductCard
            as="li"
            title={<a href="#rigid">กล่องแข็งฝาแม่เหล็ก (ตัวอย่าง)</a>}
            topLine="กล่องแข็งและกล่องของขวัญ"
            image={{ src: picture(280), alt: "กล่องแข็ง" }}
            price="ขอใบเสนอราคา"
            meta="ตอบภายใน 1 วันทำการ"
            badges={<Badge tone="info">ขอใบเสนอราคา</Badge>}
          />
        </ul>
      </section>
      <SectionDivider direction="out-of" />
      <section className="px-6 pt-4 pb-10">
        <p className="text-muted text-sm">
          ลิงก์ใช้สีหลัก:{" "}
          <a href="#faq" className="text-primary hover:text-primary-hover underline">
            คำถามที่พบบ่อย
          </a>
        </p>
      </section>
    </div>
  ),
};

/**
 * The home page's section furniture (redesign, 2026-10-06): a title heading with its
 * "see all" link, cards that lift on hover with an icon tile, the kraft highlighter and the kraft
 * invitation band. Copy is placeholder.
 */
export const HomeSections: Story = {
  render: () => (
    <div className="bg-bg flex flex-col gap-12 p-8">
      <h1 className="font-display text-4xl font-bold">
        Packaging, <Highlight className="text-primary">in one place</Highlight>
      </h1>
      <section aria-labelledby="story-steps">
        <SectionHeading
          id="story-steps"
          title="Order in four steps"
          description="One line of context under the title."
          action={
            <a href="#steps" className={sectionLinkClass}>
              Learn step by step
            </a>
          }
        />
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {(["upload", "calculator", "file-check", "truck"] as const).map((icon, index) => (
            <Card as="li" key={icon} padding="lg" interactive>
              <IconTile name={icon} tone={index === 0 ? "solid" : "primary"} className="mb-4" />
              <h3 className="mb-1.5 text-lg font-bold">Step {index + 1}</h3>
              <p className="text-muted text-sm">A short line about this step.</p>
            </Card>
          ))}
        </ol>
      </section>
      <KraftPanel className="grid items-center gap-6 p-10 md:grid-cols-[1fr_auto]">
        <div className="relative">
          <h2 className="font-display text-3xl font-bold">Customer work is coming here</h2>
          <p className="text-fg/80 mt-2">Only real, permitted work and reviews.</p>
        </div>
        <Button className="relative rounded-xl">Browse box styles</Button>
      </KraftPanel>
    </div>
  ),
};
