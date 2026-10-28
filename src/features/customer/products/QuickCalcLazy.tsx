"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/ui/components/Skeleton";

import type { CalcProduct } from "./QuickCalc";

/**
 * The calculator is loaded lazily (prompt hard rule 9): its script arrives after the page, and a
 * plain frame of the same size holds its place meanwhile (no layout shift).
 */
const QuickCalc = dynamic(() => import("./QuickCalc").then((module) => module.QuickCalc), {
  ssr: false,
  loading: () => <Skeleton className="rounded-panel h-[30rem] w-full" />,
});

export function QuickCalcLazy(props: { products: CalcProduct[]; guaranteeHref: string }) {
  return <QuickCalc {...props} />;
}
