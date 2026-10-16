/**
 * A small software rasteriser for thumbnails (U3.3 §3): z-buffered triangles and anti-aliased-by-
 * supersampling lines into an RGBA buffer. Deterministic — the same input gives the same bytes on
 * any machine with the same JavaScript engine, no GPU and no browser — so `pnpm styles:render` is
 * reproducible and getpack-api's drawing service can run it in Node (U3.B5).
 */

export type Rgb = [number, number, number];

export interface Image {
  width: number;
  height: number;
  /** RGBA, row-major, top row first. */
  data: Uint8ClampedArray;
}

export class Raster {
  readonly data: Uint8ClampedArray;
  private readonly depth: Float32Array;

  constructor(
    readonly width: number,
    readonly height: number,
    background: Rgb,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
    this.depth = new Float32Array(width * height).fill(Infinity);
    for (let i = 0; i < width * height; i++) this.data.set([...background, 255], i * 4);
  }

  private put(x: number, y: number, c: Rgb) {
    const i = (y * this.width + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
  }

  /** A filled triangle in pixel space; `z` is depth (smaller is nearer), tested per pixel centre. */
  triangle(a: [number, number, number], b: [number, number, number], c: [number, number, number], colour: Rgb) {
    const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
    const maxX = Math.min(this.width - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) < 1e-12) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area;
        const w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * a[2] + w1 * b[2] + w2 * c[2];
        const i = y * this.width + x;
        if (z >= this.depth[i]) continue;
        this.depth[i] = z;
        this.put(x, y, colour);
      }
    }
  }

  /** A line `width` pixels wide, drawn over everything (no depth); `dash` as [on, off] pixels. */
  line(x0: number, y0: number, x1: number, y1: number, width: number, colour: Rgb, dash?: [number, number]) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 1e-9) return;
    const r = width / 2;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1) - r));
    const maxX = Math.min(this.width - 1, Math.ceil(Math.max(x0, x1) + r));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1) - r));
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(y0, y1) + r));
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5 - x0;
        const py = y + 0.5 - y0;
        const along = px * ux + py * uy;
        if (along < -r || along > len + r) continue;
        if (Math.abs(px * uy - py * ux) > r) continue;
        if (dash && Math.max(0, along) % (dash[0] + dash[1]) > dash[0]) continue;
        this.put(x, y, colour);
      }
    }
  }

  /** Box-filters the raster down by `factor` (supersampling's anti-aliasing). */
  downsample(factor: number): Image {
    const w = Math.floor(this.width / factor);
    const h = Math.floor(this.height / factor);
    const out = new Uint8ClampedArray(w * h * 4);
    const n = factor * factor;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        for (let ch = 0; ch < 4; ch++) {
          let s = 0;
          for (let dy = 0; dy < factor; dy++)
            for (let dx = 0; dx < factor; dx++)
              s += this.data[((y * factor + dy) * this.width + x * factor + dx) * 4 + ch];
          out[(y * w + x) * 4 + ch] = Math.round(s / n);
        }
    return { width: w, height: h, data: out };
  }
}
