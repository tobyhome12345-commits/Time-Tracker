import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DayStat } from '../logic/stats';
import { fmtDur, fmtHours } from '../logic/time';

interface Props {
  days: DayStat[];
  selected: string | null;
  onSelect: (key: string) => void;
  ariaLabel: string;
}

const STEPS = [15, 30, 60, 120, 180, 240, 360, 480, 720]; // minutes per gridline

function niceScale(max: number, maxTicks: number) {
  const m = Math.max(max, 60);
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

/** Column with 4px rounded top and a square baseline end. */
function col(x: number, base: number, w: number, h: number) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  const tip = base - h;
  return `M${x},${base}V${tip + r}Q${x},${tip} ${x + r},${tip}H${x + w - r}Q${x + w},${tip} ${x + w},${tip + r}V${base}Z`;
}

/** Week chart: one outside bar per day, a target marker per day (higher on weekends/holidays),
 *  ✓ on days the target was hit, and the day's XP under the axis. */
export function DayChart({ days, selected, onSelect, ariaLabel }: Props) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const n = days.length;
  const padL = 34;
  const padR = 6;
  const padT = 22;
  const padB = 44;
  const height = 236;
  const plotW = Math.max(100, width - padL - padR);
  const slot = plotW / n;
  const { top, ticks } = niceScale(Math.max(...days.map((d) => Math.max(d.minutes, d.rest ? 0 : d.target))), 4);
  const base = height - padB;
  const y = (v: number) => base - (Math.min(v, top) / top) * (base - padT);
  const barW = Math.max(6, Math.min(24, slot * 0.5));

  return (
    <div ref={wrapRef} className="daychart">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={`t${t}`}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} className={t === 0 ? 'dc-base' : 'dc-grid'} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="dc-tick">
              {fmtHours(t)}
            </text>
          </g>
        ))}

        {days.map((d, i) =>
          d.key === selected ? <rect key="sel" x={padL + i * slot + 1} y={padT - 18} width={slot - 2} height={height - padT + 14} rx={10} className="dc-sel" /> : null,
        )}

        {days.map((d, i) => {
          const cx = padL + i * slot + slot / 2;
          const markW = Math.min(slot - 8, barW + 14);
          return (
            <g key={d.key} className={d.future ? 'dc-future' : undefined}>
              <path d={col(cx - barW / 2, base, barW, base - y(d.minutes))} className={d.hit ? 'dc-bar-hit' : 'dc-bar-miss'} />
              {!d.rest && <line x1={cx - markW / 2} x2={cx + markW / 2} y1={y(d.target)} y2={y(d.target)} className="dc-target" />}
              {d.hit && (
                <text x={cx} y={y(Math.max(d.minutes, d.target)) - 6} textAnchor="middle" className="dc-check">
                  ✓
                </text>
              )}
              {d.rest && !d.future && (
                <text x={cx} y={base - 6} textAnchor="middle" className="dc-rest">
                  z
                </text>
              )}
            </g>
          );
        })}

        {days.map((d, i) => {
          const cx = padL + i * slot + slot / 2;
          const xp = d.xp;
          return (
            <g key={`x${d.key}`}>
              <text x={cx} y={height - 24} textAnchor="middle" className={`dc-x${d.isToday ? ' is-today' : ''}${d.future ? ' is-future' : ''}`}>
                {new Date(d.ts).toLocaleDateString(undefined, { weekday: 'narrow' })}
                {d.type === 'holiday' ? '🏖' : ''}
              </text>
              {xp !== null && (
                <text x={cx} y={height - 6} textAnchor="middle" className={`dc-xp ${xp > 0 ? 'is-gain' : xp < 0 ? 'is-loss' : ''}`}>
                  {xp > 0 ? `+${xp}` : xp < 0 ? `−${-xp}` : '0'}
                </text>
              )}
            </g>
          );
        })}

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
            aria-label={`${new Date(d.ts).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}: ${fmtDur(d.minutes)} outside, target ${fmtDur(d.target)}${d.hit ? ', target hit' : ''}${d.xp !== null ? `, ${d.xp} XP` : ''}`}
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
