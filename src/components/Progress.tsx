import { fmtDur } from '../logic/time';

interface Props {
  label: string;
  icon: string;
  value: number;
  target: number;
  color: string;
  /** 'goal' = reaching target is good; 'limit' = staying under is good. */
  mode: 'goal' | 'limit';
}

export function GoalBar({ label, icon, value, target, color, mode }: Props) {
  const pct = Math.min(1, target ? value / target : 0);
  const done = value >= target;
  let status: string;
  if (mode === 'goal') status = done ? 'Goal smashed! 🎉' : `${fmtDur(target - value)} to go`;
  else status = done ? (value > target ? `${fmtDur(value - target)} over 😬` : 'Right at the limit') : `${fmtDur(target - value)} left`;
  return (
    <div className="goal-bar">
      <div className="spread goal-bar-top">
        <span className="goal-bar-label">
          <span aria-hidden>{icon}</span> {label}
        </span>
        <span className="goal-bar-val tnum">
          <b>{fmtDur(value)}</b> <span className="faint">/ {fmtDur(target)}</span>
        </span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(value, target)}
      >
        <span style={{ width: `${pct * 100}%`, ['--bar' as string]: mode === 'limit' && done ? 'var(--danger)' : color }} />
      </div>
      <div className={`goal-bar-status ${mode === 'limit' && value > target ? 'is-over' : ''} ${mode === 'goal' && done ? 'is-done' : ''}`}>
        {status}
      </div>
    </div>
  );
}
