// Greenwood (woodland) world card: a road under a closed canopy.
//
// Drawn rather than painted, in the flat-vector idiom the Cloud and Daybreak
// cards already use, and coloured from the woodland palette's own tokens —
// canopy #6f8f4a, land #54703a, haze #c6d1b6, glow #f3dfa8, leaf #d9b56a — so
// the card cannot drift away from what the rider actually gets.
//
// The family composition — road to a vanishing point, scenery either side,
// horizon at 52% — with the light doing the talking: one gap in the canopy,
// shafts falling from it, everything else in shade.
//
// Nothing here is scattered. Trees are placed by hand, because a random crown
// field turned into mush at card size; and the near canopy is drawn *after* the
// shafts, because a shaft visible over the canopy is a polygon on the sky
// rather than light coming through it.
import sharp from "sharp";

const W = 1200;
const H = 900;
const HORIZON = 470;
const VX = 600; // vanishing point

/** Tapered trunk plus three clean crown circles — deliberate, not scattered. */
function tree(x, baseY, h, tone, crown) {
  const w = h * 0.055;
  const top = baseY - h * 0.58;
  const r = h * 0.2;
  return `
    <polygon points="${(x - w).toFixed(1)},${baseY} ${(x + w).toFixed(1)},${baseY} ${(x + w * 0.5).toFixed(1)},${top.toFixed(1)} ${(x - w * 0.5).toFixed(1)},${top.toFixed(1)}" fill="${tone}"/>
    <circle cx="${x.toFixed(1)}" cy="${(top - r * 0.35).toFixed(1)}" r="${r.toFixed(1)}" fill="${crown}"/>
    <circle cx="${(x - r * 0.62).toFixed(1)}" cy="${(top + r * 0.25).toFixed(1)}" r="${(r * 0.72).toFixed(1)}" fill="${crown}"/>
    <circle cx="${(x + r * 0.58).toFixed(1)}" cy="${(top + r * 0.3).toFixed(1)}" r="${(r * 0.66).toFixed(1)}" fill="${crown}"/>`;
}

/** One shaft: narrow at the gap, flaring as it falls, gone by the floor. */
function shaft(x, y, len, width, angle, gradient, opacity) {
  const dx = Math.sin(angle) * len;
  const dy = Math.cos(angle) * len;
  const flare = 2.4;
  const pts = [
    [x - width / 2, y],
    [x + width / 2, y],
    [x + dx + (width * flare) / 2, y + dy],
    [x + dx - (width * flare) / 2, y + dy],
  ]
    .map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");
  return `<polygon points="${pts}" fill="url(#${gradient})" opacity="${opacity}"/>`;
}

/** Scalloped canopy mass hanging from the top edge — the closed roof. */
function canopyBand(y, lobes, fill) {
  return lobes
    .map(([cx, rx, ry]) => `<ellipse cx="${cx}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`)
    .join("");
}

// Litter sits on the road and its edges, biggest nearest the lens. Each leaf
// keeps its own tone and its own lean, because a field of identical ellipses
// reads as gravel.
const LEAF_TONES = ["#d9b56a", "#b7823a", "#c9a35c", "#a97c37"];
const LEAF_LITTER = [
  [352, 834, 6], [404, 812, 5], [296, 856, 7], [456, 874, 6],
  [540, 792, 3], [508, 822, 4.5], [662, 802, 4], [706, 830, 5],
  [748, 862, 7], [806, 884, 7], [656, 858, 6], [586, 876, 6],
  [472, 750, 3], [646, 744, 3], [568, 718, 2.2], [630, 708, 2.2],
  [520, 692, 2], [678, 690, 2], [470, 662, 1.5], [714, 658, 1.5],
]
  .map(([x, y, r], i) => {
    const tone = LEAF_TONES[i % LEAF_TONES.length];
    const lean = (i % 2 === 0 ? 1 : -1) * (8 + (i % 5) * 7);
    return `<ellipse cx="${x}" cy="${y}" rx="${(r * 1.7).toFixed(1)}" ry="${(r * 0.62).toFixed(1)}" fill="${tone}" opacity="0.85" transform="rotate(${lean} ${x} ${y})"/>`;
  })
  .join("");

const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#5b7fa1"/>
    <stop offset="0.38" stop-color="#96b5b3"/>
    <stop offset="0.78" stop-color="#dbe3c5"/>
    <stop offset="1" stop-color="#fbf0d0"/>
  </linearGradient>
  <radialGradient id="gap" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#fffbee" stop-opacity="1"/>
    <stop offset="0.4" stop-color="#ffeec4" stop-opacity="0.55"/>
    <stop offset="1" stop-color="#ffeec4" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="beam0" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff8e2" stop-opacity="0.12"/>
    <stop offset="0.42" stop-color="#fff4cd" stop-opacity="0.55"/>
    <stop offset="0.85" stop-color="#ffedba" stop-opacity="0.12"/>
    <stop offset="1" stop-color="#ffedba" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="beam1" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff3d0" stop-opacity="0.08"/>
    <stop offset="0.5" stop-color="#fff0c4" stop-opacity="0.38"/>
    <stop offset="0.9" stop-color="#ffe9b0" stop-opacity="0.06"/>
    <stop offset="1" stop-color="#ffe9b0" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#78915f"/>
    <stop offset="0.25" stop-color="#486230"/>
    <stop offset="1" stop-color="#26351c"/>
  </linearGradient>
  <linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#cbb083"/>
    <stop offset="0.3" stop-color="#b3935e"/>
    <stop offset="1" stop-color="#8a6c3d"/>
  </linearGradient>
  <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#c6d1b6" stop-opacity="0"/>
    <stop offset="0.45" stop-color="#d3dcc2" stop-opacity="0.5"/>
    <stop offset="1" stop-color="#c6d1b6" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.72">
    <stop offset="0.45" stop-color="#0d1409" stop-opacity="0"/>
    <stop offset="1" stop-color="#0d1409" stop-opacity="0.62"/>
  </radialGradient>
</defs>

<rect width="${W}" height="${H}" fill="url(#sky)"/>
<circle cx="520" cy="200" r="360" fill="url(#gap)"/>

<!-- floor and the road into it -->
<rect y="${HORIZON - 30}" width="${W}" height="${H - HORIZON + 30}" fill="url(#floor)"/>
<polygon points="${VX - 18},${HORIZON} ${VX + 18},${HORIZON} ${VX + 440},${H} ${VX - 440},${H}" fill="url(#road)"/>
<polygon points="${VX - 6},${HORIZON} ${VX + 6},${HORIZON} ${VX + 84},${H} ${VX - 84},${H}" fill="#ddc9a2" opacity="0.28"/>

<!-- far treeline: small, pale, sitting on the horizon -->
<g fill="#a4b99a">
  <polygon points="${VX - 210},${HORIZON + 4} ${VX - 180},${HORIZON - 62} ${VX - 150},${HORIZON + 4}"/>
  <polygon points="${VX - 130},${HORIZON + 4} ${VX - 96},${HORIZON - 44} ${VX - 62},${HORIZON + 4}"/>
  <polygon points="${VX + 74},${HORIZON + 4} ${VX + 108},${HORIZON - 50} ${VX + 142},${HORIZON + 4}"/>
  <polygon points="${VX + 158},${HORIZON + 4} ${VX + 190},${HORIZON - 38} ${VX + 222},${HORIZON + 4}"/>
</g>
<rect y="${HORIZON - 70}" width="${W}" height="150" fill="url(#mist)"/>

<!-- standing timber: far pair, then the two the road runs between -->
${tree(VX - 250, HORIZON + 40, 250, "#7d936f", "#8ba57e")}
${tree(VX + 250, HORIZON + 40, 250, "#7d936f", "#8ba57e")}
${tree(VX - 322, HORIZON + 246, 530, "#2d3f1d", "#3a4f26")}
${tree(VX + 356, HORIZON + 262, 470, "#2d3f1d", "#3a4f26")}

<!-- light: through the gap, in front of the trunks, behind the canopy -->
${shaft(452, 90, 780, 26, 0.62, "beam0", 0.7)}
${shaft(524, 60, 880, 44, 0.56, "beam1", 0.5)}
${shaft(648, 50, 860, 60, 0.5, "beam1", 0.34)}
${shaft(760, 80, 700, 34, 0.44, "beam1", 0.24)}
${shaft(380, 120, 620, 18, 0.7, "beam0", 0.45)}
${shaft(560, 40, 940, 130, 0.54, "beam1", 0.16)}

${LEAF_LITTER}

<!-- the closed roof, over the light it shelters -->
${canopyBand(-30, [
  [40, 190, 150],
  [280, 210, 170],
  [520, 190, 150],
  [760, 220, 180],
  [1000, 200, 160],
  [1210, 180, 150],
], "#16210f")}
${canopyBand(10, [
  [150, 150, 110],
  [400, 170, 120],
  [660, 150, 105],
  [900, 165, 115],
  [1130, 150, 110],
], "#1d2b16")}

<!-- the two trunks the rider passes, at the frame edges -->
<polygon points="52,${H} 104,${H} 90,0 66,0" fill="#131d0d"/>
<polygon points="1100,${H} 1152,${H} 1130,0 1108,0" fill="#131d0d"/>
<polygon points="72,${H} 84,${H} 78,0 72,0" fill="#0a1107" opacity="0.6"/>
<polygon points="1124,${H} 1136,${H} 1120,0 1114,0" fill="#0a1107" opacity="0.6"/>

<rect y="${HORIZON - 50}" width="${W}" height="130" fill="url(#mist)" opacity="0.55"/>
<rect width="${W}" height="${H}" fill="url(#vignette)"/>
</svg>`;

const buf = Buffer.from(svg);
await sharp(buf).jpeg({ quality: 92 }).toFile("public/images/worlds/woodland.jpg");
await sharp(buf).webp({ quality: 88 }).toFile("public/images/worlds/woodland.webp");
console.log("wrote public/images/worlds/woodland.{jpg,webp}");
