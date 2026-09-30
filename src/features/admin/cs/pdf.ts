"use client";

import { useMutation } from "@tanstack/react-query";

import { adminBrowserApis } from "../console/api";
import { download } from "../console/download";

const TRIES = 10;
const PAUSE_MS = 800;

/**
 * A quotation's PDF (`admin.quotes.requestPdf` → `admin.quotes.getPdf`): the API renders it
 * asynchronously, so it is requested, then read until it is ready, then downloaded.
 */
export function useQuotePdf(quoteId: string | undefined, onError: (error: unknown) => void) {
  return useMutation({
    mutationFn: async () => {
      const { contract } = adminBrowserApis();
      const path = { quoteId: quoteId! };
      await contract.POST("/v1/admin/quotes/{quoteId}/actions/request-pdf", { params: { path } });
      for (let attempt = 0; attempt < TRIES; attempt += 1) {
        const pdf = (await contract.GET("/v1/admin/quotes/{quoteId}/pdf", { params: { path } })).data!;
        if (pdf.status === "ready" && pdf.url) return pdf.url;
        await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
      }
      throw new Error("pdf.not_ready");
    },
    onSuccess: (url) => download(url),
    onError,
  });
}
