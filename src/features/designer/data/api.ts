"use client";

import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { uploadFile } from "@/features/shared/files/upload";

import type { DesignContent, DesignSpec } from "../types";
import { DOCUMENT_SCHEMA_VERSION } from "../document";
import type { PatchOperation } from "../lib/json-patch";
import type { BoxFields } from "./published";

/*
 * The designer's calls to the API, one place per surface: the customer's own designs
 * (`/v1/store/designs`, `store.designs`) and the back office's (`/v1/admin/designs`,
 * `admin.designs`). Each zone's BFF only forwards its own surface, so the designer never picks the
 * path from a URL — the session says which it is.
 *
 * The published design keeps the document opaque (`{ spec, content }`, with `schemaVersion` beside
 * it); duplicate, restore and import are published too (U-B0.1), and so is a staff copy
 * (`admin.designs.copy`, U-B0.2).
 */

export type StoreDesign = Schemas["DesignDocumentDto"];
export type DesignVersion = Schemas["DesignVersionDto"];
export type { DesignerCatalog, DesignerMaterial, DesignerPattern, DesignerTemplate } from "./catalog-view";
/** A design as the back office reads it: the document, its `owner` and whether the reader may edit it. */
export type AdminDesignDocument = Schemas["AdminDesignDocumentDto"];

export { boxFieldsOf, type BoxFields } from "./published";

export interface Saved<T> {
  data: T;
  etag: string | null;
}

/** A catalogue id (a placeholder board from the BoxStudio era is not one). */
const isUuid = (value: string | null | undefined): value is string =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** The published body: the document opaque, its schema version beside it. */
const published = (spec: DesignSpec, content: DesignContent) => ({
  document: { spec, content } as unknown as Record<string, never>,
  schemaVersion: DOCUMENT_SCHEMA_VERSION,
});

export { documentOf } from "./published";

/**
 * How a new design is created: the product is required by id, which the designer catalogue of the
 * product names (`DesignerCatalogDto.product`). CONTRACT-GAP store.catalog-product-ref — a blank
 * design, opened without a product, has none and is not created.
 */
export interface CreateInput {
  name: string;
  spec: DesignSpec;
  content: DesignContent;
  catalogProductId: string;
  patternId?: string;
  materialId?: string;
  semiDesignTemplateId?: string;
  box?: BoxFields | null;
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
        ...(input.box ?? {}),
      },
    });
    return { data: data!, etag: etagOf(response) };
  },
  /**
   * Every save is a new version, an autosave told apart from a save the customer made (`kind`).
   * The catalogue material and box style the spec names go beside the document, so the API's
   * columns follow a change made in the editor.
   */
  async save(
    designId: string,
    input: {
      name: string;
      kind: Schemas["DesignSaveKind"];
      spec: DesignSpec;
      content: DesignContent;
      thumbnailFileId?: string;
      box?: BoxFields | null;
    },
    etag: string | null,
  ): Promise<Saved<StoreDesign>> {
    const { data, response } = await browserApi().PUT("/v1/store/designs/{designId}", {
      params: { path: { designId }, header: { "If-Match": etag ?? "" } },
      body: {
        title: input.name,
        kind: input.kind,
        ...published(input.spec, input.content),
        ...(isUuid(input.spec.materialId) ? { materialId: input.spec.materialId } : {}),
        ...(isUuid(input.spec.patternId) ? { patternId: input.spec.patternId } : {}),
        ...(input.thumbnailFileId ? { thumbnailFileId: input.thumbnailFileId } : {}),
        ...(input.box ?? {}),
      },
    });
    return { data: data!, etag: etagOf(response) };
  },
  /**
   * `store.designs.patchDocument` (D-276): the changes since the version the server has, as JSON
   * Patch, under `If-Match`; the server keeps the box and spec of the version before.
   */
  async patch(
    designId: string,
    input: { kind: Schemas["DesignSaveKind"]; operations: PatchOperation[] },
    etag: string | null,
  ): Promise<Saved<StoreDesign>> {
    const { data, response } = await browserApi().PATCH("/v1/store/designs/{designId}/document", {
      params: { path: { designId }, header: { "If-Match": etag ?? "" } },
      body: {
        kind: input.kind,
        schemaVersion: DOCUMENT_SCHEMA_VERSION,
        operations: input.operations as Schemas["JsonPatchOperationDto"][],
      },
    });
    return { data: data!, etag: etagOf(response) };
  },
  async remove(designId: string) {
    await browserApi().DELETE("/v1/store/designs/{designId}", { params: { path: { designId } } });
  },
  /** `store.designs.duplicate`: a new design from the current version, under the given title. */
  async duplicate(designId: string, title: string, idempotencyKey: string): Promise<Saved<StoreDesign>> {
    const { data, response } = await browserApi().POST("/v1/store/designs/{designId}/actions/duplicate", {
      params: { path: { designId }, header: { "Idempotency-Key": idempotencyKey } },
      body: { title },
    });
    return { data: data!, etag: etagOf(response) };
  },
  /** The design's versions, newest first, each with its kind (autosave, save, restore, import) and label. */
  async versions(designId: string): Promise<DesignVersion[]> {
    const { data } = await browserApi().GET("/v1/store/designs/{designId}/versions", {
      params: { path: { designId }, query: { limit: 50 } },
    });
    return [...data!].sort((a, b) => b.versionNo - a.versionNo);
  },
  async version(designId: string, versionNo: number): Promise<DesignVersion> {
    const { data } = await browserApi().GET("/v1/store/designs/{designId}/versions/{versionNo}", {
      params: { path: { designId, versionNo } },
    });
    return data!;
  },
  /** `store.designs.restoreVersion`: a new version (kind `restore`) with that version's document. */
  async restore(designId: string, versionNo: number, etag: string | null): Promise<Saved<StoreDesign>> {
    const { data, response } = await browserApi().POST(
      "/v1/store/designs/{designId}/versions/{versionNo}/actions/restore",
      { params: { path: { designId, versionNo }, header: { "If-Match": etag ?? "" } } },
    );
    return { data: data!, etag: etagOf(response) };
  },
  /**
   * Uploads an image once (purpose `design_asset`) and attaches it to the design; the document then
   * refers to it by id. The asset carries its signed URL once the file is scanned clean; until
   * then it is signed for with the file.
   */
  async attachAsset(designId: string, file: File): Promise<{ id: string; url: string }> {
    const uploaded = await uploadFile("customer", file, "design_asset");
    const api = browserApi();
    const { data: design } = await api.POST("/v1/store/designs/{designId}/assets", {
      params: { path: { designId } },
      body: { fileId: uploaded.id, kind: "image" },
    });
    const asset = design!.assets.find((candidate) => candidate.fileId === uploaded.id)!;
    if (asset.url) return { id: asset.id, url: asset.url };
    const { data: signed } = await api.GET("/v1/store/files/{fileId}/download", {
      params: { path: { fileId: uploaded.id } },
    });
    return { id: asset.id, url: signed!.url };
  },
  /** A thumbnail PNG, uploaded as a file for the next save to reference. */
  async uploadThumbnail(dataUrl: string, name: string): Promise<string> {
    // Decoded here, not fetched: the CSP's `connect-src` does not allow `data:` (found on the real stack, U4.6).
    const binary = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const uploaded = await uploadFile("customer", new File([bytes], `${name}.png`, { type: "image/png" }), "artwork");
    return uploaded.id;
  },
  /**
   * `store.designs.import`: the browser's designs become the customer's, each as version 1. A row
   * names its product when the browser kept one (`catalogProductId`); one without is skipped with
   * its reason (`product_not_found`, CONTRACT-GAP store.catalog-product-ref).
   */
  async importLocal(
    designs: {
      localId: string;
      name: string;
      spec: DesignSpec;
      content: DesignContent;
      catalogProductId?: string | null;
    }[],
    idempotencyKey: string,
  ): Promise<Schemas["ImportDesignsResultDto"]> {
    const { data } = await browserApi().POST("/v1/store/designs/actions/import", {
      params: { header: { "Idempotency-Key": idempotencyKey } },
      body: {
        designs: designs.map((d) => ({
          localId: d.localId,
          title: d.name,
          ...published(d.spec, d.content),
          ...(d.catalogProductId ? { catalogProductId: d.catalogProductId } : {}),
        })),
      },
    });
    return data!;
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
