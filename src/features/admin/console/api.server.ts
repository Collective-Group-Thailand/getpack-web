import "server-only";

import { serverApi } from "@/lib/api/server";
import { serverRequests } from "@/lib/api/requests/server";

import type { AdminApis } from "./api";

export async function adminServerApis(): Promise<AdminApis> {
  const [contract, requests] = await Promise.all([serverApi("admin"), serverRequests("admin")]);
  return { contract, requests };
}
