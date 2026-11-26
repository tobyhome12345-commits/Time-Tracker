import { DAY_MS, fmtDur } from './time';
import type { Ledger, LedgerRow } from './xp';

export { STAGES, levelInfo, stageFor, xpForLevel, type LevelInfo, type Stage } from './levels';

/* ───────────── Mood ───────────── */

export type Mood = 'sleepy' | 'happy' | 'cheer' | 'worried' | 'droopy' | 'rest';

/** Pip's mood for a ledger row (today uses the clock; past days use how they ended). */
export function moodFor(ledger: Ledger, row: LedgerRow, now = Date.now()): Mood {
  if (row.info.rest) return 'rest';
  if (row.hit) return 'cheer';
  if (!row.isToday) return 'droopy';
  const hour = new Date(now).getHours();
  const i = ledger.rows.indexOf(row);
  const yesterday = i > 0 ? ledger.rows[i - 1] : undefined;
  if (hour >= 17) return 'worried';
  if (row.minutes > 0) return 'happy';
  if (yesterday && yesterday.applied < 0) return 'droopy';
  return 'sleepy';
}

export function moodLine(mood: Mood, ledger: Ledger, row: LedgerRow, now = Date.now()): string {
  const pick = (lines: string[]) => lines[Math.floor(now / DAY_MS) % lines.length];
  const toGo = row.isToday ? ledger.toGo : 0;
  switch (mood) {
    case 'rest':
      return pick(['Rest day. Get well soon! 💤', 'Taking it easy today. No XP lost 😌']);
    case 'cheer':
      return row.isToday ? pick([`Target smashed! +${row.xp} XP 🎉`, 'We did it! I can feel myself growing! 🌱', 'Best. Day. Ever. 🌟']) : `We hit the target that day! +${row.xp} XP 🎉`;
    case 'worried':
      return ledger.atRisk > 0 ? `${fmtDur(toGo)} to go or we lose ${ledger.atRisk} XP tonight! 😰` : `${fmtDur(toGo)} to go to hit today’s target! 😰`;
    case 'happy':
      return pick([`Nice! Just ${fmtDur(toGo)} more to hit the target 🌞`, `Keep going, ${fmtDur(toGo)} to go! 💪`]);
    case 'droopy':
      return row.isToday ? 'We lost some XP yesterday… let’s win it back today! 🥺' : `We missed the target that day (${row.xp} XP) 🥺`;
    case 'sleepy':
      return pick(['Zzz… let’s get outside today! ☀️', `Today’s target: ${fmtDur(row.info.target)}. Let’s go! 🌳`, 'Psst. I’m a plant. I need sunshine. ☀️']);
  }
}
