"use client";

import { browserApi } from "@/lib/api/browser";
import type { ResponseOf } from "@/lib/api/requests/client";
import { browserRequests } from "@/lib/api/requests/browser";
import type { Requests } from "@/lib/api/requests/registry";
import type { Schemas } from "@/lib/api/types";
import { uploadFile } from "@/features/shared/files/upload";

import type { DesignContent, DesignSpec } from "../types";
import { DOCUMENT_SCHEMA_VERSION } from "../document";

/*
 * The designer's calls to the API, one place per surface: the customer's own designs
 * (`/v1/store/designs`, `store.designs`) and the back office's (`/v1/admin/designs`,
 * `admin.designs`). Each zone's BFF only forwards its own surface, so the designer never picks the
 * path from a URL — the session says which it is.
 *
 * The published design keeps the document opaque (`{ spec, content }`, with `schemaVersion` beside
 * it). Duplicate, restore and import are still requests (`store.designs`, packio-api U-B0.1), and
 * answer in the request's shape. A staff copy is `admin.designs.copy`.
 */

export type StoreDesign = Schemas["DesignDocumentDto"];
export type DesignVersion = Schemas["DesignVersionDto"];
export type DesignerCatalog = ResponseOf<Requests, "GET /v1/store/designer/catalog">;
export type DesignerMaterial = DesignerCatalog["materials"][number];
export type DesignerTemplate = DesignerCatalog["templates"][number];
export type DesignerPattern = DesignerCatalog["patterns"][number];
/** A design as the back office reads it: the document, its `owner` and whether the reader may edit it. */
export type AdminDesignDocument = Schemas["AdminDesignDocumentDto"];

export interface Saved<T> {
  data: T;
  etag: string | null;
}

/** The request-shaped document (`{ schemaVersion, spec, content }`) the remaining requests take. */
export const toDocument = (spec: DesignSpec, content: DesignContent) => ({
  schemaVersion: DOCUMENT_SCHEMA_VERSION,
  spec: spec as unknown as Record<string, unknown>,
  content: content as unknown as Record<string, unknown>,
});

/** The published body: the document opaque, its schema version beside it. */
const published = (spec: DesignSpec, content: DesignContent) => ({
  document: { spec, content } as unknown as Record<string, never>,
  schemaVersion: DOCUMENT_SCHEMA_VERSION,
});

export { documentOf } from "./published";

/**
 * How a new design is created. CONTRACT-GAP store.catalog-product-ref — the product is required
 * by id, and only the configurator (a request) names it; a design without one is not created.
 */
export interface CreateInput {
  name: string;
  spec: DesignSpec;
  content: DesignContent;
  catalogProductId: string;
  patternId?: string;
  materialId?: string;
  semiDesignTemplateId?: string;
}

const etagOf = (response: Response) => response.headers.get("etag");

export const storeDesigns = {
  async get(designId: string): Promise<Saved<StoreDesign>> {
    const { data, response } = await browserApi().GET("/v1/store/designs/{designId}", {
      params: { path: { designId } },
    });
    return { data: data!, etag: etagOf(response) };
  },
  async create(input: CreateInput): Promise<Saved<StoreDesign>> {
    const { data, response } = await browserApi().POST("/v1/store/designs", {
      body: {
        title: input.name,
        catalogProductId: input.catalogProductId,
        ...published(input.spec, input.content),
        ...(input.patternId ? { patternId: input.patternId } : {}),
        ...(input.materialId ? { materialId: input.materialId } : {}),
        ...(input.semiDesignTemplateId ? { semiDesignTemplateId: input.semiDesignTemplateId } : {}),
      },
    });
    return { data: data!, etag: etagOf(response) };
  },
  /**
   * Every save is a new version, an autosave told apart from a save the customer made (`kind`).
   * CONTRACT-GAP store.designs — the material lives in the document's spec only.
   */
  async save(
    designId: string,
    input: {
      name: string;
      kind: Schemas["DesignSaveKind"];
      spec: DesignSpec;
      content: DesignContent;
      thumbnailFileId?: string;
    },
    etag: string | null,
  ): Promise<Saved<StoreDesign>> {
    const { data, response } = await browserApi().PUT("/v1/store/designs/{designId}", {
      params: { path: { designId }, header: { "If-Match": etag ?? "" } },
      body: {
        title: input.name,
        kind: input.kind,
        ...published(input.spec, input.content),
        ...(input.thumbnailFileId ? { thumbnailFileId: input.thumbnailFileId } : {}),
      },
    });
    return { data: data!, etag: etagOf(response) };
  },
  async remove(designId: string) {
    await browserApi().DELETE("/v1/store/designs/{designId}", { params: { path: { designId } } });
  },
  async duplicate(designId: string, name: string, idempotencyKey: string) {
    return browserRequests().read("POST /v1/store/designs/{designId}/actions/duplicate", {
      path: { designId },
      body: { name },
      idempotencyKey,
    });
  },
  /** The design's versions, newest first. CONTRACT-GAP store.designs — no kind, label or paging. */
  async versions(designId: string): Promise<DesignVersion[]> {
    const { data } = await browserApi().GET("/v1/store/designs/{designId}/versions", {
      params: { path: { designId } },
    });
    return [...data!].sort((a, b) => b.versionNo - a.versionNo);
  },
  async version(designId: string, versionNo: number): Promise<DesignVersion> {
    const { data } = await browserApi().GET("/v1/store/designs/{designId}/versions/{versionNo}", {
      params: { path: { designId, versionNo } },
    });
    return data!;
  },
  async restore(designId: string, versionNo: number, etag: string | null) {
    return browserRequests().read("POST /v1/store/designs/{designId}/versions/{versionNo}/actions/restore", {
      path: { designId, versionNo: String(versionNo) },
      etag: etag ?? undefined,
    });
  },
  /**
   * Uploads an image once and attaches it to the design; the document then refers to it by id.
   * CONTRACT-GAP store.design-assets — the asset carries no URL, so it is signed for with the file.
   */
  async attachAsset(designId: string, file: File): Promise<{ id: string; url: string }> {
    // `design_asset` is requested as a file purpose (store.design-assets); until then, artwork.
    const uploaded = await uploadFile("customer", file, "artwork");
    const api = browserApi();
    const { data: design } = await api.POST("/v1/store/designs/{designId}/assets", {
      params: { path: { designId } },
      body: { fileId: uploaded.id, kind: "image" },
    });
    const asset = design!.assets.find((candidate) => candidate.fileId === uploaded.id)!;
    const { data: signed } = await api.GET("/v1/store/files/{fileId}/download", {
      params: { path: { fileId: uploaded.id } },
    });
    return { id: asset.id, url: signed!.url };
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
  async get(designId: string): Promise<Saved<AdminDesignDocument>> {
    const { data, response } = await browserApi().GET("/v1/admin/designs/{designId}", {
      params: { path: { designId } },
    });
    return { data: data!, etag: etagOf(response) };
  },
  /** Only the staff author's own designs save (`catalog.manage`); anyone else's is 409 `designs.read_only`. */
  async save(
    designId: string,
    input: { title: string; kind: Schemas["DesignSaveKind"]; spec: DesignSpec; content: DesignContent },
    etag: string | null,
  ): Promise<Saved<AdminDesignDocument>> {
    const { data, response } = await browserApi().PUT("/v1/admin/designs/{designId}", {
      params: { path: { designId }, header: { "If-Match": etag ?? "" } },
      body: { title: input.title, kind: input.kind, ...published(input.spec, input.content) },
    });
    return { data: data!, etag: etagOf(response) };
  },
  /** A staff-owned editable copy (`admin.designs.copy`); the customer's own document never changes. */
  async copy(designId: string, title: string, idempotencyKey: string): Promise<Saved<AdminDesignDocument>> {
    const { data, response } = await browserApi().POST("/v1/admin/designs/{designId}/actions/copy", {
      params: { path: { designId }, header: { "Idempotency-Key": idempotencyKey } },
      body: { title },
    });
    return { data: data!, etag: etagOf(response) };
  },
};
