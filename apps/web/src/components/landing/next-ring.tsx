'use client';

import { useState } from 'react';
import type { Showcase } from '@/lib/showcase';
import { cn } from '@/lib/utils';

const COLORS = ['#f97316', '#e879f9', '#38bdf8'];

/**
 * The idea in one picture: the artist at the center, the core fans' taste around it, and the
 * next ring of audiences on the outside (from the live demo brief).
 */
export function NextRing({
  artist,
  tags,
  segments,
}: {
  artist: string;
  tags: string[];
  segments: Showcase['segments'];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const R1 = 92;
  const R2 = 150;
  const at = (r: number, i: number, n: number, offset = -90) => {
    const a = ((offset + (360 / n) * i) * Math.PI) / 180;
    return { x: 200 + r * Math.cos(a), y: 175 + r * Math.sin(a) };
  };
  const focus = hover !== null ? segments[hover] : undefined;

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-center">
      <svg
        viewBox="0 0 400 350"
        className="w-full"
        role="img"
        aria-label={`The next ring of fans around ${artist}`}
      >
        <circle
          cx="200"
          cy="175"
          r={R2}
          fill="none"
          stroke="white"
          strokeOpacity="0.15"
          strokeDasharray="4 6"
          className="origin-center animate-[spin_60s_linear_infinite] [transform-box:fill-box]"
        />
        <circle cx="200" cy="175" r={R1} fill="none" stroke="white" strokeOpacity="0.2" />
        {/* core taste */}
        {tags.map((t, i) => {
          const p = at(R1, i, tags.length, -60);
          return (
            <g key={t}>
              <rect
                x={p.x - 34}
                y={p.y - 11}
                width="68"
                height="22"
                rx="11"
                fill="white"
                fillOpacity="0.1"
                stroke="white"
                strokeOpacity="0.2"
              />
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fontSize="11"
                fill="white"
                fillOpacity="0.85"
              >
                {t.length > 11 ? `${t.slice(0, 10)}…` : t}
              </text>
            </g>
          );
        })}
        {/* the next ring */}
        {segments.map((s, i) => {
          const p = at(R2, i, segments.length, -30);
          const on = hover === null || hover === i;
          return (
            <g key={s.id} opacity={on ? 1 : 0.35}>
              <line
                x1="200"
                y1="175"
                x2={p.x}
                y2={p.y}
                stroke={COLORS[i]}
                strokeOpacity="0.5"
                strokeDasharray="3 4"
              />
              <circle
                cx={p.x}
                cy={p.y}
                r="30"
                fill={COLORS[i]}
                fillOpacity="0.2"
                stroke={COLORS[i]}
                strokeWidth="2"
                className="animate-pulse"
              />
              <circle cx={p.x} cy={p.y} r="7" fill={COLORS[i]} />
            </g>
          );
        })}
        {/* the artist */}
        <circle cx="200" cy="175" r="44" fill="url(#core)" />
        <defs>
          <radialGradient id="core">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#c026d3" />
          </radialGradient>
        </defs>
        <text x="200" y="171" textAnchor="middle" fontSize="12" fontWeight="700" fill="white">
          {artist.length > 14 ? `${artist.slice(0, 13)}…` : artist}
        </text>
        <text x="200" y="187" textAnchor="middle" fontSize="9" fill="white" fillOpacity="0.8">
          core fans
        </text>
      </svg>
      <ul className="grid gap-2">
        {segments.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className={cn(
                'w-full rounded-xl p-3 text-left ring-1 transition-colors',
                hover === i ? 'bg-white/10 ring-white/30' : 'bg-white/[0.04] ring-white/10',
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span className="size-2.5 rounded-full" style={{ background: COLORS[i] }} />
                {s.name}
              </span>
              <span className="mt-0.5 block truncate text-xs text-white/60">
                Fans of {s.fansOf.join(', ')}
              </span>
            </button>
          </li>
        ))}
        <li className="px-1 text-xs text-white/50">
          {focus
            ? `${focus.name}: new buyers who don’t follow ${artist} yet.`
            : 'Hover a ring: each is an audience you’re not reaching yet.'}
        </li>
      </ul>
    </div>
  );
}
