"use client";

import type { Client } from "openapi-fetch";

import { browserApi } from "../browser";
import { createRequestClient, type RequestClient } from "./client";
import type { Requests } from "./registry";

let client: RequestClient<Requests> | undefined;

/**
 * Contract requests from a Client Component: through this zone's BFF, like `browserApi`.
 *
 * The registry is imported as a type only. The client needs it for typing, never at run time,
 * and its value is every request's zod schema — which, imported here, put all of them and zod
 * itself into every page's initial JavaScript.
 */
export function browserRequests(): RequestClient<Requests> {
  client ??= createRequestClient({} as Requests, browserApi() as unknown as Client<never>);
  return client;
}
