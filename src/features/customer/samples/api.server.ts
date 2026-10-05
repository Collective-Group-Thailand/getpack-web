import "server-only";

import { isApiError } from "@/lib/api/problem";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";

export type Sample = Schemas["SampleDto"];

/** My samples, newest first (`store.samples.list`): attached to my orders and asked for before ordering. */
export async function listMySamples(): Promise<Sample[]> {
  const { data } = await (await serverApi("customer")).GET("/v1/store/samples", {});
  return data!.data;
}

/** One of my samples, or `null` when it is not mine (404). Never cached. */
export async function getMySample(sampleId: string): Promise<Sample | null> {
  try {
    const { data } = await (
      await serverApi("customer")
    ).GET("/v1/store/samples/{sampleId}", {
      params: { path: { sampleId } },
    });
    return data!;
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}
