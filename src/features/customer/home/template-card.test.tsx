import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import type { StyleCard } from "@/features/customer/catalog/api.server";

import { TemplateCard } from "./parts";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const style = {
  code: "PK-TE-01",
  nameTh: "กล่องฝาเสียบ",
  nameEn: "Tuck-end carton",
  family: "tuck_end",
  category: "folding_carton",
  materialClass: "paperboard",
} as StyleCard;
const drawing = (name: string) => ({ src: `data:image/svg+xml;charset=utf-8,${name}`, aspect: 1 });
const dieline = { card: drawing("card"), thumb: drawing("thumb") };

function card(props: Partial<Parameters<typeof TemplateCard>[0]> = {}) {
  const { container } = render(
    <NextIntlClientProvider locale="th" messages={{}}>
      <ul>
        <TemplateCard style={style} locale="th" photo={null} dieline={dieline} meta="" {...props} />
      </ul>
    </NextIntlClientProvider>,
  );
  return [...container.querySelectorAll("figure img")].map((img) => img.getAttribute("src"));
}

describe("a template card (visual review)", () => {
  it("shows its dieline alone when it has no photo — no corner thumbnail repeating it", () => {
    expect(card()).toEqual([dieline.card.src]);
  });

  it("puts the dieline thumbnail in the corner over a photo", () => {
    const images = card({ photo: { src: "/bff/v1/store/catalog/images/p", alt: "", caption: null } });
    expect(images).toHaveLength(2);
    expect(images).toContain(dieline.thumb.src);
    expect(images).not.toContain(dieline.card.src);
  });
});
