import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";
import type { Dieline, HingeMap, MaterialSpec } from "@packio/dieline";

import { buildGeometry, triangulated } from "../components/Preview3D";

export interface BoxModelInput {
  dieline: Dieline;
  hinges: HingeMap | null;
  material: MaterialSpec;
  /** The outside's artwork on the sheet (an image URL), or `null` for a plain box. */
  artwork: string | null;
  insideArtwork?: string | null;
  boardColour: string;
}

export interface BoxModel {
  /** glTF binary (Android, desktop viewers). */
  glb: Blob;
  /** USDZ for Quick Look on iPhone and iPad, or `null` when it could not be written here. */
  usdz: Blob | null;
  /** The closed box's size, mm (width × height × depth of its bounds). */
  sizeMm: [number, number, number];
}

const texture = async (url: string | null | undefined) => {
  if (!url) return null;
  const loaded = await new THREE.TextureLoader().loadAsync(url);
  loaded.colorSpace = THREE.SRGBColorSpace;
  return loaded;
};

/**
 * The closed box as a 3D model at its real size, for AR (U4.7): the 3D preview's own geometry —
 * the engine's fold and thickness model, the artwork on the printed surface, the inside print or the
 * board's colour inside — in metres, standing on the floor (its lowest point at 0). Finishes are
 * left out: AR shows the size and the print, the proof shows the finish.
 */
export async function boxModel(input: BoxModelInput): Promise<BoxModel> {
  const { dieline, hinges, material, boardColour } = input;
  const g = buildGeometry(dieline, triangulated(dieline), hinges, material, 1);
  const metres = 0.001 / g.scale;
  for (const geometry of [g.printed, g.board]) geometry.scale(metres, metres, metres);
  const bounds = new THREE.Box3()
    .setFromBufferAttribute(g.printed.getAttribute("position") as THREE.BufferAttribute)
    .union(new THREE.Box3().setFromBufferAttribute(g.board.getAttribute("position") as THREE.BufferAttribute));
  for (const geometry of [g.printed, g.board]) geometry.translate(0, -bounds.min.y, 0);
  const size = bounds.getSize(new THREE.Vector3());

  const [outside, inside] = await Promise.all([texture(input.artwork), texture(input.insideArtwork)]);
  const scene = new THREE.Scene();
  scene.add(
    new THREE.Mesh(
      g.printed,
      new THREE.MeshStandardMaterial({ map: outside, color: outside ? "#ffffff" : boardColour, roughness: 0.75 }),
    ),
  );
  scene.add(
    new THREE.Mesh(g.board, [
      new THREE.MeshStandardMaterial({
        map: inside,
        color: inside ? "#ffffff" : boardColour,
        roughness: 0.9,
        side: THREE.DoubleSide,
      }),
      new THREE.MeshStandardMaterial({ color: boardColour, roughness: 0.9, side: THREE.DoubleSide }),
    ]),
  );

  const glb = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
  let usdz: Blob | null = null;
  try {
    const bytes = await new USDZExporter().parseAsync(scene);
    usdz = new Blob([bytes as BlobPart], { type: "model/vnd.usdz+zip" });
  } catch {
    // model-viewer writes its own USDZ for Quick Look when it is given none.
  }
  return {
    glb: new Blob([glb], { type: "model/gltf-binary" }),
    usdz,
    sizeMm: [size.x * 1000, size.y * 1000, size.z * 1000].map((n) => Math.round(n)) as [number, number, number],
  };
}
