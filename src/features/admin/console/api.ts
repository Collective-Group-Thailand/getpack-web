"use client";

import type { Client } from "openapi-fetch";

import { browserApi } from "@/lib/api/browser";
import { browserRequests } from "@/lib/api/requests/browser";
import type { RequestClient } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import type { ApiPaths } from "@/lib/api/types";

/**
 * Both clients a back-office screen can need — the published contract and the contract
 * requests — so a resource's fetcher runs unchanged on the server and in the browser.
 */
export interface AdminApis {
  contract: Client<ApiPaths>;
  requests: RequestClient<Requests>;
}

export function adminBrowserApis(): AdminApis {
  return { contract: browserApi(), requests: browserRequests() };
}
