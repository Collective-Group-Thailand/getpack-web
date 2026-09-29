"use client";

import dynamic from "next/dynamic";

import { replayEnabled } from "./report";

// Only a build with replay on ever fetches the gate; with the flag off this import is dead code.
const SessionReplayGate = dynamic(() => import("./SessionReplayGate"), { ssr: false });

/**
 * Turns session replay on and off as the customer moves between pages (`./replay.ts`). Mounted
 * once in the customer zone's root layout; renders nothing.
 */
export function SessionReplay() {
  return replayEnabled ? <SessionReplayGate /> : null;
}
