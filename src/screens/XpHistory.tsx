import { Sheet } from '../components/Sheet';
import { useAppData } from '../data/store';
import { fmtDur, startOfWeek } from '../logic/time';
import { DAY_TYPE_EMOJI, DAY_TYPE_LABEL, XP, type LedgerRow } from '../logic/xp';

/** One line per day: what happened and how much XP it was worth. */
export function XpHistoryList({ rows }: { rows: LedgerRow[] }) {
  if (!rows.length) return <div className="empty">Your XP history starts today 🌱</div>;
  return (
    <ul className="xp-list">
      {rows.map((r) => (
        <XpRow key={r.info.key} r={r} />
      ))}
    </ul>
  );
}

function XpRow({ r }: { r: LedgerRow }) {
  const name = r.info.rest ? 'Rest day' : r.info.type === 'holiday' ? r.info.holiday?.name ?? 'Holiday' : DAY_TYPE_LABEL[r.info.type];
  const emoji = r.info.rest ? '😴' : DAY_TYPE_EMOJI[r.info.type];
  const lvlChange = r.levelAfter - r.levelBefore;
  let detail: string;
  if (r.info.rest) detail = 'No target · streak safe';
  else if (r.pending) detail = `${fmtDur(r.minutes)} of ${fmtDur(r.info.target)} so far`;
  else detail = `${fmtDur(r.minutes)} of ${fmtDur(r.info.target)}`;
  const xpText = r.pending ? 'today' : r.xp > 0 ? `+${r.xp}` : r.xp < 0 ? `${r.xp}` : '±0';
  return (
    <li className="xp-row">
      <span className="xp-row-emoji" aria-hidden>
        {r.hit ? '✅' : emoji}
      </span>
      <span className="xp-row-main">
        <span className="xp-row-title">
          {new Date(r.info.ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · {name}
        </span>
        <span className="xp-row-sub">
          {detail}
          {r.parts.length > 0 && !r.info.rest && (
            <span className="xp-row-parts">
              {' · '}
              {r.parts.map((p) => `${p.kind === 'target' ? '🎯' : p.kind === 'extra' ? '⏱️' : p.kind === 'streak' ? '🔥' : p.kind === 'challenge' ? '🏆' : '📉'}${p.xp > 0 ? '+' : ''}${p.xp}`).join(' ')}
            </span>
          )}
        </span>
        {lvlChange !== 0 && <span className={`xp-row-level ${lvlChange > 0 ? 'is-up' : 'is-down'}`}>{lvlChange > 0 ? `⬆️ Level ${r.levelAfter}` : `⬇️ Level ${r.levelAfter}`}</span>}
      </span>
      <span className={`xp-row-xp tnum ${r.pending ? 'is-pending' : r.xp > 0 ? 'is-gain' : r.xp < 0 ? 'is-loss' : ''}`}>{xpText}</span>
    </li>
  );
}

export function XpHistorySheet({ rows, onClose }: { rows: LedgerRow[]; onClose: () => void }) {
  const weeks = new Map<number, LedgerRow[]>();
  for (const r of rows) {
    const w = startOfWeek(r.info.ts);
    weeks.set(w, [...(weeks.get(w) ?? []), r]);
  }
  const list = [...weeks.entries()].sort((a, b) => b[0] - a[0]);
  return (
    <Sheet title="📜 XP history" onClose={onClose}>
      {list.map(([w, rs]) => {
        const net = rs.reduce((a, r) => a + r.applied, 0);
        const hits = rs.filter((r) => r.hit).length;
        return (
          <section key={w} className="xp-week">
            <div className="spread xp-week-head">
              <span>
                Week of {new Date(w).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · 🎯 {hits}/{rs.length}
              </span>
              <span className={`tnum ${net > 0 ? 'xp-gain' : net < 0 ? 'xp-loss' : ''}`}>
                {net > 0 ? '+' : ''}
                {net} XP
              </span>
            </div>
            <XpHistoryList rows={rs.slice().reverse()} />
          </section>
        );
      })}
    </Sheet>
  );
}

/** Kid-friendly explanation of the rules. */
export function XpRulesSheet({ onClose }: { onClose: () => void }) {
  const hist = useAppData().targetHistory;
  const t = hist[hist.length - 1];
  return (
    <Sheet title="How XP works" onClose={onClose}>
      <div className="rules">
        <h3>🎯 Your daily target</h3>
        <ul>
          <li>
            📚 School days (Mon–Fri): <b>{fmtDur(t.weekday)}</b> outside
          </li>
          <li>
            🎉 Weekends: <b>{fmtDur(t.weekend)}</b>
          </li>
          <li>
            🏖️ Holidays: <b>{fmtDur(t.holiday)} every day</b>
          </li>
        </ul>
        <h3>⬆️ Win XP</h3>
        <ul>
          <li>
            Hit your target: <b>+{XP.targetBonus} XP</b>
          </li>
          <li>
            Every extra minute: <b>+1 XP</b> (up to {XP.extraCap / 60}h extra)
          </li>
          <li>
            Streak bonus: <b>+5 XP</b> per day in your streak (max +{XP.streakCap})
          </li>
          <li>
            Weekend challenge: <b>+{XP.challenge} XP</b>
          </li>
        </ul>
        <h3>⬇️ Lose XP</h3>
        <ul>
          <li>
            Miss your target and you lose <b>1 XP for every minute short</b> (20m short = −20 XP)
          </li>
          <li>It only happens at midnight, so you’ve got all day to fix it!</li>
          <li>Lose enough and Pip can drop a level 🥺</li>
        </ul>
        <h3>😴 Rest days</h3>
        <ul>
          <li>Ill or stuck inside? Use one rest day per week: no XP lost, streak safe.</li>
        </ul>
        <p className="settings-note">
          Example: {fmtDur(t.weekday + 30)} on a school day with a 3-day streak = 25 + 30 + 15 = +70 XP 🎉
        </p>
      </div>
    </Sheet>
  );
}
