"use client";

import { useParams, useSelectedLayoutSegments } from "next/navigation";
import { useEffect, useState } from "react";

import { useConsent } from "@/lib/analytics/useConsent";

import { mayRecord, replayEnabled, sampleRate, setRecording } from "./replay";
import { routePattern } from "./route-pattern";

/**
 * Turns session replay on and off as the customer moves between pages (`./replay.ts`). Mounted
 * once in the customer zone's root layout; renders nothing. With the build flag off — the
 * default — it returns before any of the replay code is reached.
 */
export function SessionReplay() {
  if (!replayEnabled) return null;
  return <SessionReplayGate />;
}

function SessionReplayGate() {
  const route = routePattern(useSelectedLayoutSegments(), useParams());
  const { consent } = useConsent();
  // Decided once per page load, so a visitor is either in the sample or not for the whole visit.
  const [sampled] = useState(() => Math.random() < sampleRate());

  useEffect(() => {
    void setRecording(mayRecord({ enabled: replayEnabled, consent, route, sampled }));
  }, [consent, route, sampled]);

  return null;
}
