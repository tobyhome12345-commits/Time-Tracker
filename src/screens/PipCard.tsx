import { ChevronRight } from 'lucide-react';
import { Pip } from '../mascot/Pip';
import { moodFor, moodLine, type Stage } from '../logic/progress';
import type { Settings } from '../data/types';
import type { DayTotals } from '../logic/time';

/** Compact Pip + speech bubble shown at the top of Today. */
export function PipCard(props: { totals: DayTotals; settings: Settings; stage: Stage; level: number; isToday: boolean; onOpen: () => void }) {
  const mood = moodFor(props.totals, props.settings);
  return (
    <button className="card pip-card" onClick={props.onOpen} aria-label={`Pip, level ${props.level}. Open Pip`}>
      <Pip stage={props.stage} mood={mood} size={78} />
      <span className="pip-card-main">
        <span className="bubble bubble-left">{props.isToday ? moodLine(mood) : moodLine(mood, 0)}</span>
        <span className="pip-card-meta">
          <span className="level-chip level-chip-sm">Lv {props.level}</span> Pip
          <ChevronRight size={16} />
        </span>
      </span>
    </button>
  );
}
