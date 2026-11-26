import { useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Table2 } from 'lucide-react';
import { useAppData } from '../data/store';
import { DayChart } from '../components/DayChart';
import { periodStart, periodStats, shiftPeriod, type DayStat, type Period, type PeriodStats } from '../logic/stats';
import { addDays, dayKey, fmtDur, startOfDay } from '../logic/time';
import { useDerived } from '../logic/useProgress';
import { tap } from '../native/platform';
import { InsightsView } from './Insights';
import { MonthCalendar } from './Calendar';

type View = Period | 'insights';

export function StatsScreen({ onOpenDay }: { onOpenDay: (ts: number) => void }) {
  const data = useAppData();
  const { map, ledger } = useDerived();
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState(() => Date.now());
  const now = Date.now();
  const stats = view === 'insights' ? null : periodStats(data, map, ledger, view, anchor, now);

  return (
    <main className="screen" aria-label="Stats">
      <div className="screen-head">
        <h1 className="screen-title">Stats</h1>
      </div>
      <div className="segmented stats-tabs" role="tablist">
        {(['week', 'month', 'insights'] as View[]).map((v) => (
          <button
            key={v}
            role="tab"
            aria-pressed={view === v}
            aria-selected={view === v}
            onClick={() => {
              tap();
              if (v !== view) setAnchor(Date.now());
              setView(v);
            }}
          >
            {v === 'week' ? 'Week' : v === 'month' ? 'Month' : 'Insights'}
          </button>
        ))}
      </div>
      {view === 'insights' || !stats ? (
        <InsightsView entries={data.entries} map={map} ledger={ledger} onOpenDay={onOpenDay} />
      ) : (
        <PeriodView
          key={view}
          stats={stats}
          canGoForward={periodStart(view, anchor) < periodStart(view, now)}
          onShift={(n) => {
            tap();
            setAnchor(shiftPeriod(view, periodStart(view, anchor), n));
          }}
          onOpenDay={onOpenDay}
        />
      )}
    </main>
  );
}

function periodTitle(s: PeriodStats, now: number) {
  if (s.period === 'week') {
    const thisWeek = periodStart('week', now);
    if (s.start === thisWeek) return 'This week';
    if (s.start === addDays(thisWeek, -7)) return 'Last week';
    const end = addDays(s.end, -1);
    return `${new Date(s.start).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${new Date(end).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
  }
  const d = new Date(s.start);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString(undefined, { month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
}

function periodRange(s: PeriodStats) {
  const end = addDays(s.end, -1);
  const f = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${f(s.start)} – ${f(end)}`;
}

function PeriodView(props: { stats: PeriodStats; canGoForward: boolean; onShift: (n: number) => void; onOpenDay: (ts: number) => void }) {
  const { stats: s, canGoForward, onShift, onOpenDay } = props;
  const now = Date.now();
  const todayKey = dayKey(now);
  const defaultSel = s.isCurrent ? todayKey : s.days[s.days.length - 1].key;
  const [selected, setSelected] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const sel = s.days.find((d) => d.key === (selected ?? defaultSel)) ?? null;
  const prevName = s.period === 'week' ? 'last week' : 'last month';
  const note = s.isCurrent ? `vs same point ${prevName}` : `vs the ${s.period} before`;
  const elapsed = s.days.filter((d) => !d.future);
  const judged = elapsed.filter((d) => d.tracked && !d.rest && !(d.isToday && !d.hit)).length;

  return (
    <div className="stack" style={{ marginTop: 14 }}>
      <div className="period-nav">
        <button className="icon-btn" onClick={() => onShift(-1)} aria-label={`Previous ${s.period}`}>
          <ChevronLeft size={22} />
        </button>
        <div className="period-label">
          <div className="period-title">{periodTitle(s, now)}</div>
          <div className="period-range">{periodRange(s)}</div>
        </div>
        <button className="icon-btn" onClick={() => onShift(1)} disabled={!canGoForward} aria-label={`Next ${s.period}`}>
          <ChevronRight size={22} />
        </button>
      </div>

      <section className="card share-card" aria-label="Time outside">
        <div className="share-top">
          <div>
            <div className="share-label">Time outside</div>
            <div className="share-value tnum">{fmtDur(s.cur.minutes)}</div>
          </div>
          {(s.cur.minutes || s.prev.minutes) > 0 && <Delta value={s.cur.minutes - s.prev.minutes} unit="min" note={note} />}
        </div>
        <div className="stat-row tnum">
          <span>
            <b>{fmtDur(s.cur.avg)}</b> / day
          </span>
          <span>
            🎯 <b>{s.cur.hits}</b>/{judged || elapsed.length} targets hit
          </span>
        </div>
      </section>

      <div className="grid-2">
        <section className="card stat-tile">
          <div className="stat-label">⭐ XP this {s.period}</div>
          <div className={`stat-value tnum ${s.cur.xp > 0 ? 'xp-gain' : s.cur.xp < 0 ? 'xp-loss' : ''}`}>
            {s.cur.xp > 0 ? '+' : ''}
            {s.cur.xp}
          </div>
          {(s.cur.xp !== 0 || s.prev.xp !== 0) && <Delta value={s.cur.xp - s.prev.xp} unit="xp" note={note} compact />}
        </section>
        <section className="card stat-tile">
          <div className="stat-label">🔥 Best day</div>
          {(() => {
            const best = elapsed.reduce<DayStat | null>((b, d) => (d.minutes > (b?.minutes ?? 0) ? d : b), null);
            return best ? (
              <>
                <div className="stat-value tnum">{fmtDur(best.minutes)}</div>
                <div className="stat-sub">{new Date(best.ts).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric' })}</div>
              </>
            ) : (
              <div className="stat-sub" style={{ marginTop: 8 }}>
                No outdoor time yet
              </div>
            );
          })()}
        </section>
      </div>

      <section className="card chart-card" aria-label={s.period === 'week' ? 'Daily chart' : 'Calendar'}>
        <div className="spread chart-head">
          <h2 className="card-title">{s.period === 'week' ? 'Day by day' : '📅 Calendar'}</h2>
          {s.period === 'week' && (
            <div className="legend">
              <span className="legend-item">
                <i style={{ background: 'var(--outside)' }} /> Hit
              </span>
              <span className="legend-item">
                <i style={{ background: 'var(--miss)' }} /> Missed
              </span>
              <span className="legend-item">
                <i className="legend-target" /> Target
              </span>
            </div>
          )}
        </div>
        {s.period === 'month' ? (
          <MonthCalendar
            days={s.days}
            selected={sel?.key ?? null}
            onSelect={(k) => {
              tap();
              setSelected(k);
            }}
          />
        ) : table ? (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Outside</th>
                <th scope="col">Target</th>
                <th scope="col">XP</th>
              </tr>
            </thead>
            <tbody>
              {elapsed.map((d) => (
                <tr key={d.key} onClick={() => onOpenDay(d.ts)}>
                  <th scope="row">{new Date(d.ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</th>
                  <td className="tnum">{fmtDur(d.minutes)}</td>
                  <td className="tnum">{d.rest ? 'rest' : `${fmtDur(d.target)}${d.hit ? ' ✓' : ''}`}</td>
                  <td className="tnum">{d.xp === null ? '–' : d.xp > 0 ? `+${d.xp}` : d.xp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <DayChart
            days={s.days}
            selected={sel?.key ?? null}
            onSelect={(k) => {
              tap();
              setSelected(k);
            }}
            ariaLabel={`Outside time per day, ${periodTitle(s, now)}`}
          />
        )}
        {!table && sel && <Readout d={sel} onOpen={() => onOpenDay(startOfDay(sel.ts))} />}
        {s.period === 'week' && (
          <button className="table-toggle" onClick={() => setTable(!table)} aria-pressed={table}>
            <Table2 size={16} /> {table ? 'Show chart' : 'Show as table'}
          </button>
        )}
      </section>
    </div>
  );
}

function Readout({ d, onOpen }: { d: DayStat; onOpen: () => void }) {
  return (
    <div className="readout">
      <div className="readout-main">
        <div className="readout-day">
          {new Date(d.ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
          {d.type === 'holiday' ? ` · 🏖️ ${d.holidayName ?? 'Holiday'}` : ''}
        </div>
        <div className="readout-vals tnum">
          <span>
            <b>{fmtDur(d.minutes)}</b> of {d.rest ? 'rest day' : fmtDur(d.target)}
            {d.hit ? ' ✓' : ''}
          </span>
          {d.xp !== null && <span className={d.xp > 0 ? 'xp-gain' : d.xp < 0 ? 'xp-loss' : ''}>{d.xp > 0 ? `+${d.xp}` : d.xp} XP</span>}
          {d.isToday && d.xp === null && !d.rest && <span className="faint">today, in progress</span>}
        </div>
      </div>
      <button className="readout-open" onClick={onOpen}>
        View <ArrowRight size={16} />
      </button>
    </div>
  );
}

/** Signed change with icon + label (never colour alone). Up is good for both minutes and XP. */
export function Delta({ value, unit, note, compact }: { value: number; unit: 'min' | 'xp'; note: string; compact?: boolean }) {
  const flat = Math.abs(value) < 1;
  const up = value > 0;
  const Icon = flat ? ArrowRight : up ? ArrowUpRight : ArrowDownRight;
  const abs = Math.abs(Math.round(value));
  const text = `${up ? '+' : flat ? '±' : '−'}${unit === 'min' ? fmtDur(abs) : `${abs} XP`}`;
  return (
    <div className={`delta ${flat ? 'is-flat' : up ? 'is-good' : 'is-bad'}${compact ? ' is-compact' : ''}`}>
      <span className="delta-val">
        <Icon size={16} strokeWidth={2.75} aria-hidden /> {text}
      </span>
      <span className="delta-note">{note}</span>
    </div>
  );
}
