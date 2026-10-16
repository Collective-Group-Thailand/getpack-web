// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../mocks/handlers";
import { accessToken } from "../../../mocks/support";
import { createApiClient } from "./client";

/**
 * The getpack Factory ERP E3 mock (getpack-api v0.46, D-352 – D-358) keeps what the screens show: who may read
 * machines and maintenance, a breakdown that stops the machine and raises an alert until the repair is done,
 * and documents that remind before they expire.
 */

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

const F001 = "00000000-0000-4000-8000-0000000000f1";
const api = (persona: string) =>
  createApiClient({ baseUrl: "http://api.mock", accessToken: accessToken("partner", persona) });
const path = { factoryId: F001 };
const key = (n: number) => ({ "Idempotency-Key": `00000000-0000-4000-8000-0000000e3${String(n).padStart(3, "0")}` });

describe("getpack Factory ERP E3 mock", () => {
  it("lets the maintenance technician run a breakdown from report to finish (D-355)", async () => {
    const machines = (
      await api("maintenance").GET("/v1/partner/factories/{factoryId}/erp/machines", { params: { path } })
    ).data!;
    const press = machines[0]!;
    expect(press.state).toBe("idle");
    const mt = (
      await api("operator").POST("/v1/partner/factories/{factoryId}/erp/maintenance/orders/breakdowns", {
        params: { path, header: key(1) },
        body: { machineId: press.id, title: "ลูกกลิ้งหมึกมีเสียงดัง", priority: "urgent" },
      })
    ).data!;
    expect(mt).toMatchObject({ kind: "breakdown", status: "open", nextActions: [] });
    const down = (
      await api("maintenance").GET("/v1/partner/factories/{factoryId}/erp/machines/{machineId}", {
        params: { path: { ...path, machineId: press.id } },
      })
    ).data!;
    expect(down).toMatchObject({ state: "down", openMaintenance: { id: mt.id } });
    const count = (await api("owner").GET("/v1/partner/factories/{factoryId}/erp/alerts/count", { params: { path } }))
      .data!;
    expect(count.byKind.machine_breakdown).toBe(1);

    // The operator reports; only maintenance (or the planner, the owner) repairs.
    await expect(
      api("operator").POST("/v1/partner/factories/{factoryId}/erp/maintenance/orders/{mtId}/actions/start", {
        params: { path: { ...path, mtId: mt.id }, header: key(2) },
      }),
    ).rejects.toMatchObject({ status: 403 });
    const started = (
      await api("maintenance").POST("/v1/partner/factories/{factoryId}/erp/maintenance/orders/{mtId}/actions/start", {
        params: { path: { ...path, mtId: mt.id }, header: key(3) },
      })
    ).data!;
    expect(started.status).toBe("in_progress");
    const done = (
      await api("maintenance").POST("/v1/partner/factories/{factoryId}/erp/maintenance/orders/{mtId}/actions/finish", {
        params: { path: { ...path, mtId: mt.id }, header: key(4) },
        body: { resolution: "เปลี่ยนตลับลูกปืน ทดสอบเดินเครื่องผ่าน", downtimeMinutes: 45 },
      })
    ).data!;
    expect(done).toMatchObject({ status: "done", downtimeMinutes: 45 });
    const after = (await api("owner").GET("/v1/partner/factories/{factoryId}/erp/alerts/count", { params: { path } }))
      .data!;
    expect(after.byKind.machine_breakdown ?? 0).toBe(0);
  });

  it("keeps machines from a purchaser and maintenance from a QC inspector (rbac.md)", async () => {
    await expect(
      api("purchaser").GET("/v1/partner/factories/{factoryId}/erp/machines", { params: { path } }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      api("qc").GET("/v1/partner/factories/{factoryId}/erp/maintenance/orders", { params: { path } }),
    ).rejects.toMatchObject({ status: 403 });
    const plans = (
      await api("maintenance").GET("/v1/partner/factories/{factoryId}/erp/maintenance/plans", { params: { path } })
    ).data!;
    expect(plans.length).toBeGreaterThan(0);
  });

  it("files a document and lists it as expiring inside its reminder (D-356)", async () => {
    const folder = (
      await api("purchaser").POST("/v1/partner/factories/{factoryId}/erp/documents/folders", {
        params: { path },
        body: { name: "สัญญา" },
      })
    ).data!;
    const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const doc = (
      await api("purchaser").POST("/v1/partner/factories/{factoryId}/erp/documents", {
        params: { path },
        body: {
          title: "สัญญาซื้อกระดาษ",
          category: "contract",
          fileId: "00000000-0000-4000-8000-00000000f901",
          folderId: folder.id,
          expiresOn: soon,
          remindDays: 30,
        },
      })
    ).data!;
    expect(doc).toMatchObject({ expiry: "expiring", currentVersion: 1 });
    const expiring = (
      await api("operator").GET("/v1/partner/factories/{factoryId}/erp/documents", {
        params: { path, query: { expiry: "expiring" } },
      })
    ).data!;
    expect(expiring.data.map((d) => d.id)).toContain(doc.id);
    await expect(
      api("purchaser").DELETE("/v1/partner/factories/{factoryId}/erp/documents/folders/{folderId}", {
        params: { path: { ...path, folderId: folder.id } },
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
