"use client";

import type { ResponseOf } from "@/lib/api/requests/client";
import { browserRequests } from "@/lib/api/requests/browser";
import type { Requests } from "@/lib/api/requests/registry";
import { uploadFile } from "@/features/shared/files/upload";

import type { DesignContent, DesignSpec } from "../types";
import { DOCUMENT_SCHEMA_VERSION } from "../document";

/*
 * The designer's calls to the API, one place per surface: the customer's own designs
 * (`/v1/store/designs`, `store.designs`) and prepress's view of a document
 * (`/v1/admin/design-documents`, `admin.design-documents`). Each zone's BFF only forwards its own
 * surface, so the designer never picks the path from a URL — the session says which it is.
 */

export type StoreDesign = ResponseOf<Requests, "GET /v1/store/designs/{designId}">;
export type StoreDesignSummary = ResponseOf<Requests, "GET /v1/store/designs">["data"][number];
export type DesignVersion = ResponseOf<Requests, "GET /v1/store/designs/{designId}/versions">["data"][number];
export type DesignerCatalog = ResponseOf<Requests, "GET /v1/store/designer/catalog">;
export type DesignerMaterial = DesignerCatalog["materials"][number];
export type DesignerTemplate = DesignerCatalog["templates"][number];
export type DesignerPattern = DesignerCatalog["patterns"][number];
export type AdminDesignDocument = ResponseOf<Requests, "GET /v1/admin/design-documents/{documentId}">;

export interface Saved<T> {
  data: T;
  etag: string | null;
}

export const toDocument = (spec: DesignSpec, content: DesignContent) => ({
  schemaVersion: DOCUMENT_SCHEMA_VERSION,
  spec: spec as unknown as Record<string, unknown>,
  content: content as unknown as Record<string, unknown>,
});

export interface CreateInput {
  name: string;
  spec: DesignSpec;
  content: DesignContent;
  source: StoreDesign["source"];
  catalogProductSlug?: string;
  patternId?: string;
  materialId?: string;
  link?: { orderId: string; itemId: string };
  templateId?: string;
}

export const storeDesigns = {
  async get(designId: string): Promise<Saved<StoreDesign>> {
    return browserRequests().read("GET /v1/store/designs/{designId}", { path: { designId } });
  },
  async create(input: CreateInput, idempotencyKey: string): Promise<Saved<StoreDesign>> {
    return browserRequests().read("POST /v1/store/designs", {
      body: {
        name: input.name,
        document: toDocument(input.spec, input.content),
        source: input.source,
        ...(input.catalogProductSlug ? { catalogProductSlug: input.catalogProductSlug } : {}),
        ...(input.patternId ? { patternId: input.patternId } : {}),
        ...(input.materialId ? { materialId: input.materialId } : {}),
        ...(input.link ? { link: input.link } : {}),
        ...(input.templateId ? { templateId: input.templateId } : {}),
      },
      idempotencyKey,
    });
  },
  async save(
    designId: string,
    input: {
      name: string;
      spec: DesignSpec;
      content: DesignContent;
      kind: "autosave" | "manual";
      thumbnailFileId?: string;
      materialId?: string | null;
    },
    etag: string | null,
  ): Promise<Saved<StoreDesign>> {
    return browserRequests().read("PUT /v1/store/designs/{designId}", {
      path: { designId },
      body: {
        name: input.name,
        document: toDocument(input.spec, input.content),
        kind: input.kind,
        ...(input.thumbnailFileId ? { thumbnailFileId: input.thumbnailFileId } : {}),
        ...(input.materialId !== undefined ? { materialId: input.materialId } : {}),
      },
      etag: etag ?? undefined,
    });
  },
  async remove(designId: string) {
    await browserRequests().call("DELETE /v1/store/designs/{designId}", { path: { designId } });
  },
  async duplicate(designId: string, name: string, idempotencyKey: string): Promise<Saved<StoreDesign>> {
    return browserRequests().read("POST /v1/store/designs/{designId}/actions/duplicate", {
      path: { designId },
      body: { name },
      idempotencyKey,
    });
  },
  async versions(designId: string) {
    return browserRequests().call("GET /v1/store/designs/{designId}/versions", {
      path: { designId },
      query: { limit: 50 },
    });
  },
  async version(designId: string, versionNo: number) {
    return browserRequests().call("GET /v1/store/designs/{designId}/versions/{versionNo}", {
      path: { designId, versionNo: String(versionNo) },
    });
  },
  async restore(designId: string, versionNo: number, etag: string | null): Promise<Saved<StoreDesign>> {
    return browserRequests().read("POST /v1/store/designs/{designId}/versions/{versionNo}/actions/restore", {
      path: { designId, versionNo: String(versionNo) },
      etag: etag ?? undefined,
    });
  },
  /** Uploads an image once and attaches it to the design; the document then refers to it by id. */
  async attachAsset(designId: string, file: File, size: { widthPx?: number; heightPx?: number }) {
    // `design_asset` is requested as a file purpose (store.design-assets); until then, artwork.
    const uploaded = await uploadFile("customer", file, "artwork");
    return browserRequests().call("POST /v1/store/designs/{designId}/assets", {
      path: { designId },
      body: { fileId: uploaded.id, ...size },
    });
  },
  /** A thumbnail PNG, uploaded as a file for the next save to reference. */
  async uploadThumbnail(dataUrl: string, name: string): Promise<string> {
    const blob = await (await fetch(dataUrl)).blob();
    const uploaded = await uploadFile("customer", new File([blob], `${name}.png`, { type: "image/png" }), "artwork");
    return uploaded.id;
  },
  async importLocal(
    designs: {
      localId: string;
      name: string;
      spec: DesignSpec;
      content: DesignContent;
      createdAt: number;
      updatedAt: number;
    }[],
    idempotencyKey: string,
  ) {
    return browserRequests().call("POST /v1/store/designs/actions/import", {
      body: {
        designs: designs.map((d) => ({
          localId: d.localId,
          name: d.name,
          document: toDocument(d.spec, d.content),
          createdAt: new Date(d.createdAt).toISOString(),
          updatedAt: new Date(d.updatedAt).toISOString(),
        })),
      },
      idempotencyKey,
    });
  },
};

export const adminDocuments = {
  async get(documentId: string): Promise<Saved<AdminDesignDocument>> {
    return browserRequests().read("GET /v1/admin/design-documents/{documentId}", { path: { documentId } });
  },
  async save(
    documentId: string,
    input: { title: string; spec: DesignSpec; content: DesignContent },
    etag: string | null,
  ): Promise<Saved<AdminDesignDocument>> {
    return browserRequests().read("PUT /v1/admin/design-documents/{documentId}", {
      path: { documentId },
      body: { title: input.title, document: toDocument(input.spec, input.content) },
      etag: etag ?? undefined,
    });
  },
  async copy(documentId: string, title: string) {
    return browserRequests().call("POST /v1/admin/design-documents/{documentId}/actions/copy", {
      path: { documentId },
      body: { title },
    });
  },
};
