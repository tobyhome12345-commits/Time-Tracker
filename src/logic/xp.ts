import type { AppData, Holiday, TargetPeriod, Targets } from '../data/types';
import { DEFAULT_TARGETS } from '../data/types';
import { levelInfo, levelOf, type LevelInfo } from './levels';
import { dayKey, isWeekend, keyToTs, nextKey, startOfWeek } from './time';

/* ─────────────────────────────────────────────────────────────────────────────
   XP rules (pure, derived from data every time; nothing here is stored)

   Day type → target:  holiday (any holiday period) > weekend (Sat/Sun) > weekday
   Hit the target:     +25 bonus, +1 per extra minute (max 240), +5 × streak (max +25)
   Miss the target:    −1 per minute short, applied once the day is over (midnight)
   Rest day:           no target, no XP change, streak paused (not broken)
   Challenge complete: +50 (on the day it's completed)
   XP total never goes below 0.
   ───────────────────────────────────────────────────────────────────────────── */

export const XP = {
  targetBonus: 25,
  extraCap: 240,
  streakStep: 5,
  streakCap: 25,
  challenge: 50,
} as const;

export type DayType = 'weekday' | 'weekend' | 'holiday';

export interface DayInfo {
  key: string;
  ts: number;
  type: DayType;
  target: number;
  holiday?: Holiday;
  rest: boolean;
  /** Weekends and holiday days: when weekend challenges count. */
  free: boolean;
}

type DayCtx = Pick<AppData, 'targetHistory' | 'holidays' | 'restDays'>;

export function targetsOn(history: TargetPeriod[], key: string): Targets {
  let t: Targets | undefined;
  for (const p of history) if (p.from <= key) t = p;
  return t ?? history[0] ?? DEFAULT_TARGETS;
}

export function holidayOn(holidays: Holiday[], key: string): Holiday | undefined {
  return holidays.find((h) => h.start <= key && key <= h.end);
}

export function dayInfo(ctx: DayCtx, key: string): DayInfo {
  const ts = keyToTs(key);
  const targets = targetsOn(ctx.targetHistory, key);
  const holiday = holidayOn(ctx.holidays, key);
  const type: DayType = holiday ? 'holiday' : isWeekend(ts) ? 'weekend' : 'weekday';
  return {
    key,
    ts,
    type,
    target: targets[type],
    holiday,
    rest: ctx.restDays.includes(key),
    free: type !== 'weekday',
  };
}

/** How many rest/sick days you can use per Mon–Sun week. */
export const REST_DAYS_PER_WEEK = 2;

/** Rest days still available in the Mon–Sun week containing `key` (not counting `key` itself). */
export function restDaysLeft(restDays: string[], key: string): number {
  return Math.max(0, REST_DAYS_PER_WEEK - restDaysUsedInWeek(restDays, key).length);
}

/** Rest days already used in the Mon–Sun week containing `key` (excluding `key` itself). */
export function restDaysUsedInWeek(restDays: string[], key: string): string[] {
  const wk = startOfWeek(keyToTs(key));
  return restDays.filter((d) => d !== key && startOfWeek(keyToTs(d)) === wk);
}

export interface XpPart {
  kind: 'target' | 'extra' | 'streak' | 'short' | 'challenge' | 'rest';
  label: string;
  xp: number;
}

export interface LedgerRow {
  info: DayInfo;
  minutes: number;
  hit: boolean;
  /** Today, target not hit yet: no loss applied (yet). */
  pending: boolean;
  isToday: boolean;
  parts: XpPart[];
  /** Sum of parts */
  xp: number;
  /** Change actually applied to the total (differs from xp only when the total hits 0) */
  applied: number;
  total: number;
  levelBefore: number;
  levelAfter: number;
  /** Streak count after this day */
  streak: number;
}

export interface ChallengeWin {
  /** dayKey on which it was completed */
  day: string;
  id: string;
  name: string;
}

export interface Ledger {
  rows: LedgerRow[];
  today: LedgerRow;
  total: number;
  level: LevelInfo;
  streak: { current: number; best: number; todayDone: boolean };
  /** For a pending today: XP lost at midnight if nothing else is logged. */
  atRisk: number;
  /** For a pending today: minutes still needed. */
  toGo: number;
}

/**
 * Build the day-by-day XP ledger from `trackingSince` to today.
 * `totals` = dayKey → outside minutes (from dailyTotals). `wins` = challenge completions.
 */
export function buildLedger(data: AppData, totals: Map<string, number>, now = Date.now(), wins: ChallengeWin[] = []): Ledger {
  const todayKey = dayKey(now);
  const winByDay = new Map<string, ChallengeWin[]>();
  for (const w of wins) winByDay.set(w.day, [...(winByDay.get(w.day) ?? []), w]);

  const rows: LedgerRow[] = [];
  let total = 0;
  let streak = 0;
  let best = 0;
  let key = data.trackingSince <= todayKey ? data.trackingSince : todayKey;

  for (let guard = 0; guard < 5000; guard++) {
    const info = dayInfo(data, key);
    const minutes = Math.round(totals.get(key) ?? 0);
    const isToday = key === todayKey;
    const parts: XpPart[] = [];
    let hit = false;
    let pending = false;

    if (info.rest) {
      parts.push({ kind: 'rest', label: 'Rest day', xp: 0 });
    } else if (minutes >= info.target) {
      hit = true;
      streak += 1;
      best = Math.max(best, streak);
      parts.push({ kind: 'target', label: 'Target hit', xp: XP.targetBonus });
      const extra = Math.min(XP.extraCap, minutes - info.target);
      if (extra > 0) parts.push({ kind: 'extra', label: `${extra} extra min`, xp: extra });
      const sb = Math.min(XP.streakCap, XP.streakStep * streak);
      parts.push({ kind: 'streak', label: `${streak}-day streak`, xp: sb });
    } else if (isToday) {
      pending = true;
    } else {
      const short = info.target - minutes;
      parts.push({ kind: 'short', label: `${short}m short`, xp: -short });
      streak = 0;
    }
    for (const w of winByDay.get(key) ?? []) parts.push({ kind: 'challenge', label: w.name, xp: XP.challenge });

    const xp = parts.reduce((a, p) => a + p.xp, 0);
    const before = total;
    total = Math.max(0, total + xp);
    rows.push({
      info,
      minutes,
      hit,
      pending,
      isToday,
      parts,
      xp,
      applied: total - before,
      total,
      levelBefore: levelOf(before),
      levelAfter: levelOf(total),
      streak,
    });
    if (isToday) break;
    key = nextKey(key);
  }

  const today = rows[rows.length - 1];
  const toGo = today.pending ? today.info.target - today.minutes : 0;
  return {
    rows,
    today,
    total,
    level: levelInfo(total),
    streak: { current: streak, best, todayDone: today.hit },
    atRisk: today.pending ? Math.min(toGo, total) : 0,
    toGo,
  };
}

export const DAY_TYPE_LABEL: Record<DayType, string> = { weekday: 'Weekday', weekend: 'Weekend', holiday: 'Holiday' };
export const DAY_TYPE_EMOJI: Record<DayType, string> = { weekday: '📚', weekend: '🎉', holiday: '🏖️' };
