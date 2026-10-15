"use client";

import { useEffect } from "react";

import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";

import { AGENT_COOKIE } from "./cookie";

/**
 * Claims the agent code this browser arrived with, once, for the signed-in customer (D-417). Whatever
 * the API answers — linked, or not with a reason — the code is used up; a network failure keeps it
 * for the next page.
 */
export function ClaimAgentLink({ code }: { code: string }) {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await browserApi().POST("/v1/store/agent/claims", { body: { code } });
        if (!cancelled) document.cookie = `${AGENT_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
      } catch (error) {
        // A refusal (an unknown code) is final; signed out, offline or a server error is tried on a later page.
        if (isApiError(error) && error.status >= 400 && error.status < 500 && error.status !== 401) {
          document.cookie = `${AGENT_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);
  return null;
}
