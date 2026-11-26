import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Entry } from '../data/types';
import { findCategory } from '../data/categories';
import { insights, WEEKDAYS, WEEKDAYS_LONG, type CategoryStat } from '../logic/stats';
import { fmtDur } from '../logic/time';
import type { Ledger } from '../logic/xp';
import { tap } from '../native/platform';

const RANGES: { id: string; label: string; days: number | null }[] = [
  { id: '7', label: '7 days', days: 7 },
  { id: '30', label: '30 days', days: 30 },
  { id: 'all', label: 'All time', days: null },
];

export function InsightsView({ entries, map, ledger, onOpenDay }: { entries: Entry[]; map: Map<string, number>; ledger: Ledger; onOpenDay: (ts: number) => void }) {
  const [range, setRange] = useState('30');
  const r = RANGES.find((x) => x.id === range)!;
  const ins = useMemo(() => insights(entries, map, ledger, r.days), [entries, map, ledger, r.days]);
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

      {ins.totalMinutes === 0 ? (
        <div className="card empty">Log some outdoor time and your insights will appear here ✨</div>
      ) : (
        <>
          <div className="grid-2">
            <section className="card stat-tile">
              <div className="stat-label">🌳 Average</div>
              <div className="stat-value tnum">{fmtDur(ins.avg)}</div>
              <div className="stat-sub">per day</div>
            </section>
            <section className="card stat-tile">
              <div className="stat-label">🎯 Target hit rate</div>
              <div className="stat-value tnum">{ins.hitRate === null ? '–' : `${Math.round(ins.hitRate * 100)}%`}</div>
              <div className="stat-sub">of days</div>
            </section>
          </div>

          <section className="card" aria-label="School days vs weekends">
            <h2 className="card-title">School days vs weekends</h2>
            <div className="vs-bars">
              <VsBar emoji="📚" label="School days" value={ins.weekdayAvg} max={Math.max(ins.weekdayAvg, ins.weekendAvg)} />
              <VsBar emoji="🎉" label="Weekends" value={ins.weekendAvg} max={Math.max(ins.weekdayAvg, ins.weekendAvg)} />
            </div>
            <p className="muted card-sub" style={{ marginBottom: 0 }}>
              Average outside time per day
            </p>
          </section>

          {ins.bestDay && (
            <button className="card insight-row" onClick={() => onOpenDay(ins.bestDay!.ts)}>
              <span className="insight-emoji" aria-hidden>
                🏆
              </span>
              <span className="insight-main">
                <span className="insight-kicker">Best day</span>
                <span className="insight-title">{new Date(ins.bestDay.ts).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                <span className="insight-sub tnum">{fmtDur(ins.bestDay.minutes)} outside</span>
              </span>
              <ChevronRight size={20} className="faint" />
            </button>
          )}

          <div className="grid-2">
            {ins.bestWeek && (
              <section className="card stat-tile">
                <div className="stat-label">📅 Best week</div>
                <div className="stat-value tnum">{fmtDur(ins.bestWeek.minutes)}</div>
                <div className="stat-sub">w/c {new Date(ins.bestWeek.start).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div>
              </section>
            )}
            {ins.longest && (
              <section className="card stat-tile">
                <div className="stat-label">⏱️ Longest outing</div>
                <div className="stat-value tnum">{fmtDur(ins.longest.minutes)}</div>
                <div className="stat-sub">{findCategory(ins.longest.category)?.label ?? 'Outside'}</div>
              </section>
            )}
          </div>

          <CategoryCard cats={ins.categories} />

          {ins.topWeekday !== null && (
            <section className="card">
              <h2 className="card-title">Most outdoorsy day</h2>
              <p className="muted card-sub">
                <b className="text-strong">{WEEKDAYS_LONG[ins.topWeekday]}s</b>, with {fmtDur(ins.weekday[ins.topWeekday])} outside on average 🌞
              </p>
              <WeekdayBars values={ins.weekday} top={ins.topWeekday} />
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

          <p className="about">🌳 {fmtDur(ins.totalMinutes)} outside in this period. Nice one!</p>
        </>
      )}
    </div>
  );
}

function VsBar({ emoji, label, value, max }: { emoji: string; label: string; value: number; max: number }) {
  return (
    <div className="hbar-row">
      <span className="hbar-label">
        <span aria-hidden>{emoji}</span> {label}
      </span>
      <span className="hbar-track">
        <span className="hbar-fill" style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%`, background: 'var(--outside)' }} />
      </span>
      <span className="hbar-val tnum">{fmtDur(value)}</span>
    </div>
  );
}

function CategoryCard({ cats }: { cats: CategoryStat[] }) {
  if (!cats.length) return null;
  const max = Math.max(...cats.map((c) => c.minutes));
  const total = cats.reduce((a, c) => a + c.minutes, 0);
  return (
    <section className="card" aria-label="Top activities">
      <h2 className="card-title">Top activities 🏅</h2>
      <ul className="hbars">
        {cats.slice(0, 6).map((c) => {
          const cat = findCategory(c.id);
          return (
            <li key={c.id || 'none'} className="hbar-row">
              <span className="hbar-label">
                <span aria-hidden>{cat?.emoji ?? '🌳'}</span> {cat?.label ?? 'Just outside'}
              </span>
              <span className="hbar-track">
                <span className="hbar-fill" style={{ width: `${Math.max(2, (c.minutes / max) * 100)}%`, background: 'var(--outside)' }} />
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
