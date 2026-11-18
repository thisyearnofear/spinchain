// Sunset Ride world card: dusk-blue sky into amber horizon, a low fixed
// sun the rider rides into, drifting cloud bands, treeline silhouettes.
import sharp from "sharp";
const W = 1200, H = 900;
const trees = Array.from({length: 26}, (_, i) => {
  const w = 34 + (i * 29) % 30, h = 70 + ((i * 83) % 170);
  const x = (i * 47) % W, y = H - h;
  return `<polygon points="${x},${H} ${x + w / 2},${y} ${x + w},${H}" fill="#241a33"/>`;
}).join("");
const clouds = [
  [300, 300, 340, 26, 0.5], [760, 240, 300, 20, 0.4],
  [560, 420, 420, 30, 0.45], [980, 360, 260, 18, 0.35],
].map(([cx, cy, rx, ry, o]) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#ff9a5c" opacity="${o}"/>`
).join("");
const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2c2454"/>
    <stop offset="0.5" stop-color="#6b4a7a"/>
    <stop offset="0.78" stop-color="#ff8f4d"/>
    <stop offset="1" stop-color="#ffb36b"/>
  </linearGradient>
  <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#ffe9c4"/>
    <stop offset="0.5" stop-color="#ff9a5c"/>
    <stop offset="1" stop-color="#ff9a5c" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<circle cx="600" cy="720" r="230" fill="url(#sun)"/>
<circle cx="600" cy="720" r="70" fill="#ffe9c4"/>
${clouds}
<rect y="${H - 26}" width="${W}" height="26" fill="#241a33"/>
${trees}
</svg>`;
const buf = Buffer.from(svg);
await sharp(buf).jpeg({ quality: 92 }).toFile("public/images/worlds/sunset.jpg");
await sharp(buf).webp({ quality: 88 }).toFile("public/images/worlds/sunset.webp");
console.log("wrote public/images/worlds/sunset.{jpg,webp}");
