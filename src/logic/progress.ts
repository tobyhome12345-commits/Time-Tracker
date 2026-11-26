import type { Entry, Settings } from '../data/types';
import { addDays, DAY_MS, dayKey, startOfDay, startOfWeek, type DayTotals } from './time';

/* ───────────── Levels ───────────── */

export const GOAL_BONUS_XP = 30;

/** Cumulative XP needed to reach level n (n ≥ 1). 1 XP = 1 outside minute. */
export function xpForLevel(n: number): number {
  return 30 * n * (n - 1);
}

export interface LevelInfo {
  xp: number;
  level: number;
  /** XP into the current level / needed for the next */
  into: number;
  need: number;
  stage: Stage;
}

export type Stage = 'seed' | 'sprout' | 'sapling' | 'bud' | 'bloom' | 'tree';

export const STAGES: { id: Stage; name: string; from: number; blurb: string }[] = [
  { id: 'seed', name: 'Seed', from: 1, blurb: 'Tiny, but full of potential.' },
  { id: 'sprout', name: 'Sprout', from: 3, blurb: 'First leaves! Pip is waking up.' },
  { id: 'sapling', name: 'Sapling', from: 5, blurb: 'Taller, leafier, braver.' },
  { id: 'bud', name: 'Bud', from: 8, blurb: 'Something exciting is about to bloom…' },
  { id: 'bloom', name: 'Bloom', from: 11, blurb: 'In full flower. Absolutely glowing.' },
  { id: 'tree', name: 'Mighty Tree', from: 15, blurb: 'A legend of the outdoors. Shades on. 😎' },
];

export function stageFor(level: number): Stage {
  let s: Stage = 'seed';
  for (const st of STAGES) if (level >= st.from) s = st.id;
  return s;
}

export function levelInfo(xp: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const base = xpForLevel(level);
  return { xp, level, into: xp - base, need: xpForLevel(level + 1) - base, stage: stageFor(level) };
}

/* ───────────── Day facts ───────────── */

export interface DayFacts {
  key: string;
  ts: number;
  inside: number;
  outside: number;
  win: boolean; // outside beat inside
  goal: boolean; // outside goal hit
}

/** One entry per day from the first log until today (inclusive). */
export function dayFacts(map: Map<string, DayTotals>, entries: Entry[], goalMin: number, now = Date.now()): DayFacts[] {
  if (!entries.length) return [];
  const today = startOfDay(now);
  let ts = startOfDay(entries[0].start);
  const out: DayFacts[] = [];
  // Guard against far-future/past junk: at most ~10 years of days.
  for (let i = 0; ts <= today && i < 4000; i++) {
    const key = dayKey(ts);
    const t = map.get(key) ?? { inside: 0, outside: 0 };
    out.push({ key, ts, ...t, win: t.outside > 0 && t.outside > t.inside, goal: t.outside >= goalMin });
    ts = addDays(ts, 1);
  }
  return out;
}

export interface Streak {
  current: number;
  best: number;
  /** today already counts toward `current` */
  todayDone: boolean;
}

/** Current streak counts back from today; if today isn't done yet the streak is still alive from yesterday. */
export function streak(days: DayFacts[], pick: (d: DayFacts) => boolean): Streak {
  let best = 0;
  let run = 0;
  for (const d of days) {
    run = pick(d) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const last = days[days.length - 1];
  const todayDone = !!last && pick(last);
  let current = 0;
  for (let i = days.length - 1 - (todayDone ? 0 : 1); i >= 0; i--) {
    if (pick(days[i])) current++;
    else break;
  }
  return { current, best, todayDone };
}

/* ───────────── Badges ───────────── */

export interface BadgeCtx {
  entries: Entry[];
  days: DayFacts[];
  totalOutside: number;
  winStreak: Streak;
  goalStreak: Streak;
  level: number;
}

export interface BadgeDef {
  id: string;
  emoji: string;
  name: string;
  hint: string;
  /** [current, target] for progress display, or a boolean */
  check: (c: BadgeCtx) => [number, number] | boolean;
}

const bestStreak = (c: BadgeCtx) => Math.max(c.winStreak.best, c.goalStreak.best);
const hours = (c: BadgeCtx) => c.totalOutside / 60;

export const BADGES: BadgeDef[] = [
  { id: 'first-log', emoji: '📝', name: 'First Log', hint: 'Log anything at all', check: (c) => c.entries.length > 0 },
  { id: 'first-hour', emoji: '🌱', name: 'Fresh Air', hint: 'Spend your first hour outside', check: (c) => [Math.min(hours(c), 1), 1] },
  { id: 'first-goal', emoji: '🎯', name: 'Goal Getter', hint: 'Hit your daily outside goal', check: (c) => c.days.some((d) => d.goal) },
  { id: 'out-10h', emoji: '🌿', name: '10 Hours Out', hint: 'Log 10 hours outside in total', check: (c) => [Math.min(hours(c), 10), 10] },
  { id: 'streak-3', emoji: '🔥', name: 'On a Roll', hint: 'Get a 3-day streak', check: (c) => [Math.min(bestStreak(c), 3), 3] },
  { id: 'early-bird', emoji: '🌅', name: 'Early Bird', hint: 'Get outside before 9am', check: (c) => c.entries.some((e) => e.kind === 'outside' && e.minutes >= 5 && new Date(e.start).getHours() < 9) },
  { id: 'timer-pro', emoji: '⏱️', name: 'Timer Pro', hint: 'Save 10 logs with the live timer', check: (c) => [Math.min(c.entries.filter((e) => e.source === 'timer').length, 10), 10] },
  { id: 'explorer', emoji: '🧭', name: 'Explorer', hint: 'Try all 4 outside activities', check: (c) => [new Set(c.entries.filter((e) => e.kind === 'outside' && e.category).map((e) => e.category)).size, 4] },
  { id: 'streak-7', emoji: '🏅', name: 'Week Streak', hint: 'Get a 7-day streak', check: (c) => [Math.min(bestStreak(c), 7), 7] },
  { id: 'weekend-warrior', emoji: '⚔️', name: 'Weekend Warrior', hint: 'Hit your goal on a Saturday and the Sunday after', check: (c) => weekendWarrior(c.days) },
  { id: 'marathon', emoji: '🏃', name: 'Marathon Day', hint: 'Spend 3+ hours outside in one day', check: (c) => c.days.some((d) => d.outside >= 180) },
  { id: 'balanced-week', emoji: '⚖️', name: 'Balanced Week', hint: 'Spend half or more of a week’s logged time outside', check: (c) => balancedWeek(c.days) },
  { id: 'out-50h', emoji: '🌳', name: '50 Hours Out', hint: 'Log 50 hours outside in total', check: (c) => [Math.min(hours(c), 50), 50] },
  { id: 'level-10', emoji: '⭐', name: 'Level 10', hint: 'Help Pip reach level 10', check: (c) => [Math.min(c.level, 10), 10] },
  { id: 'streak-30', emoji: '👑', name: 'Unstoppable', hint: 'Get a 30-day streak', check: (c) => [Math.min(bestStreak(c), 30), 30] },
  { id: 'out-100h', emoji: '🏔️', name: '100 Hours Out', hint: 'Log 100 hours outside in total', check: (c) => [Math.min(hours(c), 100), 100] },
];

function weekendWarrior(days: DayFacts[]) {
  for (let i = 0; i < days.length - 1; i++) {
    if (new Date(days[i].ts).getDay() === 6 && days[i].goal && days[i + 1].goal) return true;
  }
  return false;
}

function balancedWeek(days: DayFacts[]) {
  const weeks = new Map<number, { inside: number; outside: number; logged: number }>();
  for (const d of days) {
    const w = startOfWeek(d.ts);
    const acc = weeks.get(w) ?? { inside: 0, outside: 0, logged: 0 };
    acc.inside += d.inside;
    acc.outside += d.outside;
    if (d.inside || d.outside) acc.logged++;
    weeks.set(w, acc);
  }
  for (const w of weeks.values()) {
    if (w.logged >= 3 && w.outside >= 120 && w.outside >= w.inside) return true;
  }
  return false;
}

export function badgeEarned(r: [number, number] | boolean): boolean {
  return typeof r === 'boolean' ? r : r[0] >= r[1];
}

/* ───────────── Everything together ───────────── */

export interface Progress {
  days: DayFacts[];
  totalOutside: number;
  goalDays: number;
  level: LevelInfo;
  winStreak: Streak;
  goalStreak: Streak;
  badgeResults: { def: BadgeDef; result: [number, number] | boolean; earned: boolean }[];
}

export function computeProgress(entries: Entry[], map: Map<string, DayTotals>, settings: Pick<Settings, 'outsideGoalMin'>, now = Date.now()): Progress {
  const days = dayFacts(map, entries, settings.outsideGoalMin, now);
  let totalOutside = 0;
  for (const t of map.values()) totalOutside += t.outside;
  const goalDays = days.filter((d) => d.goal).length;
  const level = levelInfo(Math.round(totalOutside) + goalDays * GOAL_BONUS_XP);
  const winStreak = streak(days, (d) => d.win);
  const goalStreak = streak(days, (d) => d.goal);
  const ctx: BadgeCtx = { entries, days, totalOutside, winStreak, goalStreak, level: level.level };
  const badgeResults = BADGES.map((def) => {
    const result = def.check(ctx);
    return { def, result, earned: badgeEarned(result) };
  });
  return { days, totalOutside, goalDays, level, winStreak, goalStreak, badgeResults };
}

/* ───────────── Mood ───────────── */

export type Mood = 'sleepy' | 'happy' | 'cheer' | 'unsure' | 'droopy';

export function moodFor(t: DayTotals, settings: Pick<Settings, 'outsideGoalMin' | 'insideLimitMin'>): Mood {
  if (!t.inside && !t.outside) return 'sleepy';
  if (t.outside >= settings.outsideGoalMin) return 'cheer';
  if (settings.insideLimitMin !== null && t.inside > settings.insideLimitMin && t.outside === 0) return 'droopy';
  if (t.outside >= t.inside) return 'happy';
  return 'unsure';
}

const LINES: Record<Mood, string[]> = {
  sleepy: ['Zzz… log something to wake me up!', 'Yawn… ready for some fresh air?', 'Psst. I’m a plant. I need sunshine. ☀️'],
  happy: ['Outside is winning! Keep it up 🌞', 'Loving this fresh air!', 'I can feel myself growing! 🌱'],
  cheer: ['GOAL SMASHED! You’re a legend 🎉', 'We did it! Look at me grow!', 'Best. Day. Ever. 🌟'],
  unsure: ['Hmm, inside is ahead… quick walk? 👀', 'A little sunshine would be nice…', 'Scooter time? Just saying 🛴'],
  droopy: ['I’m wilting… can we go outside? 🥺', 'Too much screen… I need sunlight!', 'Water me with fresh air, please 🌧️'],
};

export function moodLine(mood: Mood, now = Date.now()): string {
  const lines = LINES[mood];
  return lines[Math.floor(now / DAY_MS) % lines.length];
}
