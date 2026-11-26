import type { AppData, Entry } from '../data/types';
import { addDays, addMonths, DAY_MS, dayKey, daysInMonth, isWeekend, keyToTs, splitByDay, startOfDay, startOfMonth, startOfWeek, weekdayIndex } from './time';
import { dayInfo, type DayType, type Ledger, type LedgerRow } from './xp';

export type Period = 'week' | 'month';

export interface DayStat {
  key: string;
  ts: number;
  minutes: number;
  target: number;
  type: DayType;
  holidayName?: string;
  rest: boolean;
  hit: boolean;
  /** Net XP for the day, or null if not tracked yet / still pending */
  xp: number | null;
  future: boolean;
  isToday: boolean;
  tracked: boolean;
}

export interface PeriodSummary {
  minutes: number;
  days: number;
  avg: number;
  hits: number;
  xp: number;
}

export interface PeriodStats {
  period: Period;
  start: number;
  end: number; // exclusive
  days: DayStat[];
  cur: PeriodSummary;
  prev: PeriodSummary;
  isCurrent: boolean;
  /** number of days compared (elapsed days for the current period) */
  compared: number;
}

export function periodStart(period: Period, ts: number) {
  return period === 'week' ? startOfWeek(ts) : startOfMonth(ts);
}

export function shiftPeriod(period: Period, start: number, n: number) {
  return period === 'week' ? addDays(start, 7 * n) : addMonths(start, n);
}

export function periodLength(period: Period, start: number) {
  return period === 'week' ? 7 : daysInMonth(start);
}

export function dayStat(data: AppData, map: Map<string, number>, rows: Map<string, LedgerRow>, ts: number, todayKey: string): DayStat {
  const key = dayKey(ts);
  const info = dayInfo(data, key);
  const row = rows.get(key);
  return {
    key,
    ts,
    minutes: Math.round(map.get(key) ?? 0),
    target: info.target,
    type: info.type,
    holidayName: info.holiday?.name,
    rest: info.rest,
    hit: row?.hit ?? false,
    xp: row && !row.pending ? row.xp : null,
    future: key > todayKey,
    isToday: key === todayKey,
    tracked: !!row,
  };
}

function summarize(days: DayStat[]): PeriodSummary {
  const minutes = days.reduce((a, d) => a + d.minutes, 0);
  const n = days.length;
  return { minutes, days: n, avg: n ? minutes / n : 0, hits: days.filter((d) => d.hit).length, xp: days.reduce((a, d) => a + (d.xp ?? 0), 0) };
}

export function ledgerIndex(ledger: Ledger) {
  return new Map(ledger.rows.map((r) => [r.info.key, r]));
}

export function periodStats(data: AppData, map: Map<string, number>, ledger: Ledger, period: Period, anchor: number, now = Date.now()): PeriodStats {
  const rows = ledgerIndex(ledger);
  const todayKey = dayKey(now);
  const start = periodStart(period, anchor);
  const len = periodLength(period, start);
  const end = addDays(start, len);
  const today = startOfDay(now);
  const isCurrent = today >= start && today < end;
  const days: DayStat[] = [];
  for (let i = 0; i < len; i++) days.push(dayStat(data, map, rows, addDays(start, i), todayKey));

  // Fair comparison: for the current period, compare the same number of elapsed days.
  const compared = isCurrent ? Math.round((today - start) / DAY_MS) + 1 : len;
  const prevStart = shiftPeriod(period, start, -1);
  const prevLen = periodLength(period, prevStart);
  const prevDays: DayStat[] = [];
  for (let i = 0; i < Math.min(compared, prevLen); i++) prevDays.push(dayStat(data, map, rows, addDays(prevStart, i), todayKey));

  return { period, start, end, days, cur: summarize(days.slice(0, compared)), prev: summarize(prevDays), isCurrent, compared };
}

/* ───────────── Insights ───────────── */

export interface CategoryStat {
  id: string; // '' = no activity picked
  minutes: number;
  count: number;
}

export interface Insights {
  days: number;
  totalMinutes: number;
  avg: number;
  weekdayAvg: number;
  weekendAvg: number;
  hitRate: number | null;
  bestDay: { key: string; ts: number; minutes: number } | null;
  bestWeek: { start: number; minutes: number } | null;
  longest: Entry | null;
  categories: CategoryStat[];
  /** Mon..Sun average outside minutes */
  weekday: number[];
  topWeekday: number | null;
  partOfDay: { morning: number; afternoon: number; evening: number };
}

export function insights(entries: Entry[], map: Map<string, number>, ledger: Ledger, rangeDays: number | null, now = Date.now()): Insights {
  const today = startOfDay(now);
  const first = entries.length ? startOfDay(entries[0].start) : today;
  let from = rangeDays ? addDays(today, -(rangeDays - 1)) : first;
  if (from < first) from = first;
  const to = addDays(today, 1);
  const days = Math.max(1, Math.round((today - from) / DAY_MS) + 1);

  let totalMinutes = 0;
  let bestDay: Insights['bestDay'] = null;
  const wd = Array.from({ length: 7 }, () => ({ m: 0, n: 0 }));
  let wkdM = 0;
  let wkdN = 0;
  let wkeM = 0;
  let wkeN = 0;
  const weeks = new Map<number, number>();
  for (let i = 0; i < days; i++) {
    const ts = addDays(from, i);
    const key = dayKey(ts);
    const m = map.get(key) ?? 0;
    totalMinutes += m;
    wd[weekdayIndex(ts)].m += m;
    wd[weekdayIndex(ts)].n++;
    if (isWeekend(ts)) {
      wkeM += m;
      wkeN++;
    } else {
      wkdM += m;
      wkdN++;
    }
    const w = startOfWeek(ts);
    weeks.set(w, (weeks.get(w) ?? 0) + m);
    if (m > 0 && (!bestDay || m > bestDay.minutes)) bestDay = { key, ts, minutes: m };
  }
  let bestWeek: Insights['bestWeek'] = null;
  for (const [start, minutes] of weeks) if (minutes > 0 && (!bestWeek || minutes > bestWeek.minutes)) bestWeek = { start, minutes };

  const fromKey = dayKey(from);
  const judged = ledger.rows.filter((r) => r.info.key >= fromKey && !r.pending && !r.info.rest);
  const hitRate = judged.length ? judged.filter((r) => r.hit).length / judged.length : null;

  const weekday = wd.map((x) => (x.n ? x.m / x.n : 0));
  let topWeekday: number | null = null;
  weekday.forEach((v, i) => {
    if (v > 0 && (topWeekday === null || v > weekday[topWeekday])) topWeekday = i;
  });

  const cats = new Map<string, CategoryStat>();
  const partOfDay = { morning: 0, afternoon: 0, evening: 0 };
  let longest: Entry | null = null;
  for (const e of entries) {
    if (e.start >= to || e.start + e.minutes * 60_000 <= from) continue;
    let mins = 0;
    for (const c of splitByDay(e)) {
      const ts = keyToTs(c.day);
      if (ts >= from && ts < to) mins += c.minutes;
    }
    if (!mins) continue;
    if (!longest || e.minutes > longest.minutes) longest = e;
    const id = e.category ?? '';
    const cs = cats.get(id) ?? { id, minutes: 0, count: 0 };
    cs.minutes += mins;
    cs.count++;
    cats.set(id, cs);
    const h = new Date(e.start).getHours();
    if (h < 12) partOfDay.morning += mins;
    else if (h < 17) partOfDay.afternoon += mins;
    else partOfDay.evening += mins;
  }

  return {
    days,
    totalMinutes,
    avg: totalMinutes / days,
    weekdayAvg: wkdN ? wkdM / wkdN : 0,
    weekendAvg: wkeN ? wkeM / wkeN : 0,
    hitRate,
    bestDay,
    bestWeek,
    longest,
    categories: [...cats.values()].sort((a, b) => b.minutes - a.minutes || b.count - a.count),
    weekday,
    topWeekday,
    partOfDay,
  };
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
