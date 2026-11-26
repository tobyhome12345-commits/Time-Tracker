import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAppData } from '../data/store';
import { Pip } from '../mascot/Pip';
import { Sheet } from '../components/Sheet';
import { moodFor, moodLine, STAGES, type Mood, type Progress } from '../logic/progress';
import { useDerived } from '../logic/useProgress';
import { dayKey, fmtDur, totalsFor } from '../logic/time';
import { tap } from '../native/platform';

const MOODS: { id: Mood; name: string; when: string }[] = [
  { id: 'sleepy', name: 'Sleepy', when: 'Nothing logged yet today' },
  { id: 'happy', name: 'Happy', when: 'Outside is winning' },
  { id: 'cheer', name: 'Cheering', when: 'Outside goal hit!' },
  { id: 'unsure', name: 'Unsure', when: 'Inside is ahead' },
  { id: 'droopy', name: 'Droopy', when: 'Over the inside limit, no outside' },
];

export function PipScreen() {
  const data = useAppData();
  const { map, progress } = useDerived();
  const [evo, setEvo] = useState(false);
  const today = totalsFor(map, dayKey(Date.now()));
  const mood = moodFor(today, data.settings);
  const { level } = progress;
  const stage = STAGES.find((s) => s.id === level.stage)!;
  const next = STAGES.find((s) => s.from > level.level);
  const earned = progress.badgeResults.filter((b) => b.earned).length;

  return (
    <main className="screen" aria-label="Pip">
      <div className="screen-head">
        <div>
          <p className="screen-sub">Your outdoor buddy</p>
          <h1 className="screen-title">Pip</h1>
        </div>
      </div>

      <div className="stack">
        <section className="card pip-hero">
          <div className="bubble" role="status">
            {moodLine(mood)}
          </div>
          <div className="pip-stage-wrap">
            <Pip stage={level.stage} mood={mood} size={190} />
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
                {level.into.toLocaleString()} / {level.need.toLocaleString()} XP
              </span>
              <span>Lv {level.level + 1} in {fmtXp(level.need - level.into)}</span>
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

        <h2 className="section-title">Streaks</h2>
        <Streaks progress={progress} />

        <div className="spread" style={{ margin: '10px 4px 0' }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Badges
          </h2>
          <span className="badge-count tnum">
            {earned} / {progress.badgeResults.length}
          </span>
        </div>
        <Badges progress={progress} unlocked={data.badges} />
      </div>

      {evo && <EvolutionSheet level={level.level} stage={level.stage} onClose={() => setEvo(false)} />}
    </main>
  );
}

function fmtXp(xp: number) {
  // 1 XP = 1 outside minute
  return `${fmtDur(xp)} outside`;
}

function Streaks({ progress }: { progress: Progress }) {
  const recent = progress.days.slice(-14);
  return (
    <>
      <div className="grid-2">
        <StreakCard emoji="🔥" title="Outside wins" sub="Outside beat inside" s={progress.winStreak} />
        <StreakCard emoji="🎯" title="Goal streak" sub="Hit your outside goal" s={progress.goalStreak} />
      </div>
      {recent.length > 0 && (
        <section className="card" aria-label="Last 14 days">
          <div className="spread">
            <h3 className="card-title" style={{ fontSize: 15 }}>
              Last 14 days
            </h3>
            <span className="streak-key">
              <i className="dot dot-win" /> win <i className="dot dot-goal" /> goal
            </span>
          </div>
          <div className="day-dots">
            {recent.map((d) => (
              <div key={d.key} className="day-dot-col" title={d.key}>
                <span className={`day-dot${d.goal ? ' is-goal' : d.win ? ' is-win' : d.inside || d.outside ? ' is-logged' : ''}`} aria-label={`${d.key}: ${d.goal ? 'goal hit' : d.win ? 'outside won' : 'no win'}`}>
                  {d.goal ? '★' : ''}
                </span>
                <span className="day-dot-label">{new Date(d.ts).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function StreakCard({ emoji, title, sub, s }: { emoji: string; title: string; sub: string; s: { current: number; best: number; todayDone: boolean } }) {
  return (
    <section className={`card streak-card${s.current > 0 ? ' is-live' : ''}`}>
      <div className="streak-emoji" aria-hidden>
        {emoji}
      </div>
      <div className="streak-num tnum">
        {s.current}
        <small> day{s.current === 1 ? '' : 's'}</small>
      </div>
      <div className="streak-title">{title}</div>
      <div className="streak-sub">{sub}</div>
      <div className="streak-best tnum">Best: {s.best}</div>
      {s.current > 0 && !s.todayDone && <div className="streak-alert">Keep it alive today!</div>}
    </section>
  );
}

function Badges({ progress, unlocked }: { progress: Progress; unlocked: Record<string, number> }) {
  return (
    <div className="badge-grid">
      {progress.badgeResults.map(({ def, result, earned }) => {
        const got = earned || !!unlocked[def.id];
        const prog = Array.isArray(result) && !got ? result : null;
        return (
          <div key={def.id} className={`badge${got ? ' is-earned' : ''}`} aria-label={`${def.name}: ${got ? 'unlocked' : def.hint}`}>
            <span className="badge-medal" aria-hidden>
              {def.emoji}
            </span>
            <span className="badge-name">{def.name}</span>
            <span className="badge-hint">
              {got && unlocked[def.id] ? new Date(unlocked[def.id]).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : def.hint}
            </span>
            {prog && (
              <span className="badge-prog" aria-hidden>
                <span style={{ width: `${(prog[0] / prog[1]) * 100}%` }} />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EvolutionSheet({ level, stage, onClose }: { level: number; stage: string; onClose: () => void }) {
  return (
    <Sheet title="Pip’s evolution" onClose={onClose}>
      <p className="muted evo-intro">
        Pip earns <b className="text-strong">1 XP for every minute outside</b>, plus <b className="text-strong">30 bonus XP</b> each day you hit your goal.
      </p>
      <div className="evo-grid">
        {STAGES.map((s) => {
          const unlocked = level >= s.from;
          return (
            <div key={s.id} className={`evo-cell${s.id === stage ? ' is-current' : ''}`}>
              <Pip stage={s.id} mood={unlocked ? 'happy' : 'sleepy'} size={84} animated={s.id === stage} locked={!unlocked} title={`${s.name}${unlocked ? '' : ' (locked)'}`} />
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
        {MOODS.map((m) => (
          <div key={m.id} className="mood-cell">
            <Pip stage={stage as never} mood={m.id} size={70} animated={false} />
            <span className="evo-name">{m.name}</span>
            <span className="mood-when">{m.when}</span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
