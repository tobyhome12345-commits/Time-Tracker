import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Timer as TimerIcon } from 'lucide-react';
import { useAppData } from '../data/store';
import type { Entry, Kind } from '../data/types';
import { findCategory, KIND_EMOJI, KIND_LABEL } from '../data/categories';
import { Ring } from '../components/Ring';
import { GoalBar } from '../components/Progress';
import { addDays, dailyTotals, dayKey, entriesOnDay, fmtDayLong, fmtDur, fmtTime, MIN, relativeDayName, startOfDay, totalsFor } from '../logic/time';
import { LogSheet } from './LogSheet';
import { TimerCard } from './TimerCard';
import { tap } from '../native/platform';

interface Props {
  dayTs: number;
  setDayTs: (ts: number) => void;
  hero?: React.ReactNode;
}

export function TodayScreen({ dayTs, setDayTs, hero }: Props) {
  const data = useAppData();
  const { settings } = data;
  const [sheet, setSheet] = useState<{ kind: Kind; entry?: Entry } | null>(null);
  const today = startOfDay(Date.now());
  const isToday = dayTs === today;

  const totals = useMemo(() => totalsFor(dailyTotals(data.entries), dayKey(dayTs)), [data.entries, dayTs]);
  const list = useMemo(() => entriesOnDay(data.entries, dayTs).slice().reverse(), [data.entries, dayTs]);

  const diff = totals.outside - totals.inside;
  let verdict: string;
  if (!totals.inside && !totals.outside) verdict = isToday ? 'Nothing logged yet today. Let’s go! 🌱' : 'Nothing logged on this day.';
  else if (diff > 0) verdict = `Outside is winning by ${fmtDur(diff)}! 🌞`;
  else if (diff === 0) verdict = 'Perfectly balanced ⚖️';
  else verdict = `Inside is ahead by ${fmtDur(-diff)}.${isToday ? ' Fresh air time? 🌳' : ''}`;

  const go = (n: number) => {
    tap();
    setDayTs(addDays(dayTs, n));
  };

  return (
    <main className="screen" aria-label="Today">
      <div className="screen-head">
        <div style={{ minWidth: 0 }}>
          <p className="screen-sub">{fmtDayLong(dayTs)}</p>
          <h1 className="screen-title">{relativeDayName(dayTs)}</h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {!isToday && (
            <button className="btn btn-soft today-jump" onClick={() => setDayTs(today)}>
              Today
            </button>
          )}
          <button className="icon-btn" onClick={() => go(-1)} aria-label="Previous day">
            <ChevronLeft size={22} />
          </button>
          <button className="icon-btn" onClick={() => go(1)} disabled={isToday} aria-label="Next day">
            <ChevronRight size={22} />
          </button>
        </div>
      </div>

      <div className="stack">
        {isToday && data.timer && <TimerCard onEdit={(e) => setSheet({ kind: e.kind, entry: e })} />}
        <section className="card hero-card" aria-label="Inside vs outside">
          <div className="hero-ring">
            <Ring outside={totals.outside} inside={totals.inside} />
          </div>
          <div className="hero-side">
            <div className="legend-row">
              <span className="legend-dot" style={{ background: 'var(--outside)' }} />
              <div>
                <div className="legend-label">Outside</div>
                <div className="legend-val tnum">{fmtDur(totals.outside)}</div>
              </div>
            </div>
            <div className="legend-row">
              <span className="legend-dot" style={{ background: 'var(--inside)' }} />
              <div>
                <div className="legend-label">Inside</div>
                <div className="legend-val tnum">{fmtDur(totals.inside)}</div>
              </div>
            </div>
          </div>
          <p className="hero-verdict">{verdict}</p>
          {hero}
        </section>

        <section className="card goals-card" aria-label="Goals">
          <GoalBar label="Outside goal" icon="🌳" value={totals.outside} target={settings.outsideGoalMin} color="var(--outside)" mode="goal" />
          {settings.insideLimitMin !== null && (
            <GoalBar label="Inside limit" icon="📱" value={totals.inside} target={settings.insideLimitMin} color="var(--inside)" mode="limit" />
          )}
        </section>

        <div className="grid-2">
          {(['inside', 'outside'] as Kind[]).map((k) => (
            <button
              key={k}
              className={`log-btn log-btn-${k}`}
              onClick={() => {
                tap();
                setSheet({ kind: k });
              }}
            >
              <span className="log-btn-top">
                <span className="log-btn-emoji" aria-hidden>
                  {KIND_EMOJI[k]}
                </span>
                <span className="log-btn-plus">
                  <Plus size={20} strokeWidth={3} />
                </span>
              </span>
              <span>
                <span className="log-btn-kicker">Log</span>
                {KIND_LABEL[k]}
              </span>
            </button>
          ))}
        </div>

        {isToday && !data.timer && <TimerCard onEdit={(e) => setSheet({ kind: e.kind, entry: e })} />}

        <h2 className="section-title">{isToday ? 'Today’s logs' : 'Logs'}</h2>
        {list.length === 0 ? (
          <div className="card empty">
            {isToday ? 'Your logs will show up here. Tap Inside or Outside to add one!' : 'No logs. Forgot to log? Tap Inside or Outside above to add one for this day.'}
          </div>
        ) : (
          <ul className="card entry-list" aria-label="Logs">
            {list.map((e) => (
              <EntryRow key={e.id} e={e} onClick={() => setSheet({ kind: e.kind, entry: e })} />
            ))}
          </ul>
        )}
      </div>

      {sheet && <LogSheet kind={sheet.kind} entry={sheet.entry} dayTs={dayTs} onClose={() => setSheet(null)} />}
    </main>
  );
}

export function EntryRow({ e, onClick }: { e: Entry; onClick: () => void }) {
  const cat = findCategory(e.kind, e.category);
  const end = e.start + e.minutes * MIN;
  return (
    <li>
      <button className="entry-row" onClick={onClick}>
        <span className={`entry-icon entry-icon-${e.kind}`} aria-hidden>
          {cat?.emoji ?? KIND_EMOJI[e.kind]}
        </span>
        <span className="entry-main">
          <span className="entry-title">
            {cat?.label ?? KIND_LABEL[e.kind]}
            {e.source === 'timer' && <TimerIcon size={14} className="entry-timer" aria-label="from timer" />}
          </span>
          <span className="entry-sub">
            {fmtTime(e.start)} – {fmtTime(end)}
            {e.note ? ` · ${e.note}` : ''}
          </span>
        </span>
        <span className={`entry-dur tnum entry-dur-${e.kind}`}>{fmtDur(e.minutes)}</span>
      </button>
    </li>
  );
}
