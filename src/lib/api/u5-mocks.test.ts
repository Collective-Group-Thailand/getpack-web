import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handlers } from "../../../mocks/handlers";
import { mockDeepLink } from "../../../mocks/store/launchpad";
import { accessToken } from "../../../mocks/support";
import { seedFromDefaults } from "@/features/customer/configurator/state";
import { createApiClient, newIdempotencyKey } from "@/lib/api/client";

/**
 * The U5.B surface the storefront and the back office now call, against the mock API: the
 * launchpad and deep links (D-297, D-299), one conversation seen from both sides (D-300), and an
 * RFQ basket from draft to cart (D-301).
 */

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

const BASE = "http://api.mock";
const customer = (persona?: string) =>
  createApiClient({ baseUrl: BASE, accessToken: accessToken("customer", persona) });
const staff = (persona = "cs") => createApiClient({ baseUrl: BASE, accessToken: accessToken("staff", persona) });
const key = () => ({ "Idempotency-Key": newIdempotencyKey() });

describe("the launchpad (D-297) and defaults (D-298)", () => {
  it("names one next step, in the API's order, and only the customer's own records", async () => {
    const { data } = await customer().GET("/v1/store/me/launchpad");
    expect(data!.nextStep.kind).toMatch(
      /^(pay|approve_proof|upload_artwork|confirm_receipt|reorder|resume_design|start_configuration)$/,
    );
    expect(data!.designs.length).toBeLessThanOrEqual(5);
    expect(data!.reorderCandidates.length).toBeLessThanOrEqual(5);
    if (data!.needsAction[0])
      expect(data!.nextStep).toMatchObject({ kind: data!.needsAction[0].action, targetId: data!.needsAction[0].id });
  });

  it("pre-fills the material of the last quotation only when this configurator offers it", async () => {
    const { data: configurator } = await createApiClient({ baseUrl: BASE }).GET(
      "/v1/store/catalog/products/{slug}/configurator",
      { params: { path: { slug: "tuck-end-box" } } },
    );
    const material = configurator!.optionGroups.find((group) => group.kind === "material")!.options.at(-1)!;
    const code = configurator!.productTypeCode;
    expect(
      seedFromDefaults(configurator!, [{ productTypeCode: code, materialId: material.id }])?.choices?.material,
    ).toEqual([material.id]);
    expect(seedFromDefaults(configurator!, [{ productTypeCode: code, materialId: "not-offered" }])).toBeUndefined();
    expect(seedFromDefaults(configurator!, [{ productTypeCode: "other", materialId: material.id }])).toBeUndefined();
  });
});

describe("notification deep links (D-299)", () => {
  it("opens the recipient's page, refuses anyone else, and says when it has expired", async () => {
    const { data: me } = await customer().GET("/v1/store/me");
    const token = mockDeepLink({ path: "/account/orders", customerId: me!.id });
    const { data } = await customer().POST("/v1/store/deep-links/actions/resolve", { body: { token } });
    expect(data!.path).toBe("/account/orders");

    await expect(
      customer("buyer").POST("/v1/store/deep-links/actions/resolve", { body: { token } }),
    ).rejects.toMatchObject({
      status: 404,
    });
    const expired = mockDeepLink({ path: "/account", customerId: me!.id, expired: true });
    await expect(
      customer().POST("/v1/store/deep-links/actions/resolve", { body: { token: expired } }),
    ).rejects.toMatchObject({
      status: 410,
      code: "deep_links.expired",
    });
  });
});

describe("one conversation, both sides (D-300)", () => {
  it("goes from the customer to the inbox and back, with notes kept from the customer", async () => {
    const shopper = customer("artist");
    const opened = await shopper.POST("/v1/store/conversations", {
      params: { header: key() },
      body: { subjectType: "support", body: "ขอใบเสนอราคากล่อง 3 ขนาด (ทดสอบ)" },
    });
    const id = opened.data!.conversationId;

    const inbox = await staff().GET("/v1/admin/conversations", { params: { query: { assigned: "unassigned" } } });
    const row = inbox.data!.data.find((thread) => thread.id === id)!;
    expect(row.sla.state).toBe("waiting");
    expect(row.sla.firstResponseDueAt).not.toBeNull();

    await staff().POST("/v1/admin/conversations/{conversationId}/notes", {
      params: { path: { conversationId: id }, header: key() },
      body: { body: "ลูกค้าประจำ — ให้ส่วนลดตามระดับ" },
    });
    await staff().POST("/v1/admin/conversations/{conversationId}/messages", {
      params: { path: { conversationId: id }, header: key() },
      body: { body: "ได้เลยค่ะ ส่งขนาดมาได้เลย" },
    });

    const afterReply = (
      await staff().GET("/v1/admin/conversations/{conversationId}", { params: { path: { conversationId: id } } })
    ).data!;
    expect(afterReply.sla.state).toBe("answered");
    expect(afterReply.assignee?.displayName).toBeTruthy();

    const theirs = (
      await shopper.GET("/v1/store/conversations/{conversationId}/messages", {
        params: { path: { conversationId: id } },
      })
    ).data!.data;
    expect(theirs.map((message) => message.body)).toEqual([
      "ได้เลยค่ะ ส่งขนาดมาได้เลย",
      "ขอใบเสนอราคากล่อง 3 ขนาด (ทดสอบ)",
    ]);
    expect(theirs.every((message) => message.visibility === "customer")).toBe(true);

    // Reading moved the customer's position: Packio sees its reply as read.
    const staffView = (
      await staff().GET("/v1/admin/conversations/{conversationId}/messages", {
        params: { path: { conversationId: id } },
      })
    ).data!.data;
    expect(staffView.find((message) => message.body === "ได้เลยค่ะ ส่งขนาดมาได้เลย")?.readAt).not.toBeNull();
    expect(staffView.some((message) => message.visibility === "internal")).toBe(true);
  });

  it("never lets one customer read another's thread or cite another's order", async () => {
    const opened = await customer("artist").POST("/v1/store/conversations", {
      params: { header: key() },
      body: { subjectType: "support", body: "อีกเรื่อง" },
    });
    await expect(
      customer("buyer").GET("/v1/store/conversations/{conversationId}", {
        params: { path: { conversationId: opened.data!.conversationId } },
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      customer("artist").POST("/v1/store/conversations", {
        params: { header: key() },
        body: { subjectType: "order", subjectId: "00000000-0000-4000-8000-00000000dead", body: "?" },
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
});

const SPECS: Record<string, Record<string, unknown>> = {
  paper_bag: { paper: "kraft", handle: "twisted" },
  other: { description: "กล่องโชว์สินค้าตั้งโต๊ะ (ทดสอบ)" },
};

describe("the RFQ basket (D-301)", () => {
  it("collects items, sends one RFQ per item with one conversation, and refuses to send without a postcode", async () => {
    const buyer = customer("companybuyer");
    for (const productTypeCode of ["paper_bag", "other"]) {
      await buyer.POST("/v1/store/rfq-baskets/draft/items", {
        params: { header: key() },
        body: {
          productTypeCode,
          specSchemaVersion: 1,
          spec: SPECS[productTypeCode]!,
          lengthMm: 200,
          widthMm: 100,
          heightMm: 80,
          quantities: [500, 1000],
        },
      });
    }
    await expect(
      buyer.POST("/v1/store/rfq-baskets/draft/actions/submit", { params: { header: key() } }),
    ).rejects.toMatchObject({ status: 422 });
    await buyer.PATCH("/v1/store/rfq-baskets/draft", { body: { deliveryPostcode: "10110", notes: "ส่งพร้อมกัน" } });
    const sent = (await buyer.POST("/v1/store/rfq-baskets/draft/actions/submit", { params: { header: key() } })).data!;
    expect(sent.status).toBe("submitted");
    expect(sent.basketCode).toMatch(/^RFB-/);
    expect(sent.items.map((item) => item.rfq?.rfqCode)).toEqual([
      expect.stringMatching(/^RFQ-/),
      expect.stringMatching(/^RFQ-/),
    ]);
    expect(sent.conversationId).not.toBeNull();

    // A new draft starts empty.
    const draft = (await buyer.GET("/v1/store/rfq-baskets/draft")).data!;
    expect(draft.items).toEqual([]);
    const listed = (await buyer.GET("/v1/store/rfq-baskets")).data!;
    expect(listed.some((basket) => basket.id === sent.id)).toBe(true);
  });
});
