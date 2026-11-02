// Optimizes world art for mobile download.
// - public/images/worlds/*.jpg -> *.webp alongside, quality 82
// - The world art is DOM imagery (<img> in showcase/overlay/worlds-section),
//   not GPU textures — the worlds themselves are procedural shaders — so
//   WebP is the right tool here, not KTX2/ETC1S (browsers can't render .ktx2
//   in <img>, and iOS <16.4 WebViews can't render .avif).
// - Source JPGs stay on disk as masters; only .webp is referenced.
import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const WORLD_DIR = new URL('../public/images/worlds/', import.meta.url).pathname;
const FILES = (await readdir(WORLD_DIR)).filter((f) => f.endsWith('.jpg'));

for (const file of FILES) {
  const src = join(WORLD_DIR, file);
  const out = join(WORLD_DIR, file.replace(/\.jpg$/, '.webp'));
  const before = (await stat(src)).size;

  await sharp(src).webp({ quality: 82, effort: 6 }).toFile(out);

  const after = (await stat(out)).size;
  console.log(
    `${file} -> .webp: ${(before / 1e3).toFixed(0)}KB -> ${(after / 1e3).toFixed(0)}KB (${((1 - after / before) * 100).toFixed(1)}% smaller)`,
  );
}
