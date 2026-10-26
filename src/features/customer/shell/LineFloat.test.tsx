import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import styles from "@/i18n/messages/th/customer/styles.json";

import { LineFloat, resolveLineOaId } from "./LineFloat";

const env = vi.hoisted(() => ({ NEXT_PUBLIC_LINE_OA_ID: undefined as string | undefined }));
vi.mock("@/lib/env", () => ({ clientEnv: env }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const show = (api?: string | null) =>
  render(
    <NextIntlClientProvider locale="th" messages={{ styles }}>
      <LineFloat apiLineOaId={api} />
    </NextIntlClientProvider>,
  );

beforeEach(() => {
  env.NEXT_PUBLIC_LINE_OA_ID = undefined;
});

describe("which LINE id", () => {
  it("prefers the build's env id, falls back to the API's, else none", () => {
    expect(resolveLineOaId("@env", "@api")).toBe("@env");
    expect(resolveLineOaId(undefined, "@api")).toBe("@api");
    expect(resolveLineOaId("  ", "@api")).toBe("@api");
    expect(resolveLineOaId(undefined, null)).toBeNull();
  });
});

describe("the LINE button", () => {
  it("is hidden when neither source has an id", () => {
    const { container } = show(null);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens a popover with the id, copy, add-friend and the call-back request", () => {
    env.NEXT_PUBLIC_LINE_OA_ID = "@getpack";
    show("@api");
    fireEvent.click(screen.getByRole("button", { name: "คุยทาง LINE" }));
    expect(screen.getByText("@getpack")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /คัดลอก/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เพิ่มเพื่อนใน LINE" })).toHaveAttribute(
      "href",
      "https://line.me/R/ti/p/%40getpack",
    );
    expect(screen.getByRole("link", { name: "ฝากเบอร์ให้โทรกลับ" })).toHaveAttribute("href", "/help/chat");
  });

  it("uses the API id when the env has none, and closes on Escape", () => {
    show("@api");
    const toggle = screen.getByRole("button", { name: "คุยทาง LINE" });
    fireEvent.click(toggle);
    expect(screen.getByText("@api")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("@api")).toBeNull();
    expect(toggle).toHaveFocus();
  });

  it("rides above the compare tray while it is docked and draws no logo image", () => {
    show("@api");
    const root = screen.getByRole("button", { name: "คุยทาง LINE" }).parentElement!;
    expect(root.className).toContain("[body:has([data-compare-tray])_&]:bottom-40");
    expect(root.querySelector("img")).toBeNull();
  });
});
