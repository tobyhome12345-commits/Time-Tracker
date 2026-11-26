import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DayStat } from '../logic/stats';
import { fmtDur, fmtHours } from '../logic/time';

interface Props {
  days: DayStat[];
  mode: 'grouped' | 'mirror';
  goal?: number;
  selected: string | null;
  onSelect: (key: string) => void;
  todayKey: string;
  xLabel: (d: DayStat, i: number) => string | null;
  ariaLabel: string;
}

const STEPS = [15, 30, 60, 120, 180, 240, 360, 480, 720]; // minutes per gridline

function niceScale(max: number, maxTicks: number) {
  const m = Math.max(max, 30);
  const step = STEPS.find((s) => m / s <= maxTicks) ?? 720;
  const top = Math.ceil(m / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 0.1; v += step) ticks.push(v);
  return { top, ticks };
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(340);
  useLayoutEffect(() => {
    if (ref.current) setW(ref.current.clientWidth);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Column path with 4px rounded data-end and a square baseline end. dir=1 grows up, -1 grows down. */
function col(x: number, base: number, w: number, h: number, dir: 1 | -1) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  const tip = base - dir * h;
  if (dir === 1) {
    return `M${x},${base}V${tip + r}Q${x},${tip} ${x + r},${tip}H${x + w - r}Q${x + w},${tip} ${x + w},${tip + r}V${base}Z`;
  }
  return `M${x},${base}V${tip - r}Q${x},${tip} ${x + r},${tip}H${x + w - r}Q${x + w},${tip} ${x + w},${tip - r}V${base}Z`;
}

export function DayChart({ days, mode, goal, selected, onSelect, todayKey, xLabel, ariaLabel }: Props) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const n = days.length;
  const padL = 34;
  const padR = 6;
  const padT = 14;
  const padB = 26;
  const plotW = Math.max(100, width - padL - padR);
  const slot = plotW / n;

  const maxOut = Math.max(0, ...days.map((d) => d.outside));
  const maxIn = Math.max(0, ...days.map((d) => d.inside));

  let height: number;
  let base: number;
  let scaleTop: number;
  let ticks: number[];
  let y: (v: number, dir?: 1 | -1) => number;

  if (mode === 'grouped') {
    height = 210;
    const s = niceScale(Math.max(maxOut, maxIn, goal ?? 0), 4);
    scaleTop = s.top;
    ticks = s.ticks;
    base = height - padB;
    const ph = base - padT;
    y = (v) => base - (v / scaleTop) * ph;
  } else {
    height = 250;
    const s = niceScale(Math.max(maxOut, maxIn, goal ?? 0), 2);
    scaleTop = s.top;
    ticks = s.ticks;
    const half = (height - padT - padB) / 2;
    base = padT + half;
    y = (v, dir = 1) => base - dir * (v / scaleTop) * half;
  }

  const barW =
    mode === 'grouped' ? Math.max(3, Math.min(24, (slot - 10 - 2) / 2)) : Math.max(3, Math.min(24, slot * 0.64));

  return (
    <div ref={wrapRef} className="daychart">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={ariaLabel}>
        {/* gridlines + y ticks */}
        {ticks.map((t) => (
          <g key={`t${t}`}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} className={t === 0 ? 'dc-base' : 'dc-grid'} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="dc-tick">
              {fmtHours(t)}
            </text>
            {mode === 'mirror' && t > 0 && (
              <>
                <line x1={padL} x2={width - padR} y1={y(t, -1)} y2={y(t, -1)} className="dc-grid" />
                <text x={padL - 6} y={y(t, -1) + 4} textAnchor="end" className="dc-tick">
                  {fmtHours(t)}
                </text>
              </>
            )}
          </g>
        ))}

        {/* selected band */}
        {days.map((d, i) =>
          d.key === selected ? (
            <rect key="sel" x={padL + i * slot + 1} y={padT - 8} width={slot - 2} height={height - padT - padB + 12} rx={8} className="dc-sel" />
          ) : null,
        )}

        {/* bars */}
        {days.map((d, i) => {
          const cx = padL + i * slot + slot / 2;
          if (mode === 'grouped') {
            const x0 = cx - barW - 1;
            return (
              <g key={d.key} className={d.future ? 'dc-future' : undefined}>
                <path d={col(x0, base, barW, base - y(d.outside), 1)} fill="var(--outside)" />
                <path d={col(cx + 1, base, barW, base - y(d.inside), 1)} fill="var(--inside)" />
              </g>
            );
          }
          const x0 = cx - barW / 2;
          return (
            <g key={d.key}>
              <path d={col(x0, base - 1, barW, base - 1 - y(d.outside), 1)} fill="var(--outside)" />
              <path d={col(x0, base + 1, barW, y(d.inside, -1) - base - 1, -1)} fill="var(--inside)" />
            </g>
          );
        })}

        {/* goal reference line (outside) */}
        {goal ? (
          <g className="dc-goal">
            <line x1={padL} x2={width - padR} y1={y(goal)} y2={y(goal)} />
            <text x={width - padR} y={y(goal) - 5} textAnchor="end">
              goal {fmtHours(goal)}
            </text>
          </g>
        ) : null}

        {/* x labels */}
        {days.map((d, i) => {
          const label = xLabel(d, i);
          if (!label) return null;
          return (
            <text
              key={`x${d.key}`}
              x={padL + i * slot + slot / 2}
              y={height - 7}
              textAnchor="middle"
              className={`dc-x${d.key === todayKey ? ' is-today' : ''}${d.future ? ' is-future' : ''}`}
            >
              {label}
            </text>
          );
        })}

        {/* hit targets (bigger than the marks) */}
        {days.map((d, i) => (
          <rect
            key={`h${d.key}`}
            x={padL + i * slot}
            y={0}
            width={slot}
            height={height}
            fill="transparent"
            className="dc-hit"
            role="button"
            tabIndex={d.future ? -1 : 0}
            aria-label={`${new Date(d.ts).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}: outside ${fmtDur(d.outside)}, inside ${fmtDur(d.inside)}`}
            aria-pressed={d.key === selected}
            onClick={() => !d.future && onSelect(d.key)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !d.future) {
                e.preventDefault();
                onSelect(d.key);
              }
            }}
          />
        ))}
      </svg>
    </div>
  );
}
