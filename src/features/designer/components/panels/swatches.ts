"use client";

import { useEffect, useState } from "react";

import { useDesigner } from "../DesignerContext";
import { readBrandKit } from "./BrandPanel";

/** One-click colours for every colour field: the customer's brand kit, then the catalogue's. */
export function useSwatches(): { value: string; label: string }[] {
  const { catalog } = useDesigner();
  const [brand, setBrand] = useState<string[]>([]);
  useEffect(() => {
    // Browser storage is read after mount; the server render has no brand kit.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBrand(readBrandKit().colours);
  }, []);
  const seen = new Set<string>();
  return [
    ...brand.map((hex) => ({ value: hex, label: hex })),
    ...(catalog?.colours ?? []).map((c) => ({ value: c.hex, label: c.name })),
  ].filter((s) => !seen.has(s.value.toLowerCase()) && seen.add(s.value.toLowerCase()));
}
