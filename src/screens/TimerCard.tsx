import { useEffect, useState } from 'react';
import { Play, Square, X } from 'lucide-react';
import { cancelTimer, startTimer, stopTimer, updateTimer, useAppData } from '../data/store';
import type { Entry, Kind } from '../data/types';
import { CATEGORIES, KIND_EMOJI, KIND_LABEL } from '../data/categories';
import { fmtClock, fmtDur, fmtTime } from '../logic/time';
import { showToast } from '../components/toast';
import { celebrate, tap } from '../native/platform';
import { afterLogSaved, afterTimerStarted, afterTimerStopped } from '../native/notify';

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

export function TimerCard({ onEdit }: { onEdit?: (e: Entry) => void }) {
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
            <p className="muted timer-idle-sub">Start it now, stop when you’re done. It saves itself.</p>
          </div>
        </div>
        <div className="grid-2">
          {(['inside', 'outside'] as Kind[]).map((k) => (
            <button
              key={k}
              className={`btn timer-start timer-start-${k}`}
              onClick={() => {
                tap();
                startTimer(k);
                afterTimerStarted(k);
              }}
            >
              <Play size={18} fill="currentColor" /> {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </section>
    );
  }

  const elapsed = now - timer.startedAt;
  const longRun = elapsed > 8 * 3600_000;

  const stop = () => {
    tap();
    const e = stopTimer();
    afterTimerStopped();
    if (!e) {
      showToast({ msg: 'Under a minute, so it wasn’t saved 🙂' });
      return;
    }
    afterLogSaved(e);
    if (e.kind === 'outside') celebrate();
    showToast({
      msg: `Saved ${fmtDur(e.minutes)} ${e.kind} ${KIND_EMOJI[e.kind]}`,
      action: onEdit ? { label: 'Edit', run: () => onEdit(e) } : undefined,
    });
  };

  const discard = () => {
    tap();
    const t = timer;
    cancelTimer();
    afterTimerStopped();
    showToast({ msg: 'Timer discarded', action: { label: 'Undo', run: () => startTimer(t.kind, t.category, t.startedAt) } });
  };

  return (
    <section className={`card timer-running timer-running-${timer.kind}`} aria-label={`${KIND_LABEL[timer.kind]} timer running`}>
      <div className="spread">
        <span className="timer-badge">
          <span className="timer-dot" aria-hidden /> {KIND_EMOJI[timer.kind]} {KIND_LABEL[timer.kind]} timer
        </span>
        <button className="timer-x" onClick={discard} aria-label="Discard timer">
          <X size={18} />
        </button>
      </div>
      <div className="timer-clock tnum" role="timer" aria-live="off">
        {fmtClock(elapsed)}
      </div>
      <p className="timer-since">Started {fmtTime(timer.startedAt)}</p>
      {longRun && <p className="timer-warn">Over 8 hours. Forgot to stop it? Stop it, then tap Edit to fix the time.</p>}
      <div className="chips timer-cats">
        {CATEGORIES[timer.kind].map((c) => (
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
    <button className={`timer-pill timer-pill-${timer.kind}`} onClick={onOpen} aria-label="Open running timer">
      <span className="timer-dot" aria-hidden />
      {KIND_EMOJI[timer.kind]} <span className="tnum">{fmtClock(now - timer.startedAt)}</span>
    </button>
  );
}
