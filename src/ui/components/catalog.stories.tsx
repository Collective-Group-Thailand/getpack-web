import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge } from "./Badge";
import { ImageGallery } from "./ImageGallery";
import { LinkPagination } from "./LinkPagination";
import { ProductCard } from "./ProductCard";
import { RichTextView } from "./RichTextView";

const meta = {
  title: "Commerce/Catalogue",
  parameters: {
    docs: {
      description: {
        component:
          "The storefront's catalogue pieces (F3 3.1): a product card whose name is its one link, a " +
          "gallery with keyboard-reachable thumbnails, link pagination a crawler can walk, and a " +
          "renderer for stored rich text that needs no editor. Every piece of copy is a prop — the " +
          "data here is obviously fake.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const picture = (hue: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="hsl(${hue} 35% 90%)"/><path d="M280 230l120-60 120 60v150l-120 60-120-60z" fill="none" stroke="hsl(${hue} 30% 40%)" stroke-width="10"/></svg>`,
  )}`;

export const ProductGrid: Story = {
  render: () => (
    <ul className="grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-3">
      <ProductCard
        as="li"
        title={<a href="#mailer">กล่องไปรษณีย์ (ตัวอย่าง)</a>}
        eyebrow="กล่องกระดาษลูกฟูก"
        image={{ src: picture(30), alt: "กล่องไปรษณีย์" }}
        price="เริ่มต้น ฿4.20 / ชิ้น"
        meta="ผลิต 7–10 วันทำการ"
        badges={<Badge tone="success">ราคาทันที</Badge>}
        priority
      />
      <ProductCard
        as="li"
        title={<a href="#tag">ป้ายแท็กห้อยสินค้า (ตัวอย่าง)</a>}
        eyebrow="ป้ายแท็กและปลอก"
        image={null}
        price="เริ่มต้น ฿1.80 / ชิ้น"
      />
      <ProductCard
        as="li"
        title={<a href="#gift">กล่องแข็งฝาแม่เหล็ก (ตัวอย่าง)</a>}
        eyebrow="กล่องแข็งและกล่องของขวัญ"
        image={{ src: picture(280), alt: "กล่องแข็ง" }}
        price="ขอใบเสนอราคา"
        badges={<Badge tone="info">ขอใบเสนอราคา</Badge>}
      />
    </ul>
  ),
};

export const Gallery: Story = {
  render: () => (
    <ImageGallery
      className="max-w-md"
      images={[
        { src: picture(30), alt: "ด้านหน้า", thumbnailLabel: "รูปที่ 1 จาก 3" },
        { src: picture(120), alt: "ด้านข้าง", thumbnailLabel: "รูปที่ 2 จาก 3" },
        { src: picture(210), alt: "แผ่นคลี่", thumbnailLabel: "รูปที่ 3 จาก 3" },
      ]}
      labels={{ thumbnails: "รูปสินค้า", empty: "ยังไม่มีรูปสินค้า" }}
    />
  ),
};

export const Pages: Story = {
  render: () => (
    <LinkPagination
      page={5}
      pages={12}
      hrefFor={(page) => `#page-${page}`}
      labels={{ nav: "เลื่อนหน้า", previous: "ก่อนหน้า", next: "ถัดไป", page: (n) => `หน้า ${n}` }}
    />
  ),
};

export const ArticleBody: Story = {
  render: () => (
    <RichTextView
      doc={{
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "บทความตัวอย่าง (ข้อมูลจำลอง)" }] },
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "อาร์ตการ์ด" }] },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "ผิวเรียบ พิมพ์สีสด " },
              { type: "text", marks: [{ type: "bold" }], text: "เหมาะกับกล่องเครื่องสำอาง" },
            ],
          },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [{ type: "paragraph", content: [{ type: "text", text: "น้ำหนักสินค้า" }] }],
              },
              { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "การขนส่ง" }] }] },
            ],
          },
        ],
      }}
    />
  ),
};
