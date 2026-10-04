import { create } from "zustand";

/** A comment pinned on the sheet, as the canvas and the 3D view draw it (U4.7). */
export interface SheetPin {
  id: string;
  /** Its number in the comments panel. */
  n: number;
  /** On the outside of the flat sheet, mm. */
  xMm: number;
  yMm: number;
  resolved: boolean;
}

/** A place picked for a new comment: a point of the sheet, on a face when it was picked in 3D. */
export interface PickedPlace {
  xMm: number;
  yMm: number;
  /** Set for a pick on the 3D box (the face it hit). */
  faceId: string | null;
}

interface PinsState {
  pins: SheetPin[];
  /** Waiting for a click on the sheet or the box to place a new comment. */
  placing: boolean;
  active: string | null;
  picked: PickedPlace | null;
  setPins: (pins: SheetPin[]) => void;
  setPlacing: (placing: boolean) => void;
  setActive: (id: string | null) => void;
  pick: (place: PickedPlace) => void;
  clearPicked: () => void;
}

/**
 * The comments' pins shared by the panel, the flat canvas and the 3D view: the panel lists them
 * and arms placing; a click on either view answers with the place.
 */
export const useCommentPins = create<PinsState>((set) => ({
  pins: [],
  placing: false,
  active: null,
  picked: null,
  setPins: (pins) => set({ pins }),
  setPlacing: (placing) => set({ placing }),
  setActive: (active) => set({ active }),
  pick: (picked) => set({ picked, placing: false }),
  clearPicked: () => set({ picked: null }),
}));
