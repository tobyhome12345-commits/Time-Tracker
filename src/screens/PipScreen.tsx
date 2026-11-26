import { useState } from 'react';
import { ChevronRight, HelpCircle, Sparkles } from 'lucide-react';
import { useAppData } from '../data/store';
import { Pip } from '../mascot/Pip';
import { Sheet } from '../components/Sheet';
import { moodFor, moodLine, STAGES, type Mood } from '../logic/progress';
import { useDerived, type Derived } from '../logic/useProgress';
import { tap } from '../native/platform';
import { ChallengeCard } from './ChallengeCard';
import { XpHistoryList, XpHistorySheet, XpRulesSheet } from './XpHistory';
import { BadgeCase } from './BadgeCase';

const MOODS: { id: Mood; name: string; when: string }[] = [
  { id: 'sleepy', name: 'Sleepy', when: 'Nothing logged yet today' },
  { id: 'happy', name: 'Happy', when: 'On the way to the target' },
  { id: 'cheer', name: 'Cheering', when: 'Target hit!' },
  { id: 'worried', name: 'Worried', when: 'After 5pm and not there yet' },
  { id: 'droopy', name: 'Droopy', when: 'Lost XP yesterday' },
  { id: 'rest', name: 'Resting', when: 'Rest day' },
];

/** Extra cell in the evolution sheet showing the holiday look. */
const HOLIDAY_LOOK = { id: 'holiday' as const, name: 'Holiday', when: 'Every holiday day 😎' };

export function PipScreen() {
  const data = useAppData();
  const derived = useDerived();
  const { ledger, challenge } = derived;
  const [evo, setEvo] = useState(false);
  const [history, setHistory] = useState(false);
  const [rules, setRules] = useState(false);
  const row = ledger.today;
  const mood = moodFor(ledger, row);
  const { level } = ledger;
  const stage = STAGES.find((s) => s.id === level.stage)!;
  const next = STAGES.find((s) => s.from > level.level);
  const holiday = row.info.type === 'holiday';

  return (
    <main className="screen" aria-label="Pip">
      <div className="screen-head">
        <div>
          <p className="screen-sub">Your outdoor buddy</p>
          <h1 className="screen-title">Pip</h1>
        </div>
        <button
          className="icon-btn"
          aria-label="How XP works"
          onClick={() => {
            tap();
            setRules(true);
          }}
        >
          <HelpCircle size={22} />
        </button>
      </div>

      <div className="stack">
        <section className="card pip-hero">
          <div className="bubble" role="status">
            {moodLine(mood, ledger, row)}
          </div>
          <div className="pip-stage-wrap">
            <Pip stage={level.stage} mood={mood} size={190} holiday={holiday} />
          </div>
          <div className="pip-level-row">
            <span className="level-chip">Lv {level.level}</span>
            <span className="pip-stage-name">{stage.name}</span>
          </div>
          <div className="xp">
            <div className="progress" role="progressbar" aria-label="XP to next level" aria-valuemin={0} aria-valuemax={level.need} aria-valuenow={level.into}>
              <span style={{ width: `${(level.into / level.need) * 100}%`, ['--bar' as string]: 'var(--accent)' }} />
            </div>
            <div className="spread xp-text tnum">
              <span>
                {level.xp.toLocaleString()} XP · {level.into} / {level.need}
              </span>
              <span>{level.need - level.into} XP to Lv {level.level + 1}</span>
            </div>
          </div>
          {next && (
            <p className="pip-next muted">
              Evolves into <b className="text-strong">{next.name}</b> at level {next.from} 🌟
            </p>
          )}
          <button
            className="btn btn-soft btn-block"
            onClick={() => {
              tap();
              setEvo(true);
            }}
          >
            <Sparkles size={18} /> Pip’s evolution
          </button>
        </section>

        <h2 className="section-title">Streak</h2>
        <StreakCard derived={derived} />

        <ChallengeCard challenge={challenge} />

        <div className="spread" style={{ margin: '10px 4px 0' }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            XP history
          </h2>
          <button
            className="link-btn"
            onClick={() => {
              tap();
              setHistory(true);
            }}
          >
            See all <ChevronRight size={16} />
          </button>
        </div>
        <section className="card xp-history-card">
          <XpHistoryList rows={ledger.rows.slice(-7).reverse()} />
        </section>

        <h2 className="section-title">Badges</h2>
        <BadgeCase results={derived.badges} unlocked={data.badges} />
      </div>

      {evo && <EvolutionSheet level={level.level} stage={level.stage} holiday={holiday} onClose={() => setEvo(false)} />}
      {history && <XpHistorySheet rows={ledger.rows} onClose={() => setHistory(false)} />}
      {rules && <XpRulesSheet onClose={() => setRules(false)} />}
    </main>
  );
}

function StreakCard({ derived }: { derived: Derived }) {
  const { streak, rows } = derived.ledger;
  const recent = rows.slice(-14);
  return (
    <section className={`card streak-wide${streak.current > 0 ? ' is-live' : ''}`} aria-label="Target streak">
      <div className="streak-wide-top">
        <span className="streak-emoji" aria-hidden>
          🔥
        </span>
        <div>
          <div className="streak-num tnum">
            {streak.current}
            <small> day{streak.current === 1 ? '' : 's'}</small>
          </div>
          <div className="streak-sub">Target streak · best {streak.best}</div>
        </div>
        <div className="streak-bonus">
          <span className="tnum">+{Math.min(25, 5 * (streak.current + (streak.todayDone ? 0 : 1)))}</span>
          <small>XP bonus {streak.todayDone ? 'today' : 'next hit'}</small>
        </div>
      </div>
      {streak.current > 0 && !streak.todayDone && !derived.ledger.today.info.rest && <div className="streak-alert">Hit today’s target to keep it alive!</div>}
      <div className="day-dots">
        {recent.map((r) => (
          <div key={r.info.key} className="day-dot-col">
            <span
              className={`day-dot${r.hit ? ' is-goal' : r.info.rest ? ' is-rest' : r.pending ? ' is-today' : r.xp < 0 ? ' is-miss' : ''}`}
              aria-label={`${r.info.key}: ${r.hit ? 'target hit' : r.info.rest ? 'rest day' : r.pending ? 'today' : 'missed'}`}
            >
              {r.hit ? '✓' : r.info.rest ? 'z' : ''}
            </span>
            <span className="day-dot-label">{new Date(r.info.ts).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function EvolutionSheet({ level, stage, holiday, onClose }: { level: number; stage: string; holiday: boolean; onClose: () => void }) {
  return (
    <Sheet title="Pip’s evolution" onClose={onClose}>
      <p className="muted evo-intro">
        Pip grows when you <b className="text-strong">beat your daily target</b>, and shrinks if you miss it. Keep getting outside to reach the Mighty Tree!
      </p>
      <div className="evo-grid">
        {STAGES.map((s) => {
          const unlocked = level >= s.from;
          return (
            <div key={s.id} className={`evo-cell${s.id === stage ? ' is-current' : ''}`}>
              <Pip stage={s.id} mood={unlocked ? 'happy' : 'sleepy'} size={84} animated={s.id === stage} locked={!unlocked} holiday={holiday && unlocked} title={`${s.name}${unlocked ? '' : ' (locked)'}`} />
              <span className="evo-name">{unlocked ? s.name : '???'}</span>
              <span className="evo-lv">Lv {s.from}</span>
            </div>
          );
        })}
      </div>
      <h3 className="field-label" style={{ marginTop: 22 }}>
        Pip’s moods
      </h3>
      <div className="mood-grid">
        {[...MOODS, HOLIDAY_LOOK].map((m) => (
          <div key={m.id} className="mood-cell">
            <Pip stage={stage as never} mood={m.id === 'holiday' ? 'happy' : m.id} size={70} animated={false} holiday={holiday || m.id === 'holiday'} />
            <span className="evo-name">{m.name}</span>
            <span className="mood-when">{m.when}</span>
          </div>
        ))}
      </div>
      <p className="settings-note" style={{ textAlign: 'center' }}>
        {holiday ? 'It’s a holiday, so Pip has his sunnies on 😎' : 'On holidays Pip wears sunglasses at every stage 😎'}
      </p>
    </Sheet>
  );
}
