/**
 * A palette from a logo (U4.4 "palette extraction, editable"): the image's pixels grouped by
 * median cut into a few boxes of similar colour, each box's mean as one swatch, most used first.
 * Transparent pixels and the near-white paper a logo sits on are left out. Pure (it takes RGBA
 * bytes), so it is tested without a browser; the panel feeds it a downscaled canvas.
 */
export function extractPalette(rgba: Uint8ClampedArray, count = 4): string[] {
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < rgba.length; i += 4) {
    const [r, g, b, a] = [rgba[i]!, rgba[i + 1]!, rgba[i + 2]!, rgba[i + 3]!];
    if (a < 128) continue;
    if (r > 240 && g > 240 && b > 240) continue;
    pixels.push([r, g, b]);
  }
  if (pixels.length === 0) return [];
  let boxes: [number, number, number][][] = [pixels];
  while (boxes.length < count) {
    // Split the box with the widest channel range at its median.
    let best = -1;
    let bestRange = -1;
    let bestChannel = 0;
    boxes.forEach((box, index) => {
      if (box.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let min = 255;
        let max = 0;
        for (const p of box) {
          min = Math.min(min, p[c]!);
          max = Math.max(max, p[c]!);
        }
        if (max - min > bestRange) {
          bestRange = max - min;
          best = index;
          bestChannel = c;
        }
      }
    });
    if (best < 0 || bestRange < 8) break;
    const box = [...boxes[best]!].sort((a, b) => a[bestChannel]! - b[bestChannel]!);
    const half = Math.floor(box.length / 2);
    boxes = [...boxes.slice(0, best), box.slice(0, half), box.slice(half), ...boxes.slice(best + 1)];
  }
  const hex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return boxes
    .filter((box) => box.length > 0)
    .sort((a, b) => b.length - a.length)
    .map((box) => {
      const sum = box.reduce((acc, p) => [acc[0]! + p[0], acc[1]! + p[1], acc[2]! + p[2]], [0, 0, 0]);
      return `#${hex(sum[0]! / box.length)}${hex(sum[1]! / box.length)}${hex(sum[2]! / box.length)}`;
    });
}

/** The pixels of an image URL at most `size` px on its long side (browser only). */
export async function imagePixels(src: string, size = 64): Promise<Uint8ClampedArray> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
  const scale = Math.min(1, size / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
}
