import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "../test/axe";
import { ImageGallery } from "./ImageGallery";
import { LinkPagination, pageWindow } from "./LinkPagination";
import { ProductCard } from "./ProductCard";
import { RichTextView, safeHref } from "./RichTextView";

describe("ProductCard", () => {
  it("is one link named by the product, with the facts beside it", async () => {
    const { container } = render(
      <ProductCard
        title={<a href="#mailer-box">กล่องไปรษณีย์</a>}
        topLine="กล่องลูกฟูก"
        price="เริ่มต้น ฿3.50 / ชิ้น"
        meta="ผลิต 7–10 วันทำการ"
        image={{ src: "/img.svg", alt: "กล่องไปรษณีย์" }}
      />,
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "กล่องไปรษณีย์" })).toHaveAttribute("href", "#mailer-box");
    expect(screen.getByText("เริ่มต้น ฿3.50 / ชิ้น")).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("shows a neutral picture, hidden from screen readers, when there is no image", () => {
    const { container } = render(<ProductCard title={<a href="#p">ป้ายแท็ก</a>} image={null} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
  });

  it("never leaves an empty plate: a picture that fails to load gives way to the line drawing", () => {
    const { container } = render(
      <ProductCard title={<a href="#p">กล่องไปรษณีย์</a>} image={{ src: "/missing.jpg", alt: "กล่องไปรษณีย์" }} />,
    );
    fireEvent.error(screen.getByAltText("กล่องไปรษณีย์"));
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
    // The link still names the product.
    expect(screen.getByRole("link", { name: "กล่องไปรษณีย์" })).toBeInTheDocument();
  });

  it("loads an above-the-fold image eagerly and the rest lazily", () => {
    render(
      <>
        <ProductCard title={<a href="#a">A</a>} image={{ src: "/a.svg", alt: "A" }} priority />
        <ProductCard title={<a href="#b">B</a>} image={{ src: "/b.svg", alt: "B" }} />
      </>,
    );
    expect(screen.getByAltText("A")).toHaveAttribute("loading", "eager");
    expect(screen.getByAltText("B")).toHaveAttribute("loading", "lazy");
  });
});

describe("ImageGallery", () => {
  const labels = { thumbnails: "รูปสินค้า", empty: "ไม่มีรูป" };
  const images = [
    { src: "/1.svg", alt: "ด้านหน้า", thumbnailLabel: "รูปที่ 1 จาก 2" },
    { src: "/2.svg", alt: "ด้านข้าง", thumbnailLabel: "รูปที่ 2 จาก 2" },
  ];

  it("swaps the large image from a thumbnail, and says which one is shown", async () => {
    const { container } = render(<ImageGallery images={images} labels={labels} />);
    expect(screen.getByAltText("ด้านหน้า")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "รูปที่ 2 จาก 2" }));
    expect(screen.getByAltText("ด้านข้าง")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "รูปที่ 2 จาก 2" })).toHaveAttribute("aria-pressed", "true");
    await expectNoA11yViolations(container);
  });

  it("says so when there are no pictures", () => {
    render(<ImageGallery images={[]} labels={labels} />);
    expect(screen.getByText("ไม่มีรูป")).toBeInTheDocument();
  });
});

describe("LinkPagination", () => {
  const labels = { nav: "เลื่อนหน้า", previous: "ก่อนหน้า", next: "ถัดไป", page: (n: number) => `หน้า ${n}` };

  it("windows the pages: both ends, the current one and its neighbours", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(5, 12)).toEqual([1, "gap", 4, 5, 6, "gap", 12]);
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it("is real links, the current page marked, previous and next with rel", async () => {
    const { container } = render(
      <LinkPagination page={2} pages={3} hrefFor={(page) => `/products?page=${page}`} labels={labels} />,
    );
    const nav = screen.getByRole("navigation", { name: "เลื่อนหน้า" });
    expect(within(nav).getByRole("link", { name: "หน้า 2" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: /ก่อนหน้า/ })).toHaveAttribute("rel", "prev");
    expect(within(nav).getByRole("link", { name: /ถัดไป/ })).toHaveAttribute("href", "/products?page=3");
    await expectNoA11yViolations(container);
  });

  it("renders nothing for a single page", () => {
    const { container } = render(<LinkPagination page={1} pages={1} hrefFor={() => "/"} labels={labels} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("RichTextView", () => {
  const doc = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "หัวข้อ" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "ตัวหนา", marks: [{ type: "bold" }] },
          { type: "text", text: "ลิงก์", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
          { type: "text", text: "สินค้า", marks: [{ type: "link", attrs: { href: "/products" } }] },
        ],
      },
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "ข้อหนึ่ง" }] }] },
        ],
      },
      { type: "mystery", content: [{ type: "text", text: "ยังอ่านได้" }] },
    ],
  };

  it("renders the document as elements, the page's h1 left to the page", async () => {
    const { container } = render(<RichTextView doc={doc} />);
    expect(screen.getByRole("heading", { level: 2, name: "หัวข้อ" })).toBeInTheDocument();
    expect(screen.getByText("ตัวหนา").tagName).toBe("STRONG");
    expect(screen.getByRole("listitem")).toHaveTextContent("ข้อหนึ่ง");
    expect(screen.getByText("ยังอ่านได้")).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("never turns a javascript: URL into a link", () => {
    render(<RichTextView doc={doc} />);
    expect(screen.getByText("ลิงก์").closest("a")).toBeNull();
    expect(screen.getByRole("link", { name: "สินค้า" })).toHaveAttribute("href", "/products");
    expect(safeHref("//evil.example")).toBeNull();
    expect(safeHref("mailto:hello@getpack.invalid")).toBe("mailto:hello@getpack.invalid");
  });

  it("renders nothing for something that is not a document", () => {
    const { container } = render(<RichTextView doc={{ th: { type: "doc" } }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
