// Night to Day world card: dusk-to-dawn gradient, sun climbing, city skyline.
import sharp from "sharp";
const W = 1200, H = 900;
const buildings = Array.from({length: 22}, (_, i) => {
  const w = 40 + (i * 37) % 50, h = 90 + ((i * 91) % 260);
  const x = (i * 61) % W, y = H - h;
  const win = Array.from({length: 6}, (_, k) =>
    `<rect x="${x + 8 + (k % 3) * 14}" y="${y + 14 + Math.floor(k / 3) * 18}" width="6" height="9" fill="#ffd9a0" opacity="0.85"/>`
  ).join("");
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#1c1840"/>${win}`;
}).join("");
const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1a1f4d"/>
    <stop offset="0.55" stop-color="#5a4a8a"/>
    <stop offset="0.8" stop-color="#ff9a5c"/>
    <stop offset="1" stop-color="#ffe0b8"/>
  </linearGradient>
  <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#fff3d6"/>
    <stop offset="0.55" stop-color="#ffc27a"/>
    <stop offset="1" stop-color="#ffc27a" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<circle cx="680" cy="560" r="190" fill="url(#sun)"/>
<circle cx="680" cy="560" r="62" fill="#fff3d6"/>
${buildings}
</svg>`;
const buf = Buffer.from(svg);
await sharp(buf).jpeg({ quality: 92 }).toFile("public/images/worlds/daybreak.jpg");
await sharp(buf).webp({ quality: 88 }).toFile("public/images/worlds/daybreak.webp");
console.log("wrote public/images/worlds/daybreak.{jpg,webp}");
