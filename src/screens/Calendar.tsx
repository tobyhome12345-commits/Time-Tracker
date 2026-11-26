import type { DayStat } from '../logic/stats';
import { fmtDur } from '../logic/time';

/** Shade level 0–4 by progress toward the day's target (single green hue, light → dark). */
export function shade(d: DayStat): number {
  if (d.minutes <= 0) return 0;
  const r = d.target ? d.minutes / d.target : 1;
  if (r < 0.5) return 1;
  if (r < 1) return 2;
  if (r < 1.5) return 3;
  return 4;
}

const HEAD = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function MonthCalendar({ days, selected, onSelect }: { days: DayStat[]; selected: string | null; onSelect: (key: string) => void }) {
  const lead = (new Date(days[0].ts).getDay() + 6) % 7; // Monday-first
  return (
    <div className="cal">
      <div className="cal-grid" role="grid" aria-label="Month calendar">
        {HEAD.map((h, i) => (
          <div key={`h${i}`} className={`cal-head${i >= 5 ? ' is-weekend' : ''}`} aria-hidden>
            {h}
          </div>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <div key={`b${i}`} />
        ))}
        {days.map((d) => {
          const lvl = d.future ? -1 : shade(d);
          return (
            <button
              key={d.key}
              role="gridcell"
              className={`cal-day lvl-${lvl}${d.hit ? ' is-hit' : ''}${d.isToday ? ' is-today' : ''}${d.key === selected ? ' is-selected' : ''}${d.future ? ' is-future' : ''}`}
              disabled={d.future}
              aria-label={`${new Date(d.ts).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}: ${fmtDur(d.minutes)} outside of ${fmtDur(d.target)}${d.hit ? ', target hit' : ''}${d.rest ? ', rest day' : ''}${d.type === 'holiday' ? ', holiday' : ''}`}
              aria-pressed={d.key === selected}
              onClick={() => onSelect(d.key)}
            >
              <span className="cal-num">{new Date(d.ts).getDate()}</span>
              <span className="cal-mark" aria-hidden>
                {d.rest ? '😴' : d.hit ? '✓' : ''}
              </span>
              {d.type === 'holiday' && (
                <span className="cal-hol" aria-hidden>
                  🏖️
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="cal-legend" aria-hidden>
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <i key={l} className={`cal-swatch lvl-${l}`} />
        ))}
        <span>More</span>
        <span className="cal-legend-sep">✓ target hit</span>
        <span>🏖️ holiday</span>
      </div>
    </div>
  );
}
