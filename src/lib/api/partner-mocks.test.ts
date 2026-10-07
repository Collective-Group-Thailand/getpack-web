// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../mocks/handlers";
import { accessToken, mockId } from "../../../mocks/support";
import { createApiClient } from "./client";
import type { Schemas } from "./types";
import { FACTORY_ROLE_GRANTS } from "../../../mocks/generated/rbac";

/**
 * The partner surface's mock behaves like the API it stands in for (F5 5.1): a factory reaches
 * its own rows only — another factory's id is a 404 (D-044) — roles are checked against rbac.md,
 * irreversible actions replay by key, and what a factory does lands in the back office's rows.
 */

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

const F001 = "00000000-0000-4000-8000-0000000000f1";
const F005 = mockId("fac", 5);
const F006 = mockId("fac", 6);
const partner = (persona?: string) =>
  createApiClient({ baseUrl: "http://api.mock", accessToken: accessToken("partner", persona) });
const staff = (persona: string) =>
  createApiClient({ baseUrl: "http://api.mock", accessToken: accessToken("staff", persona) });

describe("partner sign-in", () => {
  it("signs each factory role in as itself, with rbac.md's permissions", async () => {
    const api = createApiClient({ baseUrl: "http://api.mock" });
    const { data } = await api.POST("/v1/auth/partner/login", {
      body: { email: "operator@factory.invalid", password: "mock-password" },
    });
    const me = (
      await createApiClient({ baseUrl: "http://api.mock", accessToken: data!.accessToken }).GET("/v1/partner/me")
    ).data!;
    expect(me.roles).toEqual(["factory_operator"]);
    // packio-api's factory-scope grants for the role (`pnpm gen:rbac`, triage `partner.permissions`).
    expect([...me.permissions].sort()).toEqual([...FACTORY_ROLE_GRANTS.factory_operator!].sort());
    // `partner.me.get` names the factory (U-B0.3, `partner.factory-name`).
    expect(me.factories).toEqual([
      { factoryId: F001, code: "F001", name: expect.any(String), roles: ["factory_operator"] },
    ]);
  });
});

describe("the partner surface's scope rules", () => {
  it("answers another factory's id with 404, never 403 (D-044)", async () => {
    for (const path of [
      "/v1/partner/factories/{factoryId}",
      "/v1/partner/factories/{factoryId}/onboarding-steps",
    ] as const) {
      await expect(partner("owner").GET(path, { params: { path: { factoryId: F006 } } })).rejects.toMatchObject({
        status: 404,
      });
    }
    await expect(
      partner("owner").GET("/v1/partner/factories/{factoryId}/change-requests", {
        params: { path: { factoryId: F006 } },
      }),
    ).rejects.toMatchObject({ status: 404 });
    // Token-scoped paths take a factory as an optional filter: another factory's is a 404 too.
    await expect(
      partner("owner").GET("/v1/partner/billing-statements", { params: { query: { factoryId: F006 } } }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("lists only the token's own factories", async () => {
    const { data } = await partner("owner").GET("/v1/partner/factories", {});
    expect(data!.data.map((factory) => factory.id)).toEqual([F001]);
  });

  it("refuses a role without the permission, and a staff token", async () => {
    await expect(
      partner("operator").GET("/v1/partner/factories/{factoryId}/price-lists", {
        params: { path: { factoryId: F001 } },
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      staff("superadmin").GET("/v1/partner/factories/{factoryId}", { params: { path: { factoryId: F001 } } }),
    ).rejects.toMatchObject({ status: 403, code: "auth.wrong_audience" });
  });

  it("never hands a factory a suggestion, a benchmark or another factory's price (D-044)", async () => {
    const api = partner("owner");
    const bodies = await Promise.all([
      api.GET("/v1/partner/factories/{factoryId}/price-lists", { params: { path: { factoryId: F001 } } }),
      api.GET("/v1/partner/factories/{factoryId}/price-proposals", { params: { path: { factoryId: F001 } } }),
      api.GET("/v1/partner/factories/{factoryId}/configuration", { params: { path: { factoryId: F001 } } }),
    ]);
    const text = JSON.stringify(bodies.map((body) => body.data));
    expect(text).not.toMatch(/suggest|benchmark|peer|p75|median/i);
    const proposals = bodies[1]!.data as { data: { factoryId: string }[] };
    expect(proposals.data.every((item) => item.factoryId === F001)).toBe(true);
  });
});

describe("an applicant completing its application (F005)", () => {
  it("adds its details and submits, and the Partner team sees it under review", async () => {
    const api = partner("applicant");
    const path = { params: { path: { factoryId: F005 } } };
    await api.POST("/v1/partner/factories/{factoryId}/contacts", {
      ...path,
      body: { name: "ผู้ติดต่อ ทดสอบ", isPrimary: true },
    });
    const { data: file } = await api.POST("/v1/partner/files/presign", {
      body: { fileName: "cert.pdf", mimeType: "application/pdf", sizeBytes: 10, purpose: "document" },
    });
    await api.POST("/v1/partner/factories/{factoryId}/kyc-documents", {
      ...path,
      body: { docType: "company_certificate", fileId: file!.fileId },
    });
    const { response } = await api.GET("/v1/partner/factories/{factoryId}", path);
    const etag = response.headers.get("etag")!;
    // A stale ETag is refused: two tabs cannot both submit.
    await expect(
      api.POST("/v1/partner/factories/{factoryId}/actions/submit-application", {
        params: { path: { factoryId: F005 }, header: { "If-Match": 'W/"stale"' } },
        body: { reason: "ส่งใบสมัคร" },
      }),
    ).rejects.toMatchObject({ status: 412 });
    const { data } = await api.POST("/v1/partner/factories/{factoryId}/actions/submit-application", {
      params: { path: { factoryId: F005 }, header: { "If-Match": etag } },
      body: { reason: "ส่งใบสมัคร" },
    });
    expect(data!.status).toBe("under_review");
    const admin = await staff("partner_manager").GET("/v1/admin/factories/{factoryId}", path);
    expect(admin.data!.status).toBe("under_review");
  });
});

describe("assisted onboarding and a rate card (F006)", () => {
  it("signs off what Packio entered, once", async () => {
    const api = partner("assisted");
    const steps = (
      await api.GET("/v1/partner/factories/{factoryId}/onboarding-steps", { params: { path: { factoryId: F006 } } })
    ).data!;
    const waiting = steps.find((step) => step.enteredByStaff && !step.factorySignedOffAt)!;
    expect(waiting.step).toBe("capability");
    const { data } = await api.POST("/v1/partner/factories/{factoryId}/onboarding-steps/{step}/actions/sign-off", {
      params: { path: { factoryId: F006, step: waiting.step } },
    });
    expect(data!.factorySignedOffAt).not.toBeNull();
  });

  it("accepts a rate card whole, and a replayed key does not act twice", async () => {
    const api = partner("assisted");
    const list = (
      await api.GET("/v1/partner/factories/{factoryId}/price-proposals", {
        params: { path: { factoryId: F006 }, query: { direction: "packio_to_factory" } },
      })
    ).data!.data;
    const card = list.find((item) => item.status === "submitted")!;
    const init = {
      params: { path: { factoryId: F006, proposalId: card.id }, header: { "Idempotency-Key": "k-rate-card-1" } },
      body: {},
    };
    const first = (
      await api.POST("/v1/partner/factories/{factoryId}/price-proposals/{proposalId}/actions/respond", init)
    ).data!;
    expect(first.status).toBe("accepted_by_factory");
    expect(first.resultingVersion).not.toBeNull();
    const again = (
      await api.POST("/v1/partner/factories/{factoryId}/price-proposals/{proposalId}/actions/respond", init)
    ).data!;
    expect(again.resultingVersion?.id).toBe(first.resultingVersion?.id);
  });
});

describe("a factory price-list proposal (F001)", () => {
  it("refuses a back-dated proposal, takes a future one, and lands it in the admin queue", async () => {
    const api = partner("owner");
    const lists = (
      await api.GET("/v1/partner/factories/{factoryId}/price-lists", { params: { path: { factoryId: F001 } } })
    ).data!;
    const food = lists.find((list) => list.productTypeCode === "food_packaging")!;
    await expect(
      api.POST("/v1/partner/factories/{factoryId}/price-proposals", {
        params: { path: { factoryId: F001 } },
        body: { productTypeId: food.productTypeId, proposedEffectiveFrom: "2020-01-01T00:00:00+07:00" },
      }),
    ).rejects.toMatchObject({ status: 422 });
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const { data: draft } = await api.POST("/v1/partner/factories/{factoryId}/price-proposals", {
      params: { path: { factoryId: F001 } },
      body: {
        productTypeId: food.productTypeId,
        proposedEffectiveFrom: `${future}T00:00:00+07:00`,
        comment: "ค่าแรงขึ้น",
      },
    });
    const rows = (
      await api.GET("/v1/partner/factories/{factoryId}/price-list-versions/{versionId}/lines", {
        params: { path: { factoryId: F001, versionId: food.current!.id }, query: { component: "print_wastes" } },
      })
    ).data!.data;
    const edited = await api.PUT("/v1/partner/factories/{factoryId}/price-proposals/{proposalId}/lines", {
      params: { path: { factoryId: F001, proposalId: draft!.id } },
      body: {
        lines: [
          {
            action: "change",
            component: "print_wastes",
            lineKey: rows[0]!.lineKey,
            values: { ...(rows[0]!.values as object), sheets: 60 },
          },
        ],
      },
    });
    expect(edited.data!.lines[0]!.currentValues).toMatchObject({ sheets: 80 });
    await api.POST("/v1/partner/factories/{factoryId}/price-proposals/{proposalId}/actions/submit", {
      params: { path: { factoryId: F001, proposalId: draft!.id }, header: { "Idempotency-Key": "k-submit-1" } },
    });
    const queue = (
      await staff("partner_manager").GET("/v1/admin/price-proposals", {
        params: { query: { direction: "factory_to_packio", status: "submitted" } },
      })
    ).data!.data;
    expect(queue.map((item) => item.id)).toContain(draft!.id);
    // One open proposal per price list.
    await expect(
      api.POST("/v1/partner/factories/{factoryId}/price-proposals", {
        params: { path: { factoryId: F001 } },
        body: { productTypeId: food.productTypeId, proposedEffectiveFrom: `${future}T00:00:00+07:00` },
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("the production floor and shipping (F001, F5 5.2)", () => {
  const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
  const path = { factoryId: F001 };

  async function photo(api: ReturnType<typeof partner>) {
    const { data } = await api.POST("/v1/partner/files/presign", {
      body: { fileName: "step.jpg", mimeType: "image/jpeg", sizeBytes: 10, purpose: "evidence" },
    });
    return data!.fileId;
  }

  it("accepts a released job, reports every step with the rules B4.2 states, and ships it split", async () => {
    const api = partner("owner");
    const key = (n: number) => ({ "Idempotency-Key": uuid(n) });
    const today = (await api.GET("/v1/partner/factories/{factoryId}/today", { params: { path } })).data!;
    expect(today.counters.awaitingAcceptance).toBeGreaterThanOrEqual(2);
    const toAccept = (await api.GET("/v1/partner/production-jobs", { params: { query: { view: "to_accept" } } })).data!
      .data;
    // The one split across two addresses (D-110).
    const released = toAccept.find((job) => Date.parse(job.acceptDueAt) - Date.now() < 6 * 3_600_000)!;
    expect(released.nextActions.map((action) => action.key)).toEqual(["job.accept", "job.reject", "job.raise_issue"]);
    expect(released.nextActions.find((action) => action.key === "job.reject")?.irreversible).toBe(true);
    const jobPath = { jobId: released.id };
    let job = (
      await api.POST("/v1/partner/production-jobs/{jobId}/actions/accept", {
        params: { path: jobPath, header: key(1) },
      })
    ).data!;
    expect(job.status).toBe("accepted");
    expect(job.destinations).toHaveLength(2);

    for (const milestone of job.milestones.filter((item) => item.status !== "completed")) {
      const update = (body: Omit<Schemas["UpdateMilestoneDto"], "clientRef">, n: number) =>
        api.POST("/v1/partner/production-jobs/{jobId}/milestones/{milestoneId}", {
          params: { path: { ...jobPath, milestoneId: milestone.id }, header: key(n) },
          body: { clientRef: uuid(n), ...body },
        });
      const started = (await update({ action: "start" }, 100 + milestone.seq)).data!;
      expect(started.applied).toBe(true);
      job = started.job;
      // The same report sent again changes nothing (server wins).
      const replayed = await api.POST("/v1/partner/production-jobs/{jobId}/milestones/{milestoneId}", {
        params: { path: { ...jobPath, milestoneId: milestone.id }, header: key(150 + milestone.seq) },
        body: { action: "start", clientRef: uuid(100 + milestone.seq) },
      });
      expect(replayed.data).toMatchObject({ applied: false, reason: "duplicate" });
      if (milestone.evidence === "qc_form") {
        // Completing before a passing QC is refused.
        await expect(update({ action: "complete", quantityOut: 1 }, 260 + milestone.seq)).rejects.toMatchObject({
          status: 409,
          code: "production.evidence_missing",
        });
        const check = (
          await api.POST("/v1/partner/production-jobs/{jobId}/qc-checks", {
            params: { path: jobPath, header: key(300) },
            body: {
              checklistVersion: "packio-web-v1",
              checklist: { colour: "pass", registration: "pass", diecut: "pass", count: "pass", clean: "pass" },
              result: "pass",
              defects: [],
              photoFileIds: [await photo(api)],
            },
          })
        ).data!;
        expect(check).toMatchObject({ result: "pass", isFirstPass: true, checklistVersion: "packio-web-v1" });
      }
      const quantities = milestone.tracksQuantity
        ? { quantityIn: released.quantityOrdered, quantityOut: released.quantityOrdered, quantityScrap: 0 }
        : {};
      if (milestone.evidence === "photo") {
        // No photo where the step asks for one.
        await expect(update({ action: "complete", ...quantities }, 200 + milestone.seq)).rejects.toMatchObject({
          status: 409,
          code: "production.evidence_missing",
        });
      }
      if (milestone.tracksQuantity) {
        // Good plus scrap above what went in is refused by the API, not only by the form.
        await expect(
          update(
            {
              action: "complete",
              ...quantities,
              quantityOut: released.quantityOrdered + 1,
              photoFileIds: [await photo(api)],
            },
            250 + milestone.seq,
          ),
        ).rejects.toMatchObject({ status: 422, code: "production.quantity_invalid" });
      }
      const done = (
        await update(
          {
            action: "complete",
            ...quantities,
            ...(milestone.evidence === "photo" ? { photoFileIds: [await photo(api)] } : {}),
          },
          200 + milestone.seq + 20,
        )
      ).data!;
      expect(done.applied).toBe(true);
      job = done.job;
    }
    expect(job.status).toBe("completed");
    expect(job.quantityGood).toBe(released.quantityOrdered);
    expect(job.nextActions.map((action) => action.key)).toContain("job.ship");

    // Another device completing the last step of a finished job: refused, the server's state stands.
    const last = job.milestones.at(-1)!;
    await expect(
      api.POST("/v1/partner/production-jobs/{jobId}/milestones/{milestoneId}", {
        params: { path: { ...jobPath, milestoneId: last.id }, header: key(999) },
        body: { action: "complete", clientRef: uuid(999), quantityOut: 1 },
      }),
    ).rejects.toMatchObject({ status: 409, code: "production.invalid_status" });

    const plan = (await api.GET("/v1/partner/factories/{factoryId}/ship-plan", { params: { path } })).data!;
    const ready = plan.find((item) => item.jobId === released.id)!;
    expect(ready.destinations).toHaveLength(2);
    expect(ready.blockedReason).toBeNull();
    const shipmentIds: string[] = [];
    for (const [index, destination] of ready.destinations.entries()) {
      const created = (
        await api.POST("/v1/partner/shipments", {
          params: { header: key(400 + index) },
          body: {
            items: [
              { jobId: ready.jobId, destinationId: destination.destinationId, quantity: destination.remainingQuantity },
            ],
            cartonsCount: 2,
            weightG: 12_000,
          },
        })
      ).data!;
      // A draft: the labels come when it is packed.
      expect(created).toMatchObject({ status: "draft", cartons: [], labelFileId: null });
      expect(created.nextActions.map((action) => action.key)).toContain("shipment.mark_ready");
      shipmentIds.push(created.id);
    }
    // A replay of the first create is the same shipment, not a third one.
    const replay = await api.POST("/v1/partner/shipments", {
      params: { header: key(400) },
      body: {
        items: [{ jobId: ready.jobId, destinationId: ready.destinations[0]!.destinationId, quantity: 1 }],
        cartonsCount: 1,
        weightG: 1,
      },
    });
    expect(replay.data!.id).toBe(shipmentIds[0]);
    // Nothing is left to ship to either destination.
    await expect(
      api.POST("/v1/partner/shipments", {
        params: { header: key(450) },
        body: {
          items: [{ jobId: ready.jobId, destinationId: ready.destinations[0]!.destinationId, quantity: 1 }],
          cartonsCount: 1,
          weightG: 1,
        },
      }),
    ).rejects.toMatchObject({ status: 422, code: "shipments.quantity_exceeds" });

    for (const [index, shipmentId] of shipmentIds.entries()) {
      const packed = (
        await api.POST("/v1/partner/shipments/{shipmentId}/actions/ready", {
          params: { path: { shipmentId }, header: key(480 + index) },
        })
      ).data!;
      expect(packed.cartons).toHaveLength(2);
      expect(packed.labelFileId).not.toBeNull();
      const labels = (
        await api.GET("/v1/partner/files/{fileId}/download", { params: { path: { fileId: packed.labelFileId! } } })
      ).data!;
      expect(labels.url).toMatch(/^data:/);
      const shipment = (
        await api.POST("/v1/partner/shipments/{shipmentId}/actions/dispatch", {
          params: { path: { shipmentId }, header: key(500 + index) },
        })
      ).data!;
      expect(shipment.status).toBe("in_transit");
      // A factory delivery needs a photo and a signature (D-013).
      await expect(
        api.POST("/v1/partner/shipments/{shipmentId}/proof-of-delivery", {
          params: { path: { shipmentId }, header: key(590 + index) },
          body: {
            receiverName: "คุณผู้รับ ทดสอบ",
            items: shipment.items.map((item) => ({
              destinationId: item.destinationId,
              deliveredQuantity: item.quantity,
            })),
          },
        }),
      ).rejects.toMatchObject({ status: 409, code: "shipments.pod_required" });
      const delivered = (
        await api.POST("/v1/partner/shipments/{shipmentId}/proof-of-delivery", {
          params: { path: { shipmentId }, header: key(600 + index) },
          body: {
            receiverName: "คุณผู้รับ ทดสอบ",
            items: shipment.items.map((item) => ({
              destinationId: item.destinationId,
              deliveredQuantity: item.quantity,
            })),
            capturedAt: "2026-09-27T15:00:00+07:00",
            photoFileIds: [await photo(api)],
            signatureFileId: await photo(api),
          },
        })
      ).data!;
      expect(delivered.status).toBe("delivered");
      // The order's result comes once every trip of it is delivered (D-021, D-080).
      expect(delivered.items[0]!.toleranceOutcome).toBe(index === shipmentIds.length - 1 ? "exact" : null);
    }
    // The logistics desk sees both PODs waiting for review (D-229).
    const waiting = (
      await staff("logistics").GET("/v1/admin/shipments", { params: { query: { queue: "pod_review", perPage: 100 } } })
    ).data!.data;
    const mine = waiting.filter((row) => shipmentIds.includes(row.id));
    expect(mine).toHaveLength(2);
    expect(mine.every((row) => row.podReview?.state === "pending")).toBe(true);
    expect(mine[0]!.nextActions.map((action) => action.key)).toContain("shipment.review_pod");
  });

  it("keeps an operator from accepting jobs, and another factory's job is not found", async () => {
    const api = partner("operator");
    const { data } = (await api.GET("/v1/partner/production-jobs", {})).data!;
    expect(data[0]!.nextActions.map((action) => action.key)).not.toContain("job.accept");
    await expect(
      api.POST("/v1/partner/production-jobs/{jobId}/actions/accept", {
        params: { path: { jobId: data[0]!.id }, header: { "Idempotency-Key": uuid(700) } },
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      partner("assisted").GET("/v1/partner/production-jobs/{jobId}", { params: { path: { jobId: data[0]!.id } } }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("the factory's money and account (F001, F5 5.3)", () => {
  const path = { factoryId: F001 };
  const key = (name: string) => ({ "Idempotency-Key": `00000000-0000-4000-8000-${name.padStart(12, "0")}` });

  it("disputes and confirms a statement once, then takes the factory's own tax invoice with its amounts", async () => {
    const api = partner("accountant");
    const { data } = await api.GET("/v1/partner/billing-statements", {});
    const open = data!.data.find((item) => item.status === "sent")!;
    expect(open).toBeDefined();
    expect(open.nextActions.map((action) => action.key)).toEqual([
      "billing_statement.confirm",
      "billing_statement.dispute",
      "billing_statement.submit_tax_invoice",
    ]);
    expect(open.nextActions[0]).toMatchObject({ irreversible: true, disabledReason: null });
    // A dispute names its lines (U-B0.3) — one not on the statement is refused — and a disputed
    // statement can still be confirmed (D-090).
    const dispute = (lineNos: number[], name: string) =>
      api.POST("/v1/partner/billing-statements/{statementId}/actions/dispute", {
        params: { path: { statementId: open.id }, header: key(name) },
        body: { note: "ค่าขนส่งไม่ถูกต้อง", lineNos },
      });
    await expect(dispute([open.lines.length + 1], "bd0")).rejects.toMatchObject({ status: 422 });
    const named = open.lines.slice(0, 1).map((line) => line.lineNo);
    const disputed = (await dispute(named, "bd1")).data!;
    expect(disputed).toMatchObject({ status: "disputed", disputedLineNos: named });
    const confirm = async () =>
      (
        await api.POST("/v1/partner/billing-statements/{statementId}/actions/confirm", {
          params: { path: { statementId: open.id }, header: key("bc1") },
        })
      ).data!;
    const confirmed = await confirm();
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.confirmedBy?.displayName).toBeTruthy();
    expect((await confirm()).confirmedAt).toBe(confirmed.confirmedAt);
    expect(confirmed.nextActions.map((action) => action.key)).toEqual(["billing_statement.submit_tax_invoice"]);

    const factory = (await api.GET("/v1/partner/factories/{factoryId}", { params: { path } })).data!;
    const invoice = (netAmount: string, name: string) =>
      api.POST("/v1/partner/billing-statements/{statementId}/tax-invoices", {
        params: { path: { statementId: open.id }, header: key(name) },
        body: {
          vendorInvoiceNo: "INV-TEST-1",
          invoiceDate: "2026-09-27",
          sellerTaxId: factory.taxId,
          sellerBranchCode: "00000",
          netAmount,
          vatAmount: "70.00",
          source: "e_tax",
        },
      });
    // The factory keys its own amounts as decimal strings; the format is checked, never computed.
    await expect(invoice("1000", "bi1")).rejects.toMatchObject({ status: 422 });
    const recorded = (await invoice("1000.00", "bi2")).data!;
    expect(recorded).toMatchObject({
      status: "recorded",
      netAmount: "1000.00",
      vatAmount: "70.00",
      grossAmount: "1070.00",
    });
    const after = (
      await api.GET("/v1/partner/billing-statements/{statementId}", { params: { path: { statementId: open.id } } })
    ).data!;
    expect(after.taxInvoiceStatus).toBe("recorded");
    expect(after.nextActions).toEqual([]);
    await expect(invoice("1000.00", "bi3")).rejects.toMatchObject({ status: 409, code: "payables.invoice_duplicate" });
  });

  it("schedules each job's payouts by the payout policy (D-022, D-164) and documents paid ones", async () => {
    const api = partner("owner");
    const schedule = (await api.GET("/v1/partner/factories/{factoryId}/payout-schedule", { params: { path } })).data!
      .data;
    const job = schedule[0]!;
    expect(job.terms).toMatchObject({ advancePct: "30.0000", retentionPct: "5.0000" });
    expect(job.items[0]!.source).toBe("advance");
    const paid = (await api.GET("/v1/partner/factories/{factoryId}/payouts", { params: { path } })).data!;
    expect(Array.isArray(paid)).toBe(true);
    expect(paid.length).toBeGreaterThan(0);
    const detail = (
      await api.GET("/v1/partner/factories/{factoryId}/payouts/{payoutId}", {
        params: { path: { ...path, payoutId: paid[0]!.id } },
      })
    ).data!;
    expect(detail.allocations.length).toBeGreaterThan(0);
    const documents = (
      await api.GET("/v1/partner/factories/{factoryId}/payouts/{payoutId}/documents", {
        params: { path: { ...path, payoutId: paid[0]!.id } },
      })
    ).data!;
    expect(documents.whtCertificates[0]?.download?.url).toMatch(/^data:application\/pdf/);
    const account = (await api.GET("/v1/partner/factories/{factoryId}/statement-of-account", { params: { path } }))
      .data!;
    expect(account.entries.some((entry) => entry.reference === detail.pvNumber)).toBe(true);
  });

  it("answers a claim back to the claims desk, and keeps users to their roles", async () => {
    const owner = partner("owner");
    const { data } = await owner.GET("/v1/partner/claims", {});
    const waiting = data!.data.find((item) => item.nextActions.some((action) => action.key === "claim.respond"))!;
    expect(waiting).toBeDefined();
    const answered = (
      await owner.POST("/v1/partner/claims/{claimId}/actions/respond", {
        params: { path: { claimId: waiting.id }, header: key("cr1") },
        body: { response: "disputed", note: "ผลิตตาม Proof ที่ลูกค้าอนุมัติ" },
      })
    ).data!;
    expect(answered).toMatchObject({ factoryResponse: "disputed", status: "under_review", nextActions: [] });
    const desk = (
      await staff("cs_lead").GET("/v1/admin/claims/{claimId}", { params: { path: { claimId: waiting.id } } })
    ).data!;
    expect(desk.factoryResponseNote).toBe("ผลิตตาม Proof ที่ลูกค้าอนุมัติ");

    await expect(
      partner("operator").GET("/v1/partner/factories/{factoryId}/users", { params: { path } }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(partner("operator").GET("/v1/partner/billing-statements", {})).rejects.toMatchObject({ status: 403 });
    const users = (await owner.GET("/v1/partner/factories/{factoryId}/users", { params: { path } })).data!;
    const self = users.find((user) => user.isSelf)!;
    await expect(
      owner.PUT("/v1/partner/factories/{factoryId}/users/{userId}/roles", {
        params: { path: { ...path, userId: self.id } },
        body: { roles: ["factory_planner"] },
      }),
    ).rejects.toMatchObject({ status: 403, code: "iam.self_grant" });
    await expect(
      owner.POST("/v1/partner/factories/{factoryId}/users", {
        params: { path },
        body: {
          email: "new.owner@factory.invalid",
          displayName: "เจ้าของใหม่",
          initialPassword: "a-long-first-password",
          roles: ["factory_owner" as never],
        },
      }),
    ).rejects.toMatchObject({ status: 422, code: "factory_users.role_not_allowed" });
    const created = (
      await owner.POST("/v1/partner/factories/{factoryId}/users", {
        params: { path },
        body: {
          email: "new.qc@factory.invalid",
          displayName: "ฝ่าย QC ใหม่",
          initialPassword: "a-long-first-password",
          roles: ["factory_qc"],
        },
      })
    ).data!;
    expect(created).toMatchObject({ status: "active", roles: ["factory_qc"], isSelf: false });
    expect(JSON.stringify(created)).not.toContain("a-long-first-password");
    await owner.POST("/v1/partner/factories/{factoryId}/users/{userId}/actions/deactivate", {
      params: { path: { ...path, userId: created.id } },
    });
    const deactivated = (
      await owner.GET("/v1/partner/factories/{factoryId}/users", {
        params: { path, query: { status: "deactivated" } },
      })
    ).data!;
    expect(deactivated.map((user) => user.id)).toContain(created.id);
    // Setting roles reactivates (U-B0.3).
    const back = (
      await owner.PUT("/v1/partner/factories/{factoryId}/users/{userId}/roles", {
        params: { path: { ...path, userId: created.id } },
        body: { roles: ["factory_qc", "factory_shipping"] },
      })
    ).data!;
    expect(back).toMatchObject({ status: "active", roles: ["factory_qc", "factory_shipping"] });
  });

  it("keeps a locked notification on (D-231)", async () => {
    const me = partner("owner");
    await expect(
      me.PUT("/v1/partner/me/notification-preferences", {
        body: { preferences: [{ category: "transactional", channel: "email", enabled: false }] },
      }),
    ).rejects.toMatchObject({ status: 422 });
    const saved = (
      await me.PUT("/v1/partner/me/notification-preferences", {
        body: { preferences: [{ category: "transactional", channel: "line", enabled: false }] },
      })
    ).data!;
    const row = (category: string, channel: string) =>
      saved.preferences.find((item) => item.category === category && item.channel === channel)!;
    expect(row("transactional", "email")).toMatchObject({ enabled: true, locked: true });
    expect(row("transactional", "line")).toMatchObject({ enabled: false, locked: false });
    expect(row("security", "web_push").locked).toBe(true);
  });
});
