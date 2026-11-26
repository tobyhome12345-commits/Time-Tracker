import type { Entry } from '../data/types';
import { CATEGORIES } from '../data/categories';
import { DAY_MS, fmtDur, keyToTs, startOfWeek } from './time';
import type { ChallengeWin, Ledger, LedgerRow } from './xp';

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

/* ───────────── Badges ───────────── */

export interface BadgeCtx {
  entries: Entry[];
  ledger: Ledger;
  totalMinutes: number;
  wins: ChallengeWin[];
  maxLevel: number;
}

export interface BadgeDef {
  id: string;
  emoji: string;
  name: string;
  hint: string;
  /** [current, target] for progress display, or a boolean */
  check: (c: BadgeCtx) => [number, number] | boolean;
}

const hours = (c: BadgeCtx) => c.totalMinutes / 60;
const done = (r: LedgerRow) => r.hit || r.info.rest;

export const BADGES: BadgeDef[] = [
  { id: 'first-log', emoji: '📝', name: 'First Log', hint: 'Log your first outdoor time', check: (c) => c.entries.length > 0 },
  { id: 'first-hour', emoji: '🌱', name: 'Fresh Air', hint: 'Spend your first hour outside', check: (c) => [Math.min(hours(c), 1), 1] },
  { id: 'first-target', emoji: '🎯', name: 'Target Hit', hint: 'Hit your daily target', check: (c) => c.ledger.rows.some((r) => r.hit) },
  { id: 'streak-3', emoji: '🔥', name: 'On a Roll', hint: 'Hit your target 3 days in a row', check: (c) => [Math.min(c.ledger.streak.best, 3), 3] },
  { id: 'early-bird', emoji: '🌅', name: 'Early Bird', hint: 'Get outside before 9am', check: (c) => c.entries.some((e) => e.minutes >= 5 && new Date(e.start).getHours() < 9) },
  { id: 'out-10h', emoji: '🌿', name: '10 Hours Out', hint: 'Log 10 hours outside in total', check: (c) => [Math.min(hours(c), 10), 10] },
  { id: 'weekend-warrior', emoji: '⚔️', name: 'Weekend Warrior', hint: 'Hit your target on a Saturday and the Sunday after', check: (c) => weekendWarrior(c.ledger.rows) },
  { id: 'timer-pro', emoji: '⏱️', name: 'Timer Pro', hint: 'Save 10 logs with the live timer', check: (c) => [Math.min(c.entries.filter((e) => e.source === 'timer').length, 10), 10] },
  { id: 'explorer', emoji: '🧭', name: 'Explorer', hint: 'Try 5 different activities', check: (c) => [Math.min(new Set(c.entries.map((e) => e.category).filter((x) => x && CATEGORIES.some((k) => k.id === x))).size, 5), 5] },
  { id: 'marathon', emoji: '🏃', name: 'Marathon Day', hint: 'Spend 3+ hours outside in one day', check: (c) => c.ledger.rows.some((r) => r.minutes >= 180) },
  { id: 'big-day', emoji: '💥', name: 'Big Day', hint: 'Earn 100+ XP in a single day', check: (c) => c.ledger.rows.some((r) => r.xp >= 100) },
  { id: 'comeback', emoji: '🦸', name: 'Comeback Kid', hint: 'Win XP back the day after losing some', check: (c) => c.ledger.rows.some((r, i) => i > 0 && r.xp > 0 && c.ledger.rows[i - 1].applied < 0) },
  { id: 'streak-7', emoji: '🏅', name: 'Week Streak', hint: 'Hit your target 7 days in a row', check: (c) => [Math.min(c.ledger.streak.best, 7), 7] },
  { id: 'perfect-week', emoji: '🗓️', name: 'Perfect Week', hint: 'Hit your target every day, Monday to Sunday', check: (c) => perfectWeek(c.ledger.rows) },
  { id: 'challenge-champ', emoji: '🏆', name: 'Challenge Champ', hint: 'Complete 3 weekend challenges', check: (c) => [Math.min(c.wins.length, 3), 3] },
  { id: 'holiday-hero', emoji: '🏝️', name: 'Holiday Hero', hint: 'Hit your target every day of a 3+ day holiday', check: (c) => holidayHero(c.ledger.rows) },
  { id: 'out-50h', emoji: '🌳', name: '50 Hours Out', hint: 'Log 50 hours outside in total', check: (c) => [Math.min(hours(c), 50), 50] },
  { id: 'level-10', emoji: '⭐', name: 'Level 10', hint: 'Help Pip reach level 10', check: (c) => [Math.min(c.maxLevel, 10), 10] },
  { id: 'streak-30', emoji: '👑', name: 'Unstoppable', hint: 'Hit your target 30 days in a row', check: (c) => [Math.min(c.ledger.streak.best, 30), 30] },
  { id: 'out-100h', emoji: '🏔️', name: '100 Hours Out', hint: 'Log 100 hours outside in total', check: (c) => [Math.min(hours(c), 100), 100] },
];

function weekendWarrior(rows: LedgerRow[]) {
  for (let i = 0; i < rows.length - 1; i++) {
    if (new Date(rows[i].info.ts).getDay() === 6 && rows[i].hit && rows[i + 1].hit) return true;
  }
  return false;
}

function perfectWeek(rows: LedgerRow[]) {
  const weeks = new Map<number, LedgerRow[]>();
  for (const r of rows) {
    const w = startOfWeek(r.info.ts);
    weeks.set(w, [...(weeks.get(w) ?? []), r]);
  }
  for (const days of weeks.values()) if (days.length === 7 && days.every(done) && days.some((d) => d.hit)) return true;
  return false;
}

function holidayHero(rows: LedgerRow[]) {
  const byHoliday = new Map<string, { rows: LedgerRow[]; len: number }>();
  for (const r of rows) {
    const h = r.info.holiday;
    if (!h) continue;
    const len = Math.round((keyToTs(h.end) - keyToTs(h.start)) / DAY_MS) + 1;
    const g = byHoliday.get(h.id) ?? { rows: [], len };
    g.rows.push(r);
    byHoliday.set(h.id, g);
  }
  for (const g of byHoliday.values()) if (g.len >= 3 && g.rows.length === g.len && g.rows.every(done)) return true;
  return false;
}

export function badgeEarned(r: [number, number] | boolean): boolean {
  return typeof r === 'boolean' ? r : r[0] >= r[1];
}

export function evaluateBadges(ctx: BadgeCtx) {
  return BADGES.map((def) => {
    const result = def.check(ctx);
    return { def, result, earned: badgeEarned(result) };
  });
}
