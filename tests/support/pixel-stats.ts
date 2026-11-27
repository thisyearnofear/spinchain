/**
 * Pixel statistics for a Playwright screenshot, shared by the visual suite and
 * the effort check.
 *
 * Both files need the same answer to the same question — "is this a drawn
 * frame, or the page backdrop?" — and a second copy of the decoder is how the
 * two drift apart and start disagreeing about what a blank canvas looks like.
 */
import { inflateSync } from "node:zlib";

/**
 * Decode an 8-bit RGB/RGBA PNG (what Playwright screenshots are) with node's
 * zlib and summarise it: distinct colours at 5 bits/channel and luma range.
 */
export function pixelStats(png: Buffer) {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const bitDepth = png[24];
  const colorType = png[25];
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`unsupported PNG: depth ${bitDepth}, colour type ${colorType}`);
  }
  const bpp = colorType === 6 ? 4 : 3;
  const idat: Buffer[] = [];
  for (let off = 8; off < png.length; ) {
    const len = png.readUInt32BE(off);
    const type = png.toString("ascii", off + 4, off + 8);
    if (type === "IDAT") idat.push(png.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const prev = Buffer.alloc(stride);
  const row = Buffer.alloc(stride);
  const colors = new Set<number>();
  let min = 255;
  let max = 0;
  for (let y = 0; y < height; y++) {
    const base = y * (stride + 1);
    const filter = raw[base];
    for (let x = 0; x < stride; x++) {
      const v = raw[base + 1 + x];
      const a = x >= bpp ? row[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      else if (filter === 2) pred = b;
      else if (filter === 3) pred = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      row[x] = (v + pred) & 0xff;
    }
    for (let x = 0; x < stride; x += bpp * 7) {
      const r = row[x], g = row[x + 1], bl = row[x + 2];
      colors.add(((r >> 3) << 10) | ((g >> 3) << 5) | (bl >> 3));
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
      if (lum < min) min = lum;
      if (lum > max) max = lum;
    }
    row.copy(prev);
  }
  return { width, height, distinctColors: colors.size, lumaRange: max - min };
}
