"use client";

import type { Client } from "openapi-fetch";

import { browserApi } from "../browser";
import { createRequestClient, type RequestClient } from "./client";
import { REQUESTS, type Requests } from "./registry";

let client: RequestClient<Requests> | undefined;

/** Contract requests from a Client Component: through this zone's BFF, like `browserApi`. */
export function browserRequests(): RequestClient<Requests> {
  client ??= createRequestClient(REQUESTS, browserApi() as unknown as Client<never>);
  return client;
}
