import { useEffect, useState } from 'react';
import { Play, Square, X } from 'lucide-react';
import { cancelTimer, startTimer, stopTimer, updateTimer, useAppData } from '../data/store';
import type { Entry } from '../data/types';
import { CATEGORIES } from '../data/categories';
import { fmtClock, fmtDur, fmtTime } from '../logic/time';
import { showToast } from '../components/toast';
import { celebrate, tap } from '../native/platform';

/** Re-render every second while mounted. */
export function useNow(active: boolean, every = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [active, every]);
  return now;
}

interface Props {
  onEdit?: (e: Entry) => void;
  /** Saved outside minutes today + today's target (for the live "to go" line) */
  todayMinutes: number;
  target: number;
  rest: boolean;
}

export function TimerCard({ onEdit, todayMinutes, target, rest }: Props) {
  const { timer } = useAppData();
  const now = useNow(!!timer);

  if (!timer) {
    return (
      <section className="card timer-idle" aria-label="Live timer">
        <div className="timer-idle-head">
          <span className="timer-idle-icon" aria-hidden>
            ⏱️
          </span>
          <div>
            <h2 className="card-title">Live timer</h2>
            <p className="muted timer-idle-sub">Heading out? Start it now, stop when you’re back. It saves itself.</p>
          </div>
        </div>
        <button
          className="btn btn-block timer-start"
          onClick={() => {
            tap();
            startTimer();
          }}
        >
          <Play size={18} fill="currentColor" /> Start outside timer
        </button>
      </section>
    );
  }

  const elapsed = now - timer.startedAt;
  const liveMinutes = todayMinutes + Math.floor(elapsed / 60000);
  const toGo = Math.max(0, target - liveMinutes);
  const longRun = elapsed > 8 * 3600_000;

  const stop = () => {
    tap();
    const e = stopTimer();
    if (!e) {
      showToast({ msg: 'Under a minute, so it wasn’t saved 🙂' });
      return;
    }
    celebrate();
    showToast({ msg: `Saved ${fmtDur(e.minutes)} outside 🌳`, action: onEdit ? { label: 'Edit', run: () => onEdit(e) } : undefined });
  };

  const discard = () => {
    tap();
    const t = timer;
    cancelTimer();
    showToast({ msg: 'Timer discarded', action: { label: 'Undo', run: () => startTimer(t.category, t.startedAt) } });
  };

  return (
    <section className="card timer-running" aria-label="Outside timer running">
      <div className="spread">
        <span className="timer-badge">
          <span className="timer-dot" aria-hidden /> 🌳 Outside timer
        </span>
        <button className="timer-x" onClick={discard} aria-label="Discard timer">
          <X size={18} />
        </button>
      </div>
      <div className="timer-clock tnum" role="timer" aria-live="off">
        {fmtClock(elapsed)}
      </div>
      <p className="timer-since">
        Started {fmtTime(timer.startedAt)}
        {!rest && (toGo > 0 ? ` · ${fmtDur(toGo)} to today’s target` : ' · target hit! 🎉')}
      </p>
      {longRun && <p className="timer-warn">Over 8 hours. Forgot to stop it? Stop it, then tap Edit to fix the time.</p>}
      <div className="chips timer-cats">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className="chip"
            aria-pressed={timer.category === c.id}
            onClick={() => {
              tap();
              updateTimer({ category: timer.category === c.id ? undefined : c.id });
            }}
          >
            <span aria-hidden>{c.emoji}</span> {c.label}
          </button>
        ))}
      </div>
      <button className="btn btn-block timer-stop" onClick={stop}>
        <Square size={18} fill="currentColor" /> Stop &amp; save
      </button>
    </section>
  );
}

/** Small pill shown on other tabs while a timer runs. */
export function TimerPill({ onOpen }: { onOpen: () => void }) {
  const { timer } = useAppData();
  const now = useNow(!!timer);
  if (!timer) return null;
  return (
    <button className="timer-pill" onClick={onOpen} aria-label="Open running timer">
      <span className="timer-dot" aria-hidden />
      🌳 <span className="tnum">{fmtClock(now - timer.startedAt)}</span>
    </button>
  );
}
