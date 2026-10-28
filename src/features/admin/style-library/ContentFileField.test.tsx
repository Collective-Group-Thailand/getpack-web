import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import common from "@/i18n/messages/th/common/common.json";
import styleLibrary from "@/i18n/messages/th/admin/style-library.json";

import { ContentDocumentField, ContentImageField } from "./ContentFileField";

const uploadFile = vi.fn();
vi.mock("@/features/shared/files/upload", () => ({ uploadFile: (...args: unknown[]) => uploadFile(...args) }));
vi.mock("../console", () => ({
  adminBrowserApis: () => ({
    contract: { GET: () => Promise.resolve({ data: { url: "https://files.example.invalid/x" } }) },
  }),
  problemMessage: (_e: unknown, fallback: string) => fallback,
}));

const ID = "0192f3a0-7c1e-7d2a-9b1f-00000000d001";
const files = styleLibrary.content.files;

function Harness({ kind, initial }: { kind: "image" | "document"; initial: string | null }) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <>
      {kind === "image" ? (
        <ContentImageField label="รูป" alt="งานพิมพ์" value={value ?? ""} onChange={setValue} />
      ) : (
        <ContentDocumentField label="เอกสาร" value={value} onChange={setValue} />
      )}
      <output data-testid="value">{value ?? "(none)"}</output>
    </>
  );
}

const renderField = (kind: "image" | "document", initial: string | null) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="th" messages={{ styleLibrary, common } as never}>
        <Harness kind={kind} initial={initial} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

describe("trust-section files (C1e, DECISIONS-STAGE-A §13.3)", () => {
  beforeEach(() => uploadFile.mockReset());

  it("uploads a picture as purpose image and stores its public path", async () => {
    uploadFile.mockResolvedValue({ id: ID });
    const { container } = renderField("image", "");
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "photo.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByTestId("value").textContent).toBe(`/v1/store/catalog/images/${ID}`));
    expect(uploadFile).toHaveBeenCalledWith("admin", expect.any(File), "image");
    expect(screen.getByText("photo.png")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: files.removeImage }));
    expect(screen.getByTestId("value").textContent).toBe("");
  });

  it("flags a picture link typed before C1e so staff replace it with an upload", () => {
    renderField("image", "https://example.invalid/old.png");
    expect(screen.getByText(files.legacyLink.replace("{url}", "https://example.invalid/old.png"))).toBeInTheDocument();
  });

  it("uploads a PDF document as purpose document, or takes an external https link", async () => {
    uploadFile.mockResolvedValue({ id: ID });
    const { container } = renderField("document", null);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["%PDF"], "cert.pdf", { type: "application/pdf" })] } });
    await waitFor(() =>
      expect(screen.getByTestId("value").textContent).toBe(`/v1/store/style-library/documents/${ID}`),
    );
    expect(uploadFile).toHaveBeenCalledWith("admin", expect.any(File), "document");
    fireEvent.click(screen.getByRole("radio", { name: files.sourceLink }));
    expect(screen.getByTestId("value").textContent).toBe("(none)");
    fireEvent.change(screen.getByRole("textbox", { name: files.linkLabel }), {
      target: { value: "https://issuer.example/c.pdf" },
    });
    expect(screen.getByTestId("value").textContent).toBe("https://issuer.example/c.pdf");
  });
});
