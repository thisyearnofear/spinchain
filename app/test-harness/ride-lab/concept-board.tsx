"use client";

/**
 * Concept board — a locally drawn schematic of the three spatial studies.
 *
 * This is a labeled spatial sketch for judging composition, NOT finished
 * art and not a promise of assets. Every panel uses the same camera
 * perspective (rider POV + a small side elevation strip) and the same
 * palette, so the differences read as geometry, not styling.
 */

import { useId } from "react";
import styles from "./ride-lab.module.css";

const SKY = "#a8c8ea";
const HORIZON = "#f6c9a0";
const ROAD = "#7a6d92";
const CLOUD = "#efe9f6";
const CLOUD_SHADE = "#b9a8d2";
const RIDER = "#241c33";
const NEON_LINE = "#35e0ff";

interface PanelProps {
  title: string;
  caption: string;
  children: React.ReactNode;
}

function Panel({ title, caption, children }: PanelProps) {
  const gradId = useId();
  return (
    <figure className={styles.conceptPanel}>
      <svg viewBox="0 0 320 210" role="img" aria-label={`${title} — spatial sketch`}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={SKY} />
            <stop offset="0.62" stopColor={HORIZON} />
            <stop offset="1" stopColor={HORIZON} />
          </linearGradient>
        </defs>
        <rect width="320" height="160" fill={`url(#${gradId})`} />
        {/* Side elevation strip — behind the elevation geometry. */}
        <rect y="160" width="320" height="50" fill="#171226" />
        <text x="8" y="172" fill="#8f83ab" fontSize="7" fontFamily="monospace">
          side elevation
        </text>
        {children}
      </svg>
      <figcaption>
        <strong>{title}</strong>
        <span>{caption}</span>
      </figcaption>
    </figure>
  );
}

function RiderGlyph({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke={RIDER} fill="none" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="-3.5" cy="0" r="3" />
      <circle cx="4.5" cy="0" r="3" />
      <path d="M-3.5 0 L0 -4 L4.5 0 M0 -4 L-1 -8 L3 -9 M-1 -8 L-4 -5" />
      <circle cx="3.4" cy="-9.6" r="1.4" fill={RIDER} stroke="none" />
    </g>
  );
}

function CloudBlob({ cx, cy, r, shade = false }: { cx: number; cy: number; r: number; shade?: boolean }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.5} fill={CLOUD} />
      <ellipse cx={cx + r * 0.4} cy={cy - r * 0.2} rx={r * 0.55} ry={r * 0.35} fill={CLOUD} />
      {shade && <ellipse cx={cx} cy={cy + r * 0.28} rx={r * 0.85} ry={r * 0.18} fill={CLOUD_SHADE} opacity="0.7" />}
    </g>
  );
}

export function ConceptBoard() {
  return (
    <div className={styles.conceptBoard} role="region" aria-label="Concept board — spatial sketches of the three studies">
      <p className={styles.conceptNote}>
        Spatial schematics of the three studies — same viewpoint and palette each time.
        This is a spatial sketch, not a preview of finished art.
      </p>
      <div className={styles.conceptGrid}>
        {/* 1 — Open ribbon */}
        <Panel
          title="Open ribbon"
          caption="A thin road above the world. Cloud masses stay below and wide; height, openness and air carry the feeling.">
          {/* rider POV */}
          <path d="M0 96 L160 78 L320 96" stroke={ROAD} strokeWidth="5" fill="none" />
          <path d="M0 99 L160 81 L320 99" stroke={CLOUD_SHADE} strokeWidth="1.6" fill="none" />
          <RiderGlyph x={160} y={80} s={0.9} />
          <CloudBlob cx={30} cy={130} r={26} shade />
          <CloudBlob cx={290} cy={126} r={30} shade />
          <CloudBlob cx={90} cy={146} r={34} shade />
          <CloudBlob cx={230} cy={144} r={36} shade />
          {/* side elevation */}
          <path d="M10 182 L310 182" stroke={ROAD} strokeWidth="3" />
          <RiderGlyph x={160} y={179} s={0.8} />
          <ellipse cx="60" cy="196" rx="34" ry="7" fill={CLOUD} />
          <ellipse cx="250" cy="197" rx="40" ry="8" fill={CLOUD} />
          <ellipse cx="150" cy="200" rx="46" ry="8" fill={CLOUD} />
        </Panel>

        {/* 2 — Passage & reveal */}
        <Panel
          title="Passage &amp; reveal"
          caption="Close banks flank the road for the first half; past the gate line they fall away to an open vista.">
          {/* enclosing banks left/right in near field */}
          <CloudBlob cx={18} cy={84} r={26} shade />
          <CloudBlob cx={302} cy={84} r={26} shade />
          <CloudBlob cx={52} cy={96} r={20} shade />
          <CloudBlob cx={268} cy={96} r={20} shade />
          {/* corridor walls converging to gate */}
          <path d="M60 60 L150 78 M260 60 L170 78" stroke={CLOUD_SHADE} strokeWidth="10" strokeLinecap="round" opacity="0.85" />
          {/* road through the gate, open beyond */}
          <path d="M96 120 L160 82 L224 120" fill="none" stroke={ROAD} strokeWidth="5" />
          <RiderGlyph x={160} y={96} s={0.9} />
          {/* reveal vista: low distant clouds + horizon glow */}
          <ellipse cx="160" cy="76" rx="70" ry="8" fill={HORIZON} opacity="0.9" />
          <CloudBlob cx={120} cy={140} r={24} shade />
          <CloudBlob cx={215} cy={142} r={26} shade />
          {/* gate marker */}
          <path d="M140 60 L180 60" stroke={NEON_LINE} strokeWidth="1.4" strokeDasharray="3 3" />
          {/* side elevation: wall then open */}
          <path d="M10 182 L310 182" stroke={ROAD} strokeWidth="3" />
          <RiderGlyph x={120} y={179} s={0.8} />
          <rect x="30" y="170" width="14" height="16" rx="6" fill={CLOUD} />
          <rect x="60" y="168" width="14" height="18" rx="6" fill={CLOUD} />
          <rect x="90" y="170" width="14" height="16" rx="6" fill={CLOUD} />
          <path d="M150 176 L310 176" stroke={NEON_LINE} strokeWidth="0.8" strokeDasharray="4 3" />
          <text x="160" y="190" fill="#8f83ab" fontSize="7" fontFamily="monospace">enclosure ends → open vista</text>
        </Panel>

        {/* 3 — Landmark journey */}
        <Panel
          title="Landmark journey"
          caption="A cloud arch marks the destination; pass through it and a second, smaller landmark waits further on.">
          {/* big arch ahead */}
          <path d="M96 118 Q160 30 224 118" fill="none" stroke={CLOUD} strokeWidth="16" strokeLinecap="round" />
          <path d="M96 122 Q160 34 224 122" fill="none" stroke={CLOUD_SHADE} strokeWidth="4" strokeLinecap="round" opacity="0.6" />
          {/* smaller arch beyond, offset */}
          <path d="M150 84 Q172 56 194 84" fill="none" stroke={CLOUD} strokeWidth="7" strokeLinecap="round" opacity="0.85" />
          {/* road to the arch */}
          <path d="M60 158 L160 96 L260 158" fill="none" stroke={ROAD} strokeWidth="5" />
          <RiderGlyph x={120} y={128} s={0.9} />
          {/* floating islands under the arch */}
          <ellipse cx="160" cy="140" rx="44" ry="9" fill={CLOUD} />
          <ellipse cx="160" cy="144" rx="38" ry="6" fill={CLOUD_SHADE} opacity="0.7" />
          <CloudBlob cx={36} cy={140} r={24} shade />
          <CloudBlob cx={292} cy={140} r={26} shade />
          {/* side elevation: two gates */}
          <path d="M10 184 L310 184" stroke={ROAD} strokeWidth="3" />
          <RiderGlyph x={70} y={181} s={0.8} />
          <path d="M140 184 Q160 160 180 184" fill="none" stroke={CLOUD} strokeWidth="6" />
          <path d="M232 186 Q244 172 256 186" fill="none" stroke={CLOUD} strokeWidth="4" />
          <text x="140" y="200" fill="#8f83ab" fontSize="7" fontFamily="monospace">arch 1 → arch 2 beyond</text>
        </Panel>
      </div>
    </div>
  );
}
