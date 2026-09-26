import "server-only";

import type { Client } from "openapi-fetch";

import type { Zone } from "@/lib/zones";

import { serverApi } from "../server";
import { createRequestClient, type RequestClient } from "./client";
import { REQUESTS, type Requests } from "./registry";

/** Contract requests from a Server Component: `API_INTERNAL_URL` with this zone's token. */
export async function serverRequests(zone: Zone): Promise<RequestClient<Requests>> {
  return createRequestClient(REQUESTS, (await serverApi(zone)) as unknown as Client<never>);
}
