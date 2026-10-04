import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { facing } from "./Preview3D";

/** The group's rotation applied to a normal, as three.js does (Euler XYZ). */
const turned = (n: THREE.Vector3) => {
  const r = facing(n);
  return n.clone().applyEuler(new THREE.Euler(r.x, r.y, 0, "XYZ"));
};

describe("turning the box to a picked face (U4.3)", () => {
  it.each([
    ["front", new THREE.Vector3(0, 0, 1)],
    ["right", new THREE.Vector3(1, 0, 0)],
    ["back", new THREE.Vector3(0, 0, -1)],
    ["top", new THREE.Vector3(0, 1, 0)],
    ["bottom", new THREE.Vector3(0, -1, 0)],
    ["slanted", new THREE.Vector3(0.4, 0.5, 0.77).normalize()],
  ])("brings the %s face to face the camera", (_name, normal) => {
    const n = turned(normal);
    expect(n.z).toBeGreaterThan(0.999);
  });
});
