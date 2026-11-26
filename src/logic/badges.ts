import type { Entry } from '../data/types';
import { CATEGORIES } from '../data/categories';
import { startOfWeek } from './time';
import type { ChallengeWin, Ledger, LedgerRow } from './xp';

/* ─────────────────────────────────────────────────────────────────────────────
   Upgradeable badges: every family has 6 tiers (Bronze → Legend).
   Values come from records that never go down (best streak, totals, max level),
   so a tier, once earned, is kept forever. Unlock dates are stored as "id:tier".
   ───────────────────────────────────────────────────────────────────────────── */

export interface Tier {
  n: number; // 1..6
  name: string;
  emoji: string;
  cls: string;
}

export const TIERS: Tier[] = [
  { n: 1, name: 'Bronze', emoji: '🥉', cls: 't-1' },
  { n: 2, name: 'Silver', emoji: '🥈', cls: 't-2' },
  { n: 3, name: 'Gold', emoji: '🥇', cls: 't-3' },
  { n: 4, name: 'Platinum', emoji: '💠', cls: 't-4' },
  { n: 5, name: 'Diamond', emoji: '💎', cls: 't-5' },
  { n: 6, name: 'Legend', emoji: '👑', cls: 't-6' },
];

export const MAX_TIER = TIERS.length;

export interface BadgeCtx {
  entries: Entry[];
  ledger: Ledger;
  /** dayKey → outside minutes */
  map: Map<string, number>;
  wins: ChallengeWin[];
  maxLevel: number;
  totalMinutes: number;
}

export interface BadgeFamily {
  id: string;
  emoji: string;
  name: string;
  /** Short unit for progress text, e.g. "days", "h", "XP" */
  unit: string;
  /** The goal sentence for a tier threshold */
  goal: (n: number) => string;
  thresholds: [number, number, number, number, number, number];
  metric: (c: BadgeCtx, m: Metrics) => number;
}

const s = (n: number, word: string, plural = `${word}s`) => `${n.toLocaleString()} ${n === 1 ? word : plural}`;

/** Everything the families measure, computed once. */
export interface Metrics {
  hits: number;
  perfectWeeks: number;
  weekendWarriors: number;
  holidayHits: number;
  bigDays: number;
  comebacks: number;
  xpEarned: number;
  marathons: number;
  activeDays: number;
}

const done = (r: LedgerRow) => r.hit || r.info.rest;

export function computeMetrics(c: BadgeCtx): Metrics {
  const rows = c.ledger.rows;
  let perfectWeeks = 0;
  const weeks = new Map<number, LedgerRow[]>();
  for (const r of rows) {
    const w = startOfWeek(r.info.ts);
    weeks.set(w, [...(weeks.get(w) ?? []), r]);
  }
  for (const days of weeks.values()) if (days.length === 7 && days.every(done) && days.some((d) => d.hit)) perfectWeeks++;

  let weekendWarriors = 0;
  for (let i = 0; i < rows.length - 1; i++) {
    if (new Date(rows[i].info.ts).getDay() === 6 && rows[i].hit && rows[i + 1].hit) weekendWarriors++;
  }

  let comebacks = 0;
  for (let i = 1; i < rows.length; i++) if (rows[i].xp > 0 && rows[i - 1].applied < 0) comebacks++;

  let marathons = 0;
  let activeDays = 0;
  for (const m of c.map.values()) {
    if (m >= 180) marathons++;
    if (m > 0) activeDays++;
  }

  return {
    hits: rows.filter((r) => r.hit).length,
    perfectWeeks,
    weekendWarriors,
    holidayHits: rows.filter((r) => r.hit && r.info.type === 'holiday').length,
    bigDays: rows.filter((r) => r.xp >= 100).length,
    comebacks,
    xpEarned: rows.reduce((a, r) => a + (r.xp > 0 ? r.xp : 0), 0),
    marathons,
    activeDays,
  };
}

const hourOf = (ts: number) => new Date(ts).getHours();

export const FAMILIES: BadgeFamily[] = [
  { id: 'streak', emoji: '🔥', name: 'Streak Master', unit: 'days', thresholds: [3, 7, 14, 30, 60, 100], goal: (n) => `Hit your target ${n} days in a row`, metric: (c) => c.ledger.streak.best },
  { id: 'hours', emoji: '🌳', name: 'Outdoor Hours', unit: 'h', thresholds: [1, 10, 25, 50, 100, 250], goal: (n) => `Spend ${s(n, 'hour')} outside in total`, metric: (c) => Math.floor((c.totalMinutes / 60) * 10) / 10 },
  { id: 'targets', emoji: '🎯', name: 'Target Hitter', unit: 'days', thresholds: [1, 7, 20, 50, 100, 200], goal: (n) => `Hit your daily target on ${s(n, 'day')}`, metric: (_c, m) => m.hits },
  { id: 'level', emoji: '⭐', name: 'Pip Grower', unit: 'Lv', thresholds: [3, 5, 8, 11, 15, 20], goal: (n) => `Help Pip reach level ${n}`, metric: (c) => c.maxLevel },
  { id: 'xp', emoji: '💰', name: 'XP Collector', unit: 'XP', thresholds: [250, 1000, 3000, 6000, 12000, 25000], goal: (n) => `Earn ${n.toLocaleString()} XP in total`, metric: (_c, m) => m.xpEarned },
  { id: 'challenges', emoji: '🏆', name: 'Challenge Champ', unit: 'done', thresholds: [1, 3, 6, 12, 25, 50], goal: (n) => `Complete ${s(n, 'weekend challenge')}`, metric: (c) => c.wins.length },
  { id: 'perfect-week', emoji: '🗓️', name: 'Perfect Week', unit: 'weeks', thresholds: [1, 2, 4, 8, 16, 26], goal: (n) => `Hit your target every day, Mon–Sun, for ${s(n, 'week')}`, metric: (_c, m) => m.perfectWeeks },
  { id: 'weekend-warrior', emoji: '⚔️', name: 'Weekend Warrior', unit: 'weekends', thresholds: [1, 3, 6, 12, 26, 52], goal: (n) => `Hit your target on Saturday AND Sunday, ${s(n, 'weekend')}`, metric: (_c, m) => m.weekendWarriors },
  { id: 'holiday-hero', emoji: '🏝️', name: 'Holiday Hero', unit: 'days', thresholds: [3, 7, 14, 30, 60, 100], goal: (n) => `Hit your target on ${s(n, 'holiday day')}`, metric: (_c, m) => m.holidayHits },
  { id: 'big-day', emoji: '💥', name: 'Big Day', unit: 'days', thresholds: [1, 3, 7, 15, 30, 60], goal: (n) => `Earn 100+ XP in a single day, ${s(n, 'time')}`, metric: (_c, m) => m.bigDays },
  { id: 'marathon', emoji: '🏃', name: 'Marathon', unit: 'days', thresholds: [1, 3, 7, 15, 30, 60], goal: (n) => `Spend 3+ hours outside in a day, ${s(n, 'time')}`, metric: (_c, m) => m.marathons },
  { id: 'comeback', emoji: '🦸', name: 'Comeback Kid', unit: 'times', thresholds: [1, 3, 6, 12, 25, 50], goal: (n) => `Win XP back the day after losing some, ${s(n, 'time')}`, metric: (_c, m) => m.comebacks },
  { id: 'early-bird', emoji: '🌅', name: 'Early Bird', unit: 'times', thresholds: [1, 5, 15, 30, 60, 100], goal: (n) => `Head outside before 9am, ${s(n, 'time')}`, metric: (c) => c.entries.filter((e) => e.minutes >= 5 && hourOf(e.start) < 9).length },
  { id: 'golden-hour', emoji: '🌇', name: 'Golden Hour', unit: 'times', thresholds: [1, 5, 15, 30, 60, 100], goal: (n) => `Spend 20+ minutes outside after 5pm, ${s(n, 'time')}`, metric: (c) => c.entries.filter((e) => e.minutes >= 20 && hourOf(e.start) >= 17).length },
  { id: 'timer', emoji: '⏱️', name: 'Timer Pro', unit: 'sessions', thresholds: [1, 10, 25, 50, 100, 200], goal: (n) => `Save ${s(n, 'session')} with the live timer`, metric: (c) => c.entries.filter((e) => e.source === 'timer').length },
  {
    id: 'explorer',
    emoji: '🧭',
    name: 'Explorer',
    unit: 'activities',
    thresholds: [2, 3, 4, 5, 6, 8],
    goal: (n) => (n >= CATEGORIES.length ? `Try all ${n} activities` : `Try ${n} different activities`),
    metric: (c) => new Set(c.entries.map((e) => e.category).filter((x) => x && CATEGORIES.some((k) => k.id === x))).size,
  },
  { id: 'logger', emoji: '📝', name: 'Logger', unit: 'outings', thresholds: [1, 10, 50, 100, 250, 500], goal: (n) => `Log ${s(n, 'outing')}`, metric: (c) => c.entries.length },
  { id: 'grass-toucher', emoji: '🌱', name: 'Grass Toucher', unit: 'days', thresholds: [3, 14, 30, 60, 120, 365], goal: (n) => `Get outside on ${s(n, 'different day')}`, metric: (_c, m) => m.activeDays },
];

export interface FamilyResult {
  family: BadgeFamily;
  value: number;
  /** 0 = nothing yet, 1..6 = Bronze..Legend */
  tier: number;
  prevThreshold: number;
  next?: { tier: Tier; threshold: number };
  /** 0..1 progress from the current tier toward the next (bar starts again from empty after each upgrade) */
  fraction: number;
}

export function tierFor(thresholds: readonly number[], value: number): number {
  let t = 0;
  for (const th of thresholds) if (value >= th) t++;
  return t;
}

/** `minTier`: highest tier ever unlocked (tiers are kept forever, even if the value later drops). */
export function evaluateFamily(family: BadgeFamily, value: number, minTier = 0): FamilyResult {
  const tier = Math.max(tierFor(family.thresholds, value), minTier);
  const prevThreshold = tier > 0 ? family.thresholds[tier - 1] : 0;
  if (tier >= MAX_TIER) return { family, value, tier, prevThreshold, fraction: 1 };
  const threshold = family.thresholds[tier];
  const fraction = Math.max(0, Math.min(1, (value - prevThreshold) / (threshold - prevThreshold)));
  return { family, value, tier, prevThreshold, next: { tier: TIERS[tier], threshold }, fraction };
}

export function evaluateFamilies(c: BadgeCtx): FamilyResult[] {
  const m = computeMetrics(c);
  return FAMILIES.map((f) => evaluateFamily(f, f.metric(c, m)));
}

export const tierKey = (id: string, tier: number) => `${id}:${tier}`;

/** All "id:tier" keys earned by these results. */
export function earnedKeys(results: FamilyResult[]): string[] {
  const out: string[] = [];
  for (const r of results) for (let t = 1; t <= r.tier; t++) out.push(tierKey(r.family.id, t));
  return out;
}

/** Highest stored tier per family (tiers are kept forever, even if a value somehow dropped). */
export function storedTier(unlocked: Record<string, number>, id: string): number {
  let t = 0;
  for (let n = 1; n <= MAX_TIER; n++) if (unlocked[tierKey(id, n)]) t = n;
  return t;
}

export function fmtValue(family: BadgeFamily, v: number): string {
  if (family.id === 'hours') return `${Number.isInteger(v) ? v : v.toFixed(1)}`;
  return v.toLocaleString();
}
