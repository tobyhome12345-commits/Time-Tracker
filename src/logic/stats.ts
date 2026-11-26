import type { Entry, Kind } from '../data/types';
import { addDays, addMonths, DAY_MS, dayKey, daysInMonth, keyToTs, splitByDay, startOfDay, startOfMonth, startOfWeek, type DayTotals } from './time';

export type Period = 'week' | 'month';

export interface DayStat extends DayTotals {
  key: string;
  ts: number;
  future: boolean;
}

export interface PeriodSummary {
  inside: number;
  outside: number;
  /** 0..1 or null when nothing logged */
  outsidePct: number | null;
}

export interface PeriodStats {
  period: Period;
  start: number;
  end: number; // exclusive
  days: DayStat[];
  cur: PeriodSummary;
  prev: PeriodSummary;
  /** true when the period contains today (compares "same point last period") */
  isCurrent: boolean;
  /** Days with at least one log in this period */
  loggedDays: number;
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

function summarize(map: Map<string, DayTotals>, start: number, days: number): PeriodSummary {
  let inside = 0;
  let outside = 0;
  for (let i = 0; i < days; i++) {
    const t = map.get(dayKey(addDays(start, i)));
    if (t) {
      inside += t.inside;
      outside += t.outside;
    }
  }
  const total = inside + outside;
  return { inside, outside, outsidePct: total ? outside / total : null };
}

export function periodStats(map: Map<string, DayTotals>, period: Period, anchor: number, now = Date.now()): PeriodStats {
  const start = periodStart(period, anchor);
  const len = periodLength(period, start);
  const end = addDays(start, len);
  const today = startOfDay(now);
  const isCurrent = today >= start && today < end;

  const days: DayStat[] = [];
  let loggedDays = 0;
  for (let i = 0; i < len; i++) {
    const ts = addDays(start, i);
    const key = dayKey(ts);
    const t = map.get(key) ?? { inside: 0, outside: 0 };
    if (t.inside || t.outside) loggedDays++;
    days.push({ key, ts, inside: t.inside, outside: t.outside, future: ts > today });
  }

  // Fair comparison: for the current period, compare against the same number of elapsed days.
  const elapsed = isCurrent ? Math.round((today - start) / DAY_MS) + 1 : len;
  const prevStart = shiftPeriod(period, start, -1);
  const prevLen = periodLength(period, prevStart);
  const cur = summarize(map, start, isCurrent ? elapsed : len);
  const prev = summarize(map, prevStart, isCurrent ? Math.min(elapsed, prevLen) : prevLen);

  return { period, start, end, days, cur, prev, isCurrent, loggedDays };
}

/** Signed change helper: returns null when there's nothing to compare against. */
export function change(cur: number, prev: number): number | null {
  if (!prev && !cur) return null;
  return cur - prev;
}

/* ───────────── Insights ───────────── */

export interface CategoryStat {
  kind: Kind;
  id: string; // '' = uncategorised
  minutes: number;
  count: number;
}

export interface Insights {
  days: number; // days counted for averages
  avgInside: number;
  avgOutside: number;
  bestDay: { key: string; ts: number; outside: number; inside: number } | null;
  bestBalanceDay: { key: string; ts: number; pct: number; outside: number } | null;
  categories: Record<Kind, CategoryStat[]>;
  /** Mon..Sun average outside minutes */
  weekday: { outside: number; inside: number }[];
  topWeekday: number | null; // 0 = Mon
  /** Outside minutes by part of day */
  partOfDay: { morning: number; afternoon: number; evening: number };
  totalOutside: number;
  totalInside: number;
}

/** Insights over the last `rangeDays` days (inclusive of today), or all time when rangeDays is null. */
export function insights(entries: Entry[], map: Map<string, DayTotals>, rangeDays: number | null, now = Date.now()): Insights {
  const today = startOfDay(now);
  const first = entries.length ? startOfDay(entries[0].start) : today;
  let from = rangeDays ? addDays(today, -(rangeDays - 1)) : first;
  if (from < first) from = first; // don't average over days before you started using the app
  const to = addDays(today, 1);
  const days = Math.max(1, Math.round((today - from) / DAY_MS) + 1);

  let totalInside = 0;
  let totalOutside = 0;
  let bestDay: Insights['bestDay'] = null;
  let bestBalanceDay: Insights['bestBalanceDay'] = null;
  const wdSum = Array.from({ length: 7 }, () => ({ outside: 0, inside: 0, n: 0 }));

  for (let i = 0; i < days; i++) {
    const ts = addDays(from, i);
    const key = dayKey(ts);
    const t = map.get(key) ?? { inside: 0, outside: 0 };
    totalInside += t.inside;
    totalOutside += t.outside;
    const wd = (new Date(ts).getDay() + 6) % 7;
    wdSum[wd].outside += t.outside;
    wdSum[wd].inside += t.inside;
    wdSum[wd].n++;
    if (t.outside > 0 && (!bestDay || t.outside > bestDay.outside)) bestDay = { key, ts, outside: t.outside, inside: t.inside };
    const total = t.inside + t.outside;
    if (total >= 60) {
      const pct = t.outside / total;
      if (!bestBalanceDay || pct > bestBalanceDay.pct || (pct === bestBalanceDay.pct && t.outside > bestBalanceDay.outside))
        bestBalanceDay = { key, ts, pct, outside: t.outside };
    }
  }

  const weekday = wdSum.map((w) => ({ outside: w.n ? w.outside / w.n : 0, inside: w.n ? w.inside / w.n : 0 }));
  let topWeekday: number | null = null;
  weekday.forEach((w, i) => {
    if (w.outside > 0 && (topWeekday === null || w.outside > weekday[topWeekday].outside)) topWeekday = i;
  });

  const cats = new Map<string, CategoryStat>();
  const partOfDay = { morning: 0, afternoon: 0, evening: 0 };
  for (const e of entries) {
    if (e.start >= to || e.start + e.minutes * 60_000 <= from) continue;
    // Only count the minutes inside the range.
    let mins = 0;
    for (const c of splitByDay(e)) {
      const ts = keyToTs(c.day);
      if (ts >= from && ts < to) mins += c.minutes;
    }
    if (!mins) continue;
    const k = `${e.kind}:${e.category ?? ''}`;
    const cs = cats.get(k) ?? { kind: e.kind, id: e.category ?? '', minutes: 0, count: 0 };
    cs.minutes += mins;
    cs.count++;
    cats.set(k, cs);
    if (e.kind === 'outside') {
      const h = new Date(e.start).getHours();
      if (h < 12) partOfDay.morning += mins;
      else if (h < 17) partOfDay.afternoon += mins;
      else partOfDay.evening += mins;
    }
  }
  const sorted = [...cats.values()].sort((a, b) => b.minutes - a.minutes || b.count - a.count);
  const categories: Record<Kind, CategoryStat[]> = {
    inside: sorted.filter((c) => c.kind === 'inside'),
    outside: sorted.filter((c) => c.kind === 'outside'),
  };

  return {
    days,
    avgInside: totalInside / days,
    avgOutside: totalOutside / days,
    bestDay,
    bestBalanceDay,
    categories,
    weekday,
    topWeekday,
    partOfDay,
    totalInside,
    totalOutside,
  };
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
