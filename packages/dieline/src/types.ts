/**
 * Geometry types for flat box dielines. Framework-free: no React, no DOM.
 * All lengths are millimetres.
 */

export type Pt = [number, number];

/** One panel of a flat dieline. Units: millimetres. */
export interface Face {
  id: string;
  name: string;
  points: Pt[];
  /** Indices of edges (points[i] -> points[i+1]) that are fold/crease lines. All others are cut lines. */
  folds: number[];
}

export interface Dieline {
  faces: Face[];
  width: number;
  height: number;
}

export type BoxStyleId = "rsc" | "tuck-end" | "tray";

export interface BoxDims {
  length: number; // L
  width: number; // W
  height: number; // H
}
