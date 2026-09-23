"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * One TanStack Query client per browser session, created inside the component so a Server
 * Component render never shares a cache between two users' requests.
 *
 * The defaults here are deliberately plain: F1 Deliverable 1.2 replaces them with retry
 * rules by HTTP status and stale times per resource type, once `ApiError` exists to tell a
 * 422 from a 503.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Server Components render the first paint; a refetch on every focus would
            // throw that work away for nothing.
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
