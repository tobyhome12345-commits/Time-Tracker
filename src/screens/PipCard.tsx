import { ChevronRight } from 'lucide-react';
import { Pip } from '../mascot/Pip';
import { moodFor, moodLine, type Stage } from '../logic/progress';
import type { Ledger, LedgerRow } from '../logic/xp';

/** Compact Pip + speech bubble shown at the top of Today. */
export function PipCard(props: { ledger: Ledger; row: LedgerRow; stage: Stage; level: number; onOpen: () => void }) {
  const mood = moodFor(props.ledger, props.row);
  return (
    <button className="card pip-card" onClick={props.onOpen} aria-label={`Pip, level ${props.level}. Open Pip`}>
      <Pip stage={props.stage} mood={mood} size={78} holiday={props.row.info.type === 'holiday'} />
      <span className="pip-card-main">
        <span className="bubble bubble-left">{moodLine(mood, props.ledger, props.row)}</span>
        <span className="pip-card-meta">
          <span className="level-chip level-chip-sm">Lv {props.level}</span>
          {props.ledger.streak.current > 0 ? (
            <span className="streak-mini">🔥 {props.ledger.streak.current}-day streak</span>
          ) : (
            <span>Pip</span>
          )}
          <ChevronRight size={16} />
        </span>
      </span>
    </button>
  );
}
