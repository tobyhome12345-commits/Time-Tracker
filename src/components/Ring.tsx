import { fmtDur } from '../logic/time';

interface Props {
  minutes: number;
  target: number;
  size?: number;
  stroke?: number;
  rest?: boolean;
}

/** Progress ring: outside minutes toward today's target. Full ring (+ glow) once the target is hit. */
export function Ring({ minutes, target, size = 176, stroke = 18, rest }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = rest || !target ? 0 : Math.min(1, minutes / target);
  const done = !rest && minutes >= target;
  const extra = done ? minutes - target : 0;
  const label = rest ? 'Rest day' : `${Math.round((minutes / Math.max(1, target)) * 100)}% of target`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${fmtDur(minutes)} outside, ${label}`} className={`ring${done ? ' is-done' : ''}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`} fill="none" strokeWidth={stroke}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-2)" />
        {pct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="var(--outside)"
            strokeLinecap={pct < 1 ? 'round' : 'butt'}
            strokeDasharray={`${pct * c} ${c}`}
            className="ring-seg"
          />
        )}
      </g>
      <text x="50%" y={done ? '42%' : '47%'} textAnchor="middle" className="ring-pct">
        {rest ? '😴' : fmtDur(minutes)}
      </text>
      <text x="50%" y={done ? '56%' : '62%'} textAnchor="middle" className="ring-cap">
        {rest ? 'rest day' : `of ${fmtDur(target)}`}
      </text>
      {done && (
        <text x="50%" y="70%" textAnchor="middle" className="ring-extra">
          {extra > 0 ? `+${fmtDur(extra)} extra` : 'target hit!'}
        </text>
      )}
    </svg>
  );
}
