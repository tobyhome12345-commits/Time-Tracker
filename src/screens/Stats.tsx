import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Table2 } from 'lucide-react';
import { useAppData } from '../data/store';
import { DayChart } from '../components/DayChart';
import { periodStart, periodStats, shiftPeriod, type Period, type PeriodStats } from '../logic/stats';
import { addDays, dailyTotals, dayKey, fmtDur, startOfDay } from '../logic/time';
import { tap } from '../native/platform';
import { InsightsView } from './Insights';

type View = Period | 'insights';

export function StatsScreen({ onOpenDay }: { onOpenDay: (ts: number) => void }) {
  const data = useAppData();
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState(() => Date.now());
  const map = useMemo(() => dailyTotals(data.entries), [data.entries]);
  const now = Date.now();

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
      {view === 'insights' ? (
        <InsightsView entries={data.entries} map={map} onOpenDay={onOpenDay} />
      ) : (
        <PeriodView
          key={view}
          stats={periodStats(map, view, anchor, now)}
          goal={data.settings.outsideGoalMin}
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
    const a = new Date(s.start).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    const b = new Date(end).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return `${a} – ${b}`;
  }
  const d = new Date(s.start);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString(undefined, { month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
}

function periodRange(s: PeriodStats) {
  const end = addDays(s.end, -1);
  const a = new Date(s.start).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const b = new Date(end).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${a} – ${b}`;
}

function PeriodView(props: {
  stats: PeriodStats;
  goal: number;
  canGoForward: boolean;
  onShift: (n: number) => void;
  onOpenDay: (ts: number) => void;
}) {
  const { stats: s, goal, canGoForward, onShift, onOpenDay } = props;
  const now = Date.now();
  const todayKey = dayKey(now);
  const defaultSel = s.isCurrent ? todayKey : s.days[s.days.length - 1].key;
  const [selected, setSelected] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const sel = s.days.find((d) => d.key === (selected ?? defaultSel)) ?? null;
  const prevName = s.period === 'week' ? 'last week' : 'last month';
  const compareNote = s.isCurrent ? `vs same point ${prevName}` : `vs ${prevName === 'last week' ? 'the week before' : 'the month before'}`;
  const pct = s.cur.outsidePct;
  const pctDelta = pct !== null && s.prev.outsidePct !== null ? Math.round(pct * 100) - Math.round(s.prev.outsidePct * 100) : null;
  const elapsedDays = s.days.filter((d) => !d.future).length;

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

      <section className="card share-card" aria-label="Outside share">
        <div className="share-top">
          <div>
            <div className="share-label">Time spent outside</div>
            <div className="share-value tnum">{pct === null ? '–' : `${Math.round(pct * 100)}%`}</div>
          </div>
          {pctDelta !== null && <Delta value={pctDelta} unit="pts" upIsGood note={compareNote} />}
        </div>
        <div className="share-bar" aria-hidden>
          {pct !== null ? (
            <>
              {s.cur.outside > 0 && <span style={{ flex: s.cur.outside, background: 'var(--outside)' }} />}
              {s.cur.inside > 0 && <span style={{ flex: s.cur.inside, background: 'var(--inside)' }} />}
            </>
          ) : (
            <span style={{ flex: 1, background: 'var(--surface-2)' }} />
          )}
        </div>
      </section>

      <div className="grid-2">
        <StatTile label="Outside" color="var(--outside)" value={s.cur.outside} prev={s.prev.outside} upIsGood perDay={elapsedDays} note={compareNote} />
        <StatTile label="Inside" color="var(--inside)" value={s.cur.inside} prev={s.prev.inside} upIsGood={false} perDay={elapsedDays} note={compareNote} />
      </div>

      <section className="card chart-card" aria-label="Daily chart">
        <div className="spread chart-head">
          <h2 className="card-title">Day by day</h2>
          <div className="legend">
            <span className="legend-item">
              <i style={{ background: 'var(--outside)' }} /> Outside{s.period === 'month' ? ' ↑' : ''}
            </span>
            <span className="legend-item">
              <i style={{ background: 'var(--inside)' }} /> Inside{s.period === 'month' ? ' ↓' : ''}
            </span>
          </div>
        </div>
        {table ? (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Outside</th>
                <th scope="col">Inside</th>
              </tr>
            </thead>
            <tbody>
              {s.days
                .filter((d) => !d.future)
                .map((d) => (
                  <tr key={d.key} onClick={() => onOpenDay(d.ts)}>
                    <th scope="row">{new Date(d.ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</th>
                    <td className="tnum">{fmtDur(d.outside)}</td>
                    <td className="tnum">{fmtDur(d.inside)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <DayChart
            days={s.days}
            mode={s.period === 'week' ? 'grouped' : 'mirror'}
            goal={goal}
            selected={sel?.key ?? null}
            onSelect={(k) => {
              tap();
              setSelected(k);
            }}
            todayKey={todayKey}
            ariaLabel={`Outside and inside time per day, ${periodTitle(s, now)}`}
            xLabel={(d, i) => {
              const dt = new Date(d.ts);
              if (s.period === 'week') return dt.toLocaleDateString(undefined, { weekday: 'narrow' });
              const day = dt.getDate();
              if (d.key === todayKey) return String(day);
              const todayIdx = s.days.findIndex((x) => x.key === todayKey);
              const nearToday = todayIdx >= 0 && Math.abs(i - todayIdx) <= 2;
              return (day === 1 || (day % 5 === 0 && s.days.length - i > 2)) && !nearToday ? String(day) : null;
            }}
          />
        )}
        {!table && sel && (
          <div className="readout">
            <div className="readout-day">{new Date(sel.ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
            <div className="readout-vals tnum">
              <span>
                <i className="key-line" style={{ background: 'var(--outside)' }} />
                <b>{fmtDur(sel.outside)}</b>
              </span>
              <span>
                <i className="key-line" style={{ background: 'var(--inside)' }} />
                <b>{fmtDur(sel.inside)}</b>
              </span>
            </div>
            <button className="readout-open" onClick={() => onOpenDay(startOfDay(sel.ts))}>
              View <ArrowRight size={16} />
            </button>
          </div>
        )}
        <button className="table-toggle" onClick={() => setTable(!table)} aria-pressed={table}>
          <Table2 size={16} /> {table ? 'Show chart' : 'Show as table'}
        </button>
      </section>

      {s.loggedDays === 0 && <div className="card empty">Nothing logged in this {s.period} yet.</div>}
    </div>
  );
}

function StatTile(props: { label: string; color: string; value: number; prev: number; upIsGood: boolean; perDay: number; note: string }) {
  const d = props.value || props.prev ? props.value - props.prev : null;
  return (
    <section className="card stat-tile">
      <div className="stat-label">
        <i className="legend-swatch" style={{ background: props.color }} /> {props.label}
      </div>
      <div className="stat-value tnum">{fmtDur(props.value)}</div>
      <div className="stat-sub tnum">{fmtDur(props.value / Math.max(1, props.perDay))} / day</div>
      {d !== null && <Delta value={d} unit="min" upIsGood={props.upIsGood} note={props.note} compact />}
    </section>
  );
}

/** Signed change with icon + label (never colour alone). */
export function Delta({ value, unit, upIsGood, note, compact }: { value: number; unit: 'pts' | 'min'; upIsGood: boolean; note: string; compact?: boolean }) {
  const up = value > 0;
  const flat = Math.abs(value) < (unit === 'min' ? 1 : 1);
  const good = flat ? null : up === upIsGood;
  const Icon = flat ? ArrowRight : up ? ArrowUpRight : ArrowDownRight;
  const text = unit === 'pts' ? `${up ? '+' : flat ? '±' : '−'}${Math.abs(value)} pts` : `${up ? '+' : flat ? '±' : '−'}${fmtDur(Math.abs(value))}`;
  return (
    <div className={`delta ${good === null ? 'is-flat' : good ? 'is-good' : 'is-bad'}${compact ? ' is-compact' : ''}`}>
      <span className="delta-val">
        <Icon size={16} strokeWidth={2.75} aria-hidden /> {text}
      </span>
      <span className="delta-note">{note}</span>
    </div>
  );
}
