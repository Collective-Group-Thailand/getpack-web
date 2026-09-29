"use client";

import { useParams, useSelectedLayoutSegments } from "next/navigation";
import { useEffect, useState } from "react";

import { useConsent } from "@/lib/analytics/useConsent";

import { mayRecord, replayEnabled, sampleRate, setRecording } from "./replay";
import { routePattern } from "./route-pattern";

/** Starts and stops replay as the route and the consent change (`./replay.ts`). */
export default function SessionReplayGate() {
  const route = routePattern(useSelectedLayoutSegments(), useParams());
  const { consent } = useConsent();
  // Decided once per page load, so a visitor is either in the sample or not for the whole visit.
  const [sampled] = useState(() => Math.random() < sampleRate());

  useEffect(() => {
    void setRecording(mayRecord({ enabled: replayEnabled, consent, route, sampled }));
  }, [consent, route, sampled]);

  return null;
}
