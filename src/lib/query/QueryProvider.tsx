"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { queryClientConfig } from "./defaults";

/**
 * One TanStack Query client per browser session, created inside the component so a Server
 * Component render never shares a cache between two users' requests.
 *
 * The defaults live in `./defaults.ts` because the retry rule reads `ApiError`, and a rule
 * that decides whether to repeat a request is worth testing on its own.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient(queryClientConfig));

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
