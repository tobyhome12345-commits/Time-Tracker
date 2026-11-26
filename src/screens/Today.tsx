import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Timer as TimerIcon } from 'lucide-react';
import { setRestDay, useAppData } from '../data/store';
import type { Entry } from '../data/types';
import { findCategory, OUTSIDE_EMOJI } from '../data/categories';
import { Ring } from '../components/Ring';
import { Sheet } from '../components/Sheet';
import { showToast } from '../components/toast';
import { addDays, dayKey, entriesOnDay, fmtDayLong, fmtDur, fmtTime, MIN, relativeDayName, startOfDay } from '../logic/time';
import { DAY_TYPE_EMOJI, DAY_TYPE_LABEL, dayInfo, REST_DAYS_PER_WEEK, restDaysLeft, type DayInfo, type LedgerRow } from '../logic/xp';
import { useDerived } from '../logic/useProgress';
import { LogSheet } from './LogSheet';
import { TimerCard, useNow } from './TimerCard';
import { PipCard } from './PipCard';
import { ChallengeCard } from './ChallengeCard';
import { tap } from '../native/platform';

interface Props {
  dayTs: number;
  setDayTs: (ts: number) => void;
  onOpenPip: () => void;
}

export function TodayScreen({ dayTs, setDayTs, onOpenPip }: Props) {
  const data = useAppData();
  const { map, ledger, challenge } = useDerived();
  const [sheet, setSheet] = useState<{ entry?: Entry } | null>(null);
  const [restSheet, setRestSheet] = useState(false);
  const today = startOfDay(Date.now());
  const isToday = dayTs === today;
  const key = dayKey(dayTs);
  const row = ledger.rows.find((r) => r.info.key === key);
  const info: DayInfo = row?.info ?? dayInfo(data, key);
  const saved = Math.round(map.get(key) ?? 0);

  // Live minutes include a running timer (today only)
  const now = useNow(isToday && !!data.timer, 15_000);
  const timerMins = isToday && data.timer ? Math.max(0, Math.floor((now - data.timer.startedAt) / 60000)) : 0;
  const minutes = saved + timerMins;

  const list = useMemo(() => entriesOnDay(data.entries, dayTs).slice().reverse(), [data.entries, dayTs]);
  const restLeft = restDaysLeft(data.restDays, key);
  const restUsed = restLeft === 0;
  const canRest = !!row && !info.rest && !row.hit && !restUsed;

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
        <DayChip info={info} />
        {isToday && data.timer && <TimerCard onEdit={(e) => setSheet({ entry: e })} todayMinutes={saved} target={info.target} rest={info.rest} />}
        {row && <PipCard ledger={ledger} row={row} level={ledger.level.level} stage={ledger.level.stage} onOpen={onOpenPip} />}

        <section className="card hero-card" aria-label="Outside time">
          <div className="hero-ring">
            <Ring minutes={minutes} target={info.target} rest={info.rest} />
          </div>
          <XpStatus row={row} minutes={minutes} timerMins={timerMins} atRisk={isToday ? ledger.atRisk : 0} />
        </section>

        <button
          className="log-btn log-btn-outside log-btn-wide"
          onClick={() => {
            tap();
            setSheet({});
          }}
        >
          <span className="log-btn-emoji" aria-hidden>
            {OUTSIDE_EMOJI}
          </span>
          <span className="log-btn-text">
            <span className="log-btn-kicker">{isToday ? 'Been outside?' : 'Forgot to log?'}</span>
            Log outside time
          </span>
          <span className="log-btn-plus">
            <Plus size={22} strokeWidth={3} />
          </span>
        </button>

        {isToday && !data.timer && <TimerCard onEdit={(e) => setSheet({ entry: e })} todayMinutes={saved} target={info.target} rest={info.rest} />}

        {isToday && <ChallengeCard challenge={challenge} />}

        <h2 className="section-title">{isToday ? 'Today’s outdoor time' : 'Outdoor time'}</h2>
        {list.length === 0 ? (
          <div className="card empty">{isToday ? 'Nothing yet. Tap “Log outside time” or start the timer! 🌳' : 'Nothing logged. Forgot? Tap “Log outside time” to add it for this day.'}</div>
        ) : (
          <ul className="card entry-list" aria-label="Logs">
            {list.map((e) => (
              <EntryRow key={e.id} e={e} onClick={() => setSheet({ entry: e })} />
            ))}
          </ul>
        )}

        {row && (info.rest || canRest) && (
          <button
            className="rest-link"
            onClick={() => {
              tap();
              if (info.rest) {
                setRestDay(key, false);
                showToast({ msg: 'Rest day removed' });
              } else setRestSheet(true);
            }}
          >
            {info.rest ? '😴 This is a rest day. Tap to undo' : `🤒 Feeling ill or really busy? Use a rest day (${restLeft} left this week)`}
          </button>
        )}
        {row && !info.rest && !row.hit && restUsed && <p className="rest-note">Both rest days used this week.</p>}
      </div>

      {sheet && <LogSheet entry={sheet.entry} dayTs={dayTs} onClose={() => setSheet(null)} />}
      {restSheet && (
        <Sheet title="Use a rest day?" onClose={() => setRestSheet(false)}>
          <p className="import-summary">
            Make <b>{relativeDayName(dayTs).toLowerCase() === 'today' ? 'today' : fmtDayLong(dayTs)}</b> a rest day: you won’t lose any XP and your streak stays safe 💤
          </p>
          <p className="settings-note">
            You get {REST_DAYS_PER_WEEK} rest days per week (Monday to Sunday), and you have {restLeft} left this week. Use them when you’re ill or really busy.
          </p>
          <div className="stack" style={{ gap: 10, marginTop: 16 }}>
            <button
              className="btn btn-primary btn-block"
              onClick={() => {
                if (setRestDay(key, true)) showToast({ msg: 'Rest day set. Get well soon! 💤' });
                setRestSheet(false);
              }}
            >
              😴 Yes, make it a rest day
            </button>
            <button className="btn btn-soft btn-block" onClick={() => setRestSheet(false)}>
              No, I’ll get outside
            </button>
          </div>
        </Sheet>
      )}
    </main>
  );
}

function DayChip({ info }: { info: DayInfo }) {
  if (info.rest) return <div className="day-chip day-chip-rest">😴 Rest day · no target</div>;
  const name = info.type === 'holiday' ? info.holiday?.name ?? 'Holiday' : DAY_TYPE_LABEL[info.type];
  return (
    <div className={`day-chip day-chip-${info.type}`}>
      <span aria-hidden>{DAY_TYPE_EMOJI[info.type]}</span> {name} · target <b>{fmtDur(info.target)}</b>
    </div>
  );
}

function XpStatus({ row, minutes, timerMins, atRisk }: { row?: LedgerRow; minutes: number; timerMins: number; atRisk: number }) {
  if (!row) {
    return (
      <div className="xp-status">
        <div className="xp-big muted">No XP</div>
        <p className="xp-sub">This day is before XP tracking started. It still counts for stats.</p>
      </div>
    );
  }
  if (row.info.rest) {
    return (
      <div className="xp-status">
        <div className="xp-big">±0 XP</div>
        <p className="xp-sub">Rest day. No XP lost, streak safe 💤</p>
      </div>
    );
  }
  if (row.hit) {
    return (
      <div className="xp-status">
        <div className="xp-big xp-gain tnum">+{row.xp} XP</div>
        <ul className="xp-parts">
          {row.parts.map((p, i) => (
            <li key={i}>
              <span>{p.kind === 'target' ? '🎯 Target' : p.kind === 'extra' ? '⏱️ Extra time' : p.kind === 'streak' ? '🔥 Streak' : '🏆 Challenge'}</span>
              <b className="tnum">+{p.xp}</b>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (row.pending) {
    const toGo = Math.max(0, row.info.target - minutes);
    if (toGo === 0 && timerMins > 0) {
      return (
        <div className="xp-status">
          <div className="xp-big xp-gain">Target reached!</div>
          <p className="xp-sub">Stop the timer to bank your XP 🎉</p>
        </div>
      );
    }
    return (
      <div className="xp-status">
        <div className="xp-big tnum">{fmtDur(toGo)}</div>
        <p className="xp-sub">to go</p>
        {atRisk > 0 && <div className="xp-risk tnum">⚠️ −{Math.min(atRisk, toGo)} XP at risk tonight</div>}
        <p className="xp-hint">Hit it for +25 XP plus your streak bonus</p>
      </div>
    );
  }
  return (
    <div className="xp-status">
      <div className="xp-big xp-loss tnum">{row.xp} XP</div>
      <p className="xp-sub">Missed the target by {fmtDur(row.info.target - row.minutes)}</p>
    </div>
  );
}

export function EntryRow({ e, onClick }: { e: Entry; onClick: () => void }) {
  const cat = findCategory(e.category);
  const end = e.start + e.minutes * MIN;
  return (
    <li>
      <button className="entry-row" onClick={onClick}>
        <span className="entry-icon" aria-hidden>
          {cat?.emoji ?? OUTSIDE_EMOJI}
        </span>
        <span className="entry-main">
          <span className="entry-title">
            {cat?.label ?? 'Outside'}
            {e.source === 'timer' && <TimerIcon size={14} className="entry-timer" aria-label="from timer" />}
          </span>
          <span className="entry-sub">
            {fmtTime(e.start)} – {fmtTime(end)}
            {e.note ? ` · ${e.note}` : ''}
          </span>
        </span>
        <span className="entry-dur tnum">{fmtDur(e.minutes)}</span>
      </button>
    </li>
  );
}
