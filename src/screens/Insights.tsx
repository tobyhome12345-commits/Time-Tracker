import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Entry, Kind } from '../data/types';
import { findCategory, KIND_EMOJI, KIND_LABEL } from '../data/categories';
import { insights, WEEKDAYS, WEEKDAYS_LONG, type CategoryStat } from '../logic/stats';
import { fmtDur, type DayTotals } from '../logic/time';
import { tap } from '../native/platform';

const RANGES: { id: string; label: string; days: number | null }[] = [
  { id: '7', label: '7 days', days: 7 },
  { id: '30', label: '30 days', days: 30 },
  { id: 'all', label: 'All time', days: null },
];

export function InsightsView({ entries, map, onOpenDay }: { entries: Entry[]; map: Map<string, DayTotals>; onOpenDay: (ts: number) => void }) {
  const [range, setRange] = useState('30');
  const r = RANGES.find((x) => x.id === range)!;
  const ins = useMemo(() => insights(entries, map, r.days), [entries, map, r.days]);
  const hasData = ins.totalInside + ins.totalOutside > 0;
  const pod = ins.partOfDay;
  const podTotal = pod.morning + pod.afternoon + pod.evening;

  return (
    <div className="stack" style={{ marginTop: 14 }}>
      <div className="chips range-chips" role="radiogroup" aria-label="Time range">
        {RANGES.map((x) => (
          <button
            key={x.id}
            className="chip"
            role="radio"
            aria-checked={range === x.id}
            aria-pressed={range === x.id}
            onClick={() => {
              tap();
              setRange(x.id);
            }}
          >
            {x.label}
          </button>
        ))}
      </div>

      {!hasData ? (
        <div className="card empty">Log a few days and your insights will appear here ✨</div>
      ) : (
        <>
          <div className="grid-2">
            <section className="card stat-tile">
              <div className="stat-label">
                <i className="legend-swatch" style={{ background: 'var(--outside)' }} /> Avg outside
              </div>
              <div className="stat-value tnum">{fmtDur(ins.avgOutside)}</div>
              <div className="stat-sub">per day</div>
            </section>
            <section className="card stat-tile">
              <div className="stat-label">
                <i className="legend-swatch" style={{ background: 'var(--inside)' }} /> Avg inside
              </div>
              <div className="stat-value tnum">{fmtDur(ins.avgInside)}</div>
              <div className="stat-sub">per day</div>
            </section>
          </div>

          {ins.bestDay && (
            <button className="card insight-row" onClick={() => onOpenDay(ins.bestDay!.ts)}>
              <span className="insight-emoji" aria-hidden>
                🏆
              </span>
              <span className="insight-main">
                <span className="insight-kicker">Best outside day</span>
                <span className="insight-title">{new Date(ins.bestDay.ts).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                <span className="insight-sub tnum">{fmtDur(ins.bestDay.outside)} outside</span>
              </span>
              <ChevronRight size={20} className="faint" />
            </button>
          )}

          {ins.bestBalanceDay && (
            <button className="card insight-row" onClick={() => onOpenDay(ins.bestBalanceDay!.ts)}>
              <span className="insight-emoji" aria-hidden>
                ⚖️
              </span>
              <span className="insight-main">
                <span className="insight-kicker">Best balance</span>
                <span className="insight-title">
                  {new Date(ins.bestBalanceDay.ts).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
                </span>
                <span className="insight-sub tnum">{Math.round(ins.bestBalanceDay.pct * 100)}% of your time was outside</span>
              </span>
              <ChevronRight size={20} className="faint" />
            </button>
          )}

          {(['outside', 'inside'] as Kind[]).map((k) => (
            <CategoryCard key={k} kind={k} cats={ins.categories[k]} />
          ))}

          {ins.topWeekday !== null && (
            <section className="card">
              <h2 className="card-title">Most outdoorsy day</h2>
              <p className="muted card-sub">
                <b className="text-strong">{WEEKDAYS_LONG[ins.topWeekday]}s</b>, with {fmtDur(ins.weekday[ins.topWeekday].outside)} outside on average 🌞
              </p>
              <WeekdayBars values={ins.weekday.map((w) => w.outside)} top={ins.topWeekday} />
            </section>
          )}

          {podTotal > 0 && (
            <section className="card">
              <h2 className="card-title">When you head outside</h2>
              <div className="pod-grid">
                {(
                  [
                    ['🌅', 'Morning', pod.morning],
                    ['☀️', 'Afternoon', pod.afternoon],
                    ['🌙', 'Evening', pod.evening],
                  ] as const
                ).map(([emoji, label, v]) => (
                  <div key={label} className="pod-cell">
                    <span className="pod-emoji" aria-hidden>
                      {emoji}
                    </span>
                    <span className="pod-pct tnum">{Math.round((v / podTotal) * 100)}%</span>
                    <span className="pod-label">{label}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function CategoryCard({ kind, cats }: { kind: Kind; cats: CategoryStat[] }) {
  if (!cats.length) return null;
  const max = Math.max(...cats.map((c) => c.minutes));
  const total = cats.reduce((a, c) => a + c.minutes, 0);
  return (
    <section className="card" aria-label={`Top ${kind} activities`}>
      <h2 className="card-title">
        Top {kind} activities {KIND_EMOJI[kind]}
      </h2>
      <ul className="hbars">
        {cats.slice(0, 5).map((c) => {
          const cat = findCategory(kind, c.id);
          return (
            <li key={c.id || 'none'} className="hbar-row">
              <span className="hbar-label">
                <span aria-hidden>{cat?.emoji ?? '•'}</span> {cat?.label ?? `Other ${KIND_LABEL[kind].toLowerCase()}`}
              </span>
              <span className="hbar-track">
                <span className="hbar-fill" style={{ width: `${Math.max(2, (c.minutes / max) * 100)}%`, background: `var(--${kind})` }} />
              </span>
              <span className="hbar-val tnum">
                {fmtDur(c.minutes)}
                <small>
                  {Math.round((c.minutes / total) * 100)}% · {c.count}×
                </small>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function WeekdayBars({ values, top }: { values: number[]; top: number }) {
  const max = Math.max(1, ...values);
  return (
    <div className="wd-bars" role="list">
      {values.map((v, i) => (
        <div key={i} className="wd-col" role="listitem" aria-label={`${WEEKDAYS_LONG[i]}: ${fmtDur(v)} outside on average`}>
          <span className="wd-val tnum">{v >= 1 ? fmtDur(v) : ''}</span>
          <span className="wd-track">
            <span className={`wd-fill${i === top ? ' is-top' : ''}`} style={{ height: `${(v / max) * 100}%` }} />
          </span>
          <span className="wd-day">{WEEKDAYS[i][0]}</span>
        </div>
      ))}
    </div>
  );
}
