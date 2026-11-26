interface Props {
  outside: number;
  inside: number;
  size?: number;
  stroke?: number;
}

/** Donut comparing outside vs inside minutes. Outside starts at 12 o'clock clockwise; inside fills the rest.
 *  A 2px surface gap separates the two segments. */
export function Ring({ outside, inside, size = 168, stroke = 18 }: Props) {
  const total = outside + inside;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? outside / total : 0;
  const gap = total && outside && inside ? 6 : 0; // px along the arc (includes round caps)
  const capPad = stroke / 2;
  const outLen = Math.max(0, pct * c - gap - (gap ? stroke : 0));
  const inLen = Math.max(0, (1 - pct) * c - gap - (gap ? stroke : 0));
  const label = total ? `${Math.round(pct * 100)}%` : '–';
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={total ? `${Math.round(pct * 100)} percent of logged time was outside` : 'Nothing logged yet'}
      className="ring"
    >
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`} fill="none" strokeWidth={stroke}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-2)" />
        {total > 0 && inside > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="var(--inside)"
            strokeLinecap={gap ? 'round' : 'butt'}
            strokeDasharray={`${outside ? inLen : c} ${c}`}
            strokeDashoffset={outside ? -(pct * c + gap / 2 + (gap ? capPad : 0)) : 0}
            className="ring-seg"
          />
        )}
        {total > 0 && outside > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="var(--outside)"
            strokeLinecap={gap ? 'round' : 'butt'}
            strokeDasharray={`${inside ? outLen : c} ${c}`}
            strokeDashoffset={inside ? -(gap / 2 + capPad) : 0}
            className="ring-seg"
          />
        )}
      </g>
      <text x="50%" y="47%" textAnchor="middle" className="ring-pct">
        {label}
      </text>
      <text x="50%" y="63%" textAnchor="middle" className="ring-cap">
        outside
      </text>
    </svg>
  );
}
