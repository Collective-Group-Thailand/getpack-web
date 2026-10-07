/**
 * `store.publicConfig.get` (D-309): the figures the storefront states, each from one source and
 * null without one. Built in packio-api (87da8b1, after v0.42.0); this entry retires itself when a
 * tagged contract carries it. The home page reads the minimum order from here (Main board review).
 */

import { z } from "zod";

import { request } from "./define";

const count = () => z.number().int();

export const publicConfig = z
  .object({
    minOrderQty: z.object({
      /** Lowest minimum quantity among active made-to-order catalogue products (D-307). */
      custom: count().nullable(),
      /** Lowest minimum order among active stock products. */
      readyStock: count().nullable(),
    }),
    priceLockDays: count(),
    claimWindowDays: count(),
    proofSlaBusinessDays: count().nullable(),
    supportHours: z
      .object({
        tz: z.string(),
        days: z.enum(["daily", "business_days", "mon_fri", "mon_sat"]),
        open: z.string().regex(/^\d{2}:\d{2}$/),
        close: z.string().regex(/^\d{2}:\d{2}$/),
      })
      .nullable(),
    supportReplyMinutes: count().nullable(),
    templateCount: count(),
    factoryCount: count().nullable(),
    contact: z.object({
      phone: z.string().nullable(),
      lineOaId: z.string().nullable(),
      email: z.string().nullable(),
    }),
  })
  .meta({ id: "PublicConfigDto" });

export const storeConfigRequests = {
  "GET /v1/store/public-config": request({
    request: "store.public-config",
    summary: "The figures the storefront states: minimum orders, price lock, claim window, support, counts",
    decisions: ["D-309", "D-307", "D-051", "D-082"],
    response: publicConfig,
    public: true,
  }),
} as const;

export type PublicConfig = z.infer<typeof publicConfig>;
