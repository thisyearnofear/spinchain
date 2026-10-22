#!/usr/bin/env node
/**
 * Cloud Kingdom world art.
 *
 * The other five world images are hand-illustrated. This one is generated so
 * the art can be re-tuned without an illustrator — the composition matches the
 * family: a road running to a vanishing point, world scenery either side,
 * the horizon at the same height.
 *
 * Usage: node scripts/worlds/generate-cloud-image.mjs
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = join(root, "public", "images", "worlds");
const outFile = join(outDir, "cloud.jpg");

const W = 1920;
const H = 1288;
/** The horizon line — every world image puts it here. */
const HORIZON = 760;
/** The road's vanishing point. */
const VP = { x: 960, y: HORIZON };

/** A fluffy cloud: overlapping circles, flat white, one soft shadow. */
function puff(cx, cy, scale, opacity = 1) {
  const s = scale;
  const lobes = [
    { x: -1.15, y: 0.18, r: 0.72 },
    { x: -0.5, y: -0.2, r: 0.95 },
    { x: 0.22, y: -0.32, r: 1.05 },
    { x: 0.92, y: -0.05, r: 0.78 },
    { x: 1.35, y: 0.28, r: 0.52 },
  ];
  const circles = lobes
    .map(
      (l) =>
        `<circle cx="${(cx + l.x * s).toFixed(1)}" cy="${(cy + l.y * s).toFixed(1)}" r="${(l.r * s).toFixed(1)}" fill="#ffffff" fill-opacity="${opacity}"/>`,
    )
    .join("");
  const shadow = lobes
    .map(
      (l) =>
        `<circle cx="${(cx + l.x * s).toFixed(1)}" cy="${(cy + l.y * s + s * 0.34).toFixed(1)}" r="${(l.r * s * 0.94).toFixed(1)}" fill="#ffd9ee" fill-opacity="${(0.5 * opacity).toFixed(2)}"/>`,
    )
    .join("");
  return `<g>${shadow}${circles}</g>`;
}

/** Pastel rainbow arc over the horizon. */
function rainbow() {
  const bands = [
    { r: 640, color: "#ffb3e6" },
    { r: 604, color: "#ffe1a8" },
    { r: 568, color: "#bff2c9" },
    { r: 532, color: "#a9ddff" },
    { r: 496, color: "#d5c2ff" },
  ];
  return bands
    .map(
      (b) =>
        `<path d="M ${VP.x - b.r} ${HORIZON + 30} A ${b.r} ${b.r} 0 0 1 ${VP.x + b.r} ${HORIZON + 30}" fill="none" stroke="${b.color}" stroke-width="30" stroke-opacity="0.6" stroke-linecap="round"/>`,
    )
    .join("");
}

/** A tiny kawaii sparkle. */
function sparkle(x, y, r, color = "#ffffff", opacity = 0.9) {
  return `<path d="M ${x} ${y - r} Q ${x + r * 0.22} ${y - r * 0.22} ${x + r} ${y} Q ${x + r * 0.22} ${y + r * 0.22} ${x} ${y + r} Q ${x - r * 0.22} ${y + r * 0.22} ${x - r} ${y} Q ${x - r * 0.22} ${y - r * 0.22} ${x} ${y - r} Z" fill="${color}" fill-opacity="${opacity}"/>`;
}

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#a9dcff"/>
      <stop offset="42%" stop-color="#d7ecff"/>
      <stop offset="78%" stop-color="#ffe6f4"/>
      <stop offset="100%" stop-color="#fff3fa"/>
    </linearGradient>
    <radialGradient id="sunGlow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#fff8e2" stop-opacity="1"/>
      <stop offset="45%" stop-color="#fff2c8" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fffdfe"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ece2ff"/>
      <stop offset="55%" stop-color="#f7e8fb"/>
      <stop offset="100%" stop-color="#ffe4f3"/>
    </linearGradient>
    <filter id="soften" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="26"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#sky)"/>

  <!-- soft sun -->
  <circle cx="1430" cy="210" r="240" fill="url(#sunGlow)"/>
  <circle cx="1430" cy="210" r="72" fill="#fffaf0" fill-opacity="0.95"/>

  ${rainbow()}

  <!-- far cloud bank along the horizon -->
  ${puff(240, HORIZON - 34, 118, 0.92)}
  ${puff(520, HORIZON - 18, 84, 0.88)}
  ${puff(1680, HORIZON - 30, 132, 0.92)}
  ${puff(1380, HORIZON - 12, 78, 0.85)}

  <!-- mid clouds -->
  ${puff(310, 430, 150, 0.97)}
  ${puff(1620, 350, 190, 0.97)}
  ${puff(900, 250, 120, 0.9)}

  <!-- the cloud sea the road floats over -->
  <path d="M 0 ${HORIZON - 26} Q 240 ${HORIZON - 74} 480 ${HORIZON - 30} T 960 ${HORIZON - 44} T 1440 ${HORIZON - 24} T ${W} ${HORIZON - 40} L ${W} ${H} L 0 ${H} Z" fill="url(#sea)"/>
  <!-- a soft cool shadow under the cloud bank so the road has something to
       sit against instead of dissolving into the white -->
  <path d="M 0 ${HORIZON - 26} Q 240 ${HORIZON - 74} 480 ${HORIZON - 30} T 960 ${HORIZON - 44} T 1440 ${HORIZON - 24} T ${W} ${HORIZON - 40} L ${W} ${HORIZON + 110} L 0 ${HORIZON + 110} Z" fill="#cbb8ef" fill-opacity="0.38" filter="url(#soften)"/>
  ${puff(120, HORIZON + 120, 190, 1)}
  ${puff(1780, HORIZON + 150, 220, 1)}
  ${puff(560, HORIZON + 210, 130, 0.95)}
  ${puff(1400, HORIZON + 230, 150, 0.95)}

  <!-- the road: a shadow on the cloud sea, the ribbon, then its edges -->
  <path d="M ${VP.x - 118} ${VP.y + 8} L ${VP.x + 118} ${VP.y + 8} L 1668 ${H} L 272 ${H} Z" fill="#cbb8ef" fill-opacity="0.45"/>
  <path d="M ${VP.x - 110} ${VP.y} L ${VP.x + 110} ${VP.y} L 1640 ${H} L 300 ${H} Z" fill="url(#road)"/>
  <path d="M ${VP.x - 110} ${VP.y} L ${VP.x - 88} ${VP.y} L 318 ${H} L 236 ${H} Z" fill="#ff8fd0" fill-opacity="0.95"/>
  <path d="M ${VP.x + 110} ${VP.y} L ${VP.x + 88} ${VP.y} L 1702 ${H} L 1620 ${H} Z" fill="#ff8fd0" fill-opacity="0.95"/>
  <g fill="#ff8fd0" fill-opacity="0.85">
    <rect x="955" y="800" width="11" height="26" rx="5"/>
    <rect x="949" y="862" width="23" height="46" rx="9"/>
    <rect x="941" y="958" width="38" height="74" rx="14"/>
    <rect x="931" y="1086" width="58" height="104" rx="20"/>
  </g>

  <!-- foreground puffs framing the shot — kept off the road so the white
       ribbon reads against the lavender cloud sea -->
  ${puff(120, 1180, 220, 1)}
  ${puff(1840, 1210, 240, 1)}
  ${puff(300, 1240, 150, 0.96)}
  ${puff(1660, 1250, 165, 0.96)}

  <!-- little puffs drifting on the cloud sea -->
  ${puff(520, 960, 74, 0.9)}
  ${puff(1420, 900, 62, 0.88)}
  ${puff(760, 1060, 52, 0.85)}

  <!-- sparkles -->
  ${sparkle(640, 300, 22, "#ffffff", 0.85)}
  ${sparkle(1210, 430, 16, "#fff4fb", 0.9)}
  ${sparkle(300, 640, 14, "#ffffff", 0.8)}
  ${sparkle(1660, 560, 18, "#fff4fb", 0.85)}
  ${sparkle(980, 180, 13, "#ffffff", 0.75)}
</svg>`;

await mkdir(outDir, { recursive: true });
await sharp(Buffer.from(svg)).jpeg({ quality: 88, mozjpeg: true }).toFile(outFile);
console.log(`wrote ${outFile}`);
