// Optimizes character GLBs in place for mobile.
// - dedup, resample (mocap keyframe reduction), prune, quantize, WebP textures (max 1024)
// - NO Draco / meshopt: runtime GLTFLoader has no decoders and must work offline.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup,
  resample,
  prune,
  quantize,
  textureCompress,
} from '@gltf-transform/functions';
import sharp from 'sharp';
import draco3d from 'draco3d';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const CHAR_DIR = new URL('../public/characters/', import.meta.url).pathname;
// Every character GLB in the directory — new Mint archetypes (volt, …)
// get the same treatment automatically.
const FILES = (await readdir(CHAR_DIR)).filter((f) => f.endsWith('.glb'));

// Draco decoder is needed only to READ the Mint exports; output uses no
// geometry compression (runtime GLTFLoader has no decoders, must work offline).
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });

for (const file of FILES) {
  const path = join(CHAR_DIR, file);
  const before = (await stat(path)).size;

  const doc = await io.read(path);

  // Strip Draco from the doc: geometry is decoded on read; we must not
  // re-encode (runtime has no decoder and works offline).
  for (const ext of doc.getRoot().listExtensionsUsed()) {
    if (ext.extensionName === 'KHR_draco_mesh_compression') ext.dispose();
  }

  await doc.transform(
    dedup(),
    resample(), // reduce dense mocap keyframes
    prune(),
    quantize(), // KHR_mesh_quantization — natively supported by three.js GLTFLoader
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp', // EXT_texture_webp — natively supported
      resize: [1024, 1024],
    }),
  );
  await io.write(path, doc);

  const after = (await stat(path)).size;
  console.log(
    `${file}: ${(before / 1e6).toFixed(2)}MB -> ${(after / 1e6).toFixed(2)}MB (${((1 - after / before) * 100).toFixed(1)}% smaller)`,
  );
}
