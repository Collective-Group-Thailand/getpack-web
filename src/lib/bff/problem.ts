import { NextResponse } from "next/server";

import type { ProblemDetails } from "@/lib/api/problem";

import type { BffProblemCode } from "./codes";

/**
 * A refusal from the BFF itself, in the same shape the API uses.
 *
 * The browser client turns any failed response into an `ApiError`, so a BFF refusal that
 * looked different would be the one error a screen could not render. `detail` is English and
 * deliberately terse: these are conditions a correct client never produces, so the text is
 * for whoever is debugging, not for a customer.
 */
export function bffProblem(status: number, code: BffProblemCode, detail: string, requestId: string): NextResponse {
  const problem: ProblemDetails = {
    type: `https://errors.packio/${code}`,
    title: code,
    status,
    code,
    detail,
    requestId,
  };

  return new NextResponse(JSON.stringify(problem), {
    status,
    headers: {
      "content-type": "application/problem+json",
      "cache-control": "no-store",
      "x-request-id": requestId,
    },
  });
}
