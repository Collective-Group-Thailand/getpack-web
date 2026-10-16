"use client";

import { createContext, useContext } from "react";

import type { Zone } from "@/lib/zones";

/**
 * Which zone a client component is rendered in, when a word or a control has to differ by
 * audience (a customer reads แบบตัวอย่าง where staff read Proof). `null` outside a zone's
 * providers — Storybook, a test — so nothing assumes a zone it is not in.
 */
const ZoneContext = createContext<Zone | null>(null);

export function ZoneContextProvider({ zone, children }: { zone: Zone; children: React.ReactNode }) {
  return <ZoneContext.Provider value={zone}>{children}</ZoneContext.Provider>;
}

export function useZone(): Zone | null {
  return useContext(ZoneContext);
}
