// @vitest-environment node
import { setupServer } from "msw/node";
import type { Client } from "openapi-fetch";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../../mocks/handlers";
import { accessToken, mockId } from "../../../../mocks/support";
import { createApiClient } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { createRequestClient } from "@/lib/api/requests/client";
import { REQUESTS } from "@/lib/api/requests/registry";

import type { Artwork } from "./ArtworkWorkspace";
import { designerHrefOf } from "./designer";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

// Built per call: a client made before `server.listen()` would hold the unpatched `fetch`.
const as = (audience: "customer" | "staff", persona?: string) => ({
  call: ((...args: unknown[]) =>
    (
      createRequestClient(
        REQUESTS,
        createApiClient({
          baseUrl: "http://api.mock",
          accessToken: accessToken(audience, persona),
        }) as unknown as Client<never>,
      ).call as (...a: unknown[]) => unknown
    )(...args)) as ReturnType<typeof createRequestClient<typeof REQUESTS>>["call"],
});
const customer = as("customer");
const prepress = as("staff", "prepress");
const uuid = () => crypto.randomUUID();
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => (isApiError(error) ? error : Promise.reject(error)),
  );

/** The returning customer's seeded orders (mocks/admin/commerce `orders[n]`). */
const DESIGN_ORDER = mockId("ord", 1);
const BLOCKED_ORDER = mockId("ord", 13);

describe("the designer link", () => {
  const base = {
    orderId: "0192f3a0-7c1e-7d2a-9b1f-000000000001",
    orderCode: "PK2609-0001",
    designOption: "online_designer",
    dieline: { dielineKey: "tuck-end", lengthMm: 80, widthMm: 50, heightMm: 120, templateUrl: null },
  } as unknown as Artwork;

  it("opens the designer on the order's box, linked to the order, only when it was set up for one", () => {
    expect(designerHrefOf(base)).toBe(
      "/design/new?style=tuck-end&l=80&w=50&h=120&order=0192f3a0-7c1e-7d2a-9b1f-000000000001&item=0192f3a0-7c1e-7d2a-9b1f-000000000001&orderCode=PK2609-0001",
    );
    expect(designerHrefOf({ ...base, designOption: "own_file" } as Artwork)).toBeNull();
    expect(designerHrefOf({ ...base, dieline: { ...base.dieline, dielineKey: "custom" } } as Artwork)).toBeNull();
  });
});

describe("artwork and proofs, against the mock", () => {
  it("keeps a blocked file out and asks for another; a clean one goes to prepress", async () => {
    const before = await customer.call("GET /v1/store/orders/{orderId}/artwork", { path: { orderId: BLOCKED_ORDER } });
    expect(before.submissions[0]?.preflightStatus).toBe("blocked");
    expect(before.submissions[0]?.findings.some((finding) => finding.severity === "block")).toBe(true);
    expect(before.nextActions.map((action) => action.key)).toContain("artwork.upload");

    const after = await customer.call("POST /v1/store/orders/{orderId}/artwork/submissions", {
      path: { orderId: BLOCKED_ORDER },
      body: { files: [{ fileId: uuid(), role: "artwork" }], note: "ด้านหน้าคือด้านโลโก้" },
      idempotencyKey: uuid(),
    });
    expect(after.submissions[0]?.versionNo).toBe((before.submissions[0]?.versionNo ?? 0) + 1);
    expect(after.submissions[0]?.preflightStatus).not.toBe("blocked");
  });

  it("reviews a proof prepress sends: comments, the checklist, then approval evidence", async () => {
    const submission = (
      await customer.call("GET /v1/store/orders/{orderId}/artwork", { path: { orderId: BLOCKED_ORDER } })
    ).submissions[0]!;
    await prepress.call("POST /v1/admin/prepress/submissions/{submissionId}/actions/accept", {
      path: { submissionId: submission.id },
      body: {},
    });
    await prepress.call("POST /v1/admin/prepress/{orderId}/proofs", {
      path: { orderId: BLOCKED_ORDER },
      body: { submissionId: submission.id, proofFileId: uuid() },
      idempotencyKey: uuid(),
    });

    const artwork = await customer.call("GET /v1/store/orders/{orderId}/artwork", { path: { orderId: BLOCKED_ORDER } });
    const proof = artwork.proofs[0]!;
    expect(proof.status).toBe("pending_customer");
    expect(proof.pages[0]?.imageUrl).toMatch(/^data:image\/svg\+xml/);
    expect(artwork.nextActions.map((action) => action.key)).toContain("proof.approve");

    const thread = await customer.call("POST /v1/store/orders/{orderId}/proofs/{proofId}/annotations", {
      path: { orderId: BLOCKED_ORDER, proofId: proof.id },
      body: { page: 0, kind: "rect", geometry: { x: 0.1, y: 0.2, w: 0.3, h: 0.1 }, body: "ขยายโลโก้อีกนิด" },
    });
    expect(thread.kind).toBe("rect");
    expect(thread.messages[0]?.authorKind).toBe("customer");
    const replied = await customer.call(
      "POST /v1/store/orders/{orderId}/proofs/{proofId}/annotations/{annotationId}/messages",
      { path: { orderId: BLOCKED_ORDER, proofId: proof.id, annotationId: thread.id }, body: { body: "ประมาณ 10%" } },
    );
    expect(replied.messages).toHaveLength(2);

    const partial = await failure(
      customer.call("POST /v1/store/orders/{orderId}/proofs/{proofId}/actions/approve", {
        path: { orderId: BLOCKED_ORDER, proofId: proof.id },
        body: { checklist: ["text"] },
        idempotencyKey: uuid(),
      }),
    );
    expect(partial?.status).toBe(422);

    const approved = await customer.call("POST /v1/store/orders/{orderId}/proofs/{proofId}/actions/approve", {
      path: { orderId: BLOCKED_ORDER, proofId: proof.id },
      body: { checklist: artwork.checklist.map((item) => item.key) },
      idempotencyKey: uuid(),
    });
    expect(approved.proofs[0]?.status).toBe("approved");
    expect(approved.proofs[0]?.decision?.outcome).toBe("approved");
    expect(approved.proofs[0]?.decision?.checklist).toEqual(artwork.checklist.map((item) => item.key));

    const closed = await failure(
      customer.call("POST /v1/store/orders/{orderId}/proofs/{proofId}/annotations", {
        path: { orderId: BLOCKED_ORDER, proofId: proof.id },
        body: { page: 0, kind: "pin", geometry: { x: 0.5, y: 0.5 }, body: "อีกข้อ" },
      }),
    );
    expect(closed?.status).toBe(409);
  });

  it("charges the fourth design round only once the customer accepts the fee (D-071)", async () => {
    const artwork = await customer.call("GET /v1/store/orders/{orderId}/artwork", { path: { orderId: DESIGN_ORDER } });
    const service = artwork.designService!;
    expect(service.freeRounds).toBe(3);
    expect(service.nextRound).toMatchObject({ roundNo: 4, chargeable: true, feeAmount: "500.00" });

    const unaccepted = await failure(
      customer.call("POST /v1/store/orders/{orderId}/design-service/rounds", {
        path: { orderId: DESIGN_ORDER },
        body: { note: "เปลี่ยนสีพื้นหลังเป็นครีม" },
        idempotencyKey: uuid(),
      }),
    );
    expect(unaccepted?.status).toBe(409);

    const requested = await customer.call("POST /v1/store/orders/{orderId}/design-service/rounds", {
      path: { orderId: DESIGN_ORDER },
      body: { note: "เปลี่ยนสีพื้นหลังเป็นครีม", acceptedFee: "500.00" },
      idempotencyKey: uuid(),
    });
    expect(requested.designService?.rounds.at(-1)).toMatchObject({
      roundNo: 4,
      chargeable: true,
      status: "awaiting_payment",
    });
    expect(requested.designService?.pendingFeeInstalment?.grossAmount).toBe("500.00");
  });
});
