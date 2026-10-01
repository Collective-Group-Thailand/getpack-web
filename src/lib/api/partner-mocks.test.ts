// @vitest-environment node
import { setupServer } from "msw/node";
import type { Client } from "openapi-fetch";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../mocks/handlers";
import { accessToken, mockId } from "../../../mocks/support";
import { createApiClient } from "./client";
import { createRequestClient } from "./requests/client";
import { REQUESTS } from "./requests/registry";
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
const requestsAs = (persona: string) => createRequestClient(REQUESTS, partner(persona) as unknown as Client<never>);

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
    expect(me.factories).toEqual([{ factoryId: F001, roles: ["factory_operator"] }]);
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
      requestsAs("owner").call("GET /v1/partner/factories/{factoryId}/change-requests", { path: { factoryId: F006 } }),
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

  it("confirms a statement once, then takes the factory's own tax invoice", async () => {
    const floor = requestsAs("accountant");
    const { data } = await floor.call("GET /v1/partner/factories/{factoryId}/billing-statements", { path });
    const open = data.find((item) => item.status === "sent")!;
    expect(open).toBeDefined();
    const confirm = () =>
      floor.call("POST /v1/partner/factories/{factoryId}/billing-statements/{statementId}/actions/confirm", {
        path: { ...path, statementId: open.id },
        body: {},
        idempotencyKey: "k-bs-confirm",
      });
    const confirmed = await confirm();
    expect(confirmed.status).toBe("confirmed");
    expect((await confirm()).confirmedAt).toBe(confirmed.confirmedAt);
    expect(confirmed.nextActions).toEqual(["submit_tax_invoice"]);

    const invoice = (sellerTaxId: string, key: string) =>
      floor.call("POST /v1/partner/factories/{factoryId}/billing-statements/{statementId}/tax-invoices", {
        path: { ...path, statementId: open.id },
        body: {
          invoiceNo: "INV-TEST-1",
          invoiceDate: "2026-09-27",
          sellerTaxId,
          sellerBranchCode: "00000",
          source: "e_tax",
          eTaxReference: "ETAX-0001",
        },
        idempotencyKey: key,
      });
    await expect(invoice("0105555555554", "k-inv-bad")).rejects.toMatchObject({ status: 422 });
    const factory = (await partner("accountant").GET("/v1/partner/factories/{factoryId}", { params: { path } })).data!;
    const withInvoice = await invoice(factory.taxId, "k-inv-good");
    expect(withInvoice.taxInvoiceStatus).toBe("submitted");
    expect(withInvoice.inputVatStatus).toBe("pending_document");

    const account = await floor.call("GET /v1/partner/factories/{factoryId}/statement-of-account", { path, query: {} });
    expect(account.entries.some((entry) => entry.reference === open.bsNumber)).toBe(true);
  });

  it("schedules each job's payouts by the payout policy (D-022, D-164) and documents paid ones", async () => {
    const floor = requestsAs("owner");
    const schedule = await floor.call("GET /v1/partner/factories/{factoryId}/payout-schedule", { path });
    const job = schedule[0]!;
    expect(job.items.map((item) => [item.kind, item.pct])).toEqual([
      ["advance", "30.0000"],
      ["balance", "65.0000"],
      ["retention", "5.0000"],
    ]);
    const { data: paid } = await floor.call("GET /v1/partner/factories/{factoryId}/payouts", { path });
    expect(paid.length).toBeGreaterThan(0);
    const detail = await floor.call("GET /v1/partner/factories/{factoryId}/payouts/{payoutId}", {
      path: { ...path, payoutId: paid[0]!.id },
    });
    expect(detail.whtCertificate?.url).toMatch(/^data:application\/pdf/);
  });

  it("answers a claim back to the claims desk, and keeps users and prices to their roles", async () => {
    const owner = requestsAs("owner");
    const { data } = await owner.call("GET /v1/partner/factories/{factoryId}/claims", { path });
    const waiting = data.find((item) => item.responseDueAt)!;
    const answered = await owner.call("POST /v1/partner/factories/{factoryId}/claims/{claimId}/actions/respond", {
      path: { ...path, claimId: waiting.id },
      body: { response: "disputed", note: "ผลิตตามปรู๊ฟที่ลูกค้าอนุมัติ" },
      idempotencyKey: "k-claim-1",
    });
    expect(answered.factoryResponse).toBe("disputed");
    expect(answered.status).toBe("under_review");

    await expect(
      requestsAs("operator").call("GET /v1/partner/factories/{factoryId}/users", { path }),
    ).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      requestsAs("operator").call("GET /v1/partner/factories/{factoryId}/billing-statements", { path }),
    ).rejects.toMatchObject({ status: 403 });
    const users = await owner.call("GET /v1/partner/factories/{factoryId}/users", { path });
    const self = users.find((user) => user.isSelf)!;
    await expect(
      owner.call("PATCH /v1/partner/factories/{factoryId}/users/{userId}", {
        path: { ...path, userId: self.id },
        body: { roles: ["factory_planner"] },
      }),
    ).rejects.toMatchObject({ status: 409 });
    const invited = await owner.call("POST /v1/partner/factories/{factoryId}/users", {
      path,
      body: { email: "new.qc@factory.invalid", displayName: "ฝ่าย QC ใหม่", roles: ["factory_qc"] },
    });
    expect(invited.status).toBe("invited");
  });

  it("keeps a locked notification on", async () => {
    const me = requestsAs("owner");
    const saved = await me.call("PUT /v1/partner/me/notification-preferences", {
      body: {
        preferences: [
          { category: "jobs", channel: "email", enabled: false },
          { category: "prices", channel: "email", enabled: false },
        ],
      },
    });
    const row = (category: string) =>
      saved.preferences.find((item) => item.category === category && item.channel === "email")!;
    expect(row("jobs").enabled).toBe(true);
    expect(row("prices").enabled).toBe(false);
  });
});
