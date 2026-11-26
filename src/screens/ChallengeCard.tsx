import type { WeekChallenge } from '../logic/challenges';
import { fmtDur } from '../logic/time';
import { XP } from '../logic/xp';

const MINUTE_GOALS = new Set(['sun-chaser', 'big-adventure', 'golden-hour']);

/** This week's weekend/holiday challenge (only free days count). */
export function ChallengeCard({ challenge: c, compact }: { challenge: WeekChallenge; compact?: boolean }) {
  const [cur, goal] = c.progress;
  const fmt = (v: number) => (MINUTE_GOALS.has(c.def.id) ? fmtDur(v) : String(v));
  const state = c.done ? 'done' : c.upcoming ? 'upcoming' : c.activeToday ? 'active' : c.freeDays.length ? 'waiting' : 'none';
  if (state === 'none') return null;
  const nextFree = c.freeDays.find((d) => !c.activeToday && d.ts > Date.now());
  return (
    <section className={`card challenge-card is-${state}${compact ? ' is-compact' : ''}`} aria-label="Weekend challenge">
      <div className="challenge-head">
        <span className="challenge-emoji" aria-hidden>
          {c.done ? '🏆' : c.def.emoji}
        </span>
        <div className="challenge-text">
          <span className="challenge-kicker">
            {c.done ? 'Challenge complete!' : state === 'upcoming' ? `Weekend challenge · unlocks ${nextFree ? new Date(nextFree.ts).toLocaleDateString(undefined, { weekday: 'long' }) : 'soon'}` : 'Weekend challenge'}
          </span>
          <span className="challenge-name">{c.def.name}</span>
          <span className="challenge-desc">{c.def.desc}</span>
        </div>
        <span className={`challenge-xp${c.done ? ' is-won' : ''}`}>+{XP.challenge} XP</span>
      </div>
      {!c.done && state !== 'upcoming' && (
        <div className="challenge-prog">
          <div className="progress" role="progressbar" aria-label="Challenge progress" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={cur}>
            <span style={{ width: `${(cur / goal) * 100}%`, ['--bar' as string]: 'var(--sun)' }} />
          </div>
          <span className="challenge-count tnum">
            {fmt(cur)} / {fmt(goal)}
          </span>
        </div>
      )}
      {state === 'upcoming' && <p className="challenge-note">Only time on weekends and holiday days counts. No pressure on school days 🎒</p>}
    </section>
  );
}
